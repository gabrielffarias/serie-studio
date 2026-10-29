// QA pós-render: mede o MP4 final (duração, loudness, picos, telas pretas,
// Whisper) e avalia contra as regras. As regras são puras (testáveis); as
// medições chamam ffmpeg e o whisper.
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalizar } from "../hud/legenda";
import type { PalavraFalada } from "../voz/provedores";
import { lcs } from "../voz/tempos";

export type Checagem = { id: string; ok: boolean; mensagem: string; aviso?: boolean };

export const LIMITES = {
  duracaoMin: 65,
  duracaoMax: 90,
  lufs: -14,
  lufsTolerancia: 1,
  picoMaxDbtp: -1,
  pretoMaxS: 0.3,
  /** escuro planejado: num plano com apagão, o corte para preto pode durar até isto */
  escuroApagaoMaxS: 0.6,
  ultimaFraseMin: 0.9,
  /** desvio máximo entre a palavra na legenda e a palavra ouvida pelo Whisper */
  syncMaxS: 0.15,
  /** silêncio antes da palavra a partir do qual o início do Whisper não vale (ver desviosSync) */
  pausaS: 0.2,
  /** abaixo desta probabilidade o Whisper não reconheceu a palavra com confiança: fica fora do sync */
  whisperProbMin: 0.5,
  /** palavra ouvida mais longa que razão × falada + folga: o Whisper grudou silêncio nela, o tempo não vale */
  duracaoRazaoMax: 2,
  duracaoFolgaS: 0.25,
};

/** palavra que o Whisper ouviu, com a probabilidade que ele deu (0–1) */
export type PalavraOuvida = PalavraFalada & { prob?: number };

export type Medidas = {
  duracao: number;
  lufs: number;
  picoDbtp: number;
  pretos: { ini: number; fim: number }[];
  /** palavras que o Whisper ouviu no MP4 final */
  ouvidas: PalavraOuvida[];
};

export type Esperado = {
  /** palavras faladas com o tempo que a legenda usa (timeline do episódio) */
  faladas: PalavraFalada[];
  ultimaFrase: string;
  /** falas que não saíram do primeiro provedor da ordem */
  fallback: string[];
  sonsSemArquivo: string[];
  /** planos com apagão (timeline do episódio): o corte para preto dentro deles é planejado, até escuroApagaoMaxS */
  planosApagao?: { id: string; ini: number; fim: number }[];
};

const tokens = (s: string) => normalizar(s).split(" ").filter(Boolean);

/** Quanto da frase esperada aparece, em ordem, no fim do que foi ouvido (0–1). */
export function ultimaFraseCompleta(frase: string, ouvidas: PalavraFalada[]): number {
  const alvo = tokens(frase);
  const fim = ouvidas.flatMap((w) => tokens(w.texto)).slice(-(alvo.length + 3));
  return alvo.length ? lcs(alvo, fim).length / alvo.length : 0;
}

export type Desvio = { palavra: string; t: number; desvio: number; borda: "ini" | "fim" };
export type Ignorada = { palavra: string; t: number; motivo: string };

/**
 * Desvio de cada palavra (legenda × Whisper), só nas que o Whisper ouviu com
 * confiança. Fica fora (sem forçar casamento):
 * - palavra com probabilidade abaixo de whisperProbMin (sai antes do
 *   casamento, para não ancorar a palavra errada);
 * - palavra casada com duração implausível (> razão × a falada + folga): o
 *   Whisper grudou nela o silêncio de um corte e o tempo dela não vale.
 * Mede o início; mas o Whisper gruda o silêncio na primeira palavra depois de
 * uma pausa (começo do plano, ponto final) e marca o início dela cedo demais.
 * Nessas, mede o fim, que ele acerta. O mesmo vale logo depois de um número
 * que o Whisper agrupou em algarismos ("cento e oito" → "108", que não casa
 * com as palavras faladas): ele puxa o início da palavra seguinte para dentro
 * do número.
 */
export function desviosSync(faladas: PalavraFalada[], ouvidas: PalavraOuvida[], L = LIMITES): { desvios: Desvio[]; ignoradas: Ignorada[] } {
  const ignoradas: Ignorada[] = [];
  const confiaveis = ouvidas.filter((w) => {
    const ok = w.prob === undefined || w.prob >= L.whisperProbMin;
    if (!ok) ignoradas.push({ palavra: w.texto, t: w.ini, motivo: `probabilidade ${w.prob!.toFixed(2)}` });
    return ok;
  });
  const a = faladas.map((w) => normalizar(w.texto));
  const b = confiaveis.map((w) => normalizar(w.texto));
  const desvios: Desvio[] = [];
  const pares = lcs(a, b);
  const casadas = new Set(pares.map(([, j]) => j));
  const depoisDeNumero = (j: number) => j > 0 && !casadas.has(j - 1) && /\d/.test(confiaveis[j - 1].texto);
  for (const [i, j] of pares) {
    const f = faladas[i];
    const o = confiaveis[j];
    const durF = f.fim - f.ini;
    const durO = o.fim - o.ini;
    if (durO > L.duracaoRazaoMax * durF + L.duracaoFolgaS) {
      ignoradas.push({ palavra: o.texto, t: o.ini, motivo: `duração ${durO.toFixed(2)} s ouvida × ${durF.toFixed(2)} s falada` });
      continue;
    }
    const borda = i === 0 || f.ini - faladas[i - 1].fim >= L.pausaS || depoisDeNumero(j) ? "fim" : "ini";
    desvios.push({ palavra: f.texto, t: f.ini, desvio: Math.round(Math.abs(f[borda] - o[borda]) * 1000) / 1000, borda });
  }
  return { desvios, ignoradas };
}

/** Pretos fora do que é planejado, e os planejados (dentro de um plano com apagão, até escuroApagaoMaxS). */
export function classificarPretos(pretos: Medidas["pretos"], planosApagao: Esperado["planosApagao"] = [], L = LIMITES) {
  const plano = (p: { ini: number; fim: number }) => planosApagao.find((x) => p.ini >= x.ini - 0.05 && p.fim <= x.fim + 0.05);
  const planejados: string[] = [];
  const ruins: string[] = [];
  for (const p of pretos) {
    const dur = p.fim - p.ini;
    const fmt = `${p.ini.toFixed(1)}–${p.fim.toFixed(1)} s`;
    const ap = plano(p);
    if (ap && dur <= L.escuroApagaoMaxS) planejados.push(`${fmt} (apagão ${ap.id}, ${dur.toFixed(2)} s)`);
    else if (ap) ruins.push(`${fmt} no apagão ${ap.id}: ${dur.toFixed(2)} s (máx. ${L.escuroApagaoMaxS} s)`);
    else if (dur > L.pretoMaxS) ruins.push(fmt);
  }
  return { planejados, ruins };
}

export function avaliarQa(m: Medidas, e: Esperado, L = LIMITES): Checagem[] {
  const out: Checagem[] = [];
  out.push({ id: "duracao", ok: m.duracao >= L.duracaoMin && m.duracao <= L.duracaoMax, mensagem: `duração ${m.duracao.toFixed(1)} s (${L.duracaoMin}–${L.duracaoMax})` });
  out.push({ id: "loudness", ok: Math.abs(m.lufs - L.lufs) <= L.lufsTolerancia, mensagem: `${m.lufs.toFixed(1)} LUFS integrado (alvo ${L.lufs} ±${L.lufsTolerancia})` });
  out.push({ id: "pico", ok: m.picoDbtp <= L.picoMaxDbtp, mensagem: `pico real ${m.picoDbtp.toFixed(1)} dBTP (máx. ${L.picoMaxDbtp})` });
  const { planejados, ruins } = classificarPretos(m.pretos, e.planosApagao, L);
  out.push({
    id: "telas_pretas",
    ok: !ruins.length,
    mensagem: ruins.length
      ? `tela preta: ${ruins.join(", ")}`
      : `nenhuma tela preta acima de ${L.pretoMaxS} s${planejados.length ? `; escuro planejado: ${planejados.join(", ")}` : ""}`,
  });
  const fim = ultimaFraseCompleta(e.ultimaFrase, m.ouvidas);
  out.push({ id: "ultima_frase", ok: fim >= L.ultimaFraseMin, mensagem: `última frase "${e.ultimaFrase}" ouvida ${Math.round(fim * 100)}%` });

  const casadas = lcs(
    e.faladas.map((w) => normalizar(w.texto)),
    m.ouvidas.map((w) => normalizar(w.texto)),
  ).length;
  out.push({ id: "transcricao", ok: true, aviso: true, mensagem: `Whisper casou ${casadas} de ${e.faladas.length} palavras do roteiro (${Math.round((casadas / Math.max(1, e.faladas.length)) * 100)}%)` });

  const { desvios: d, ignoradas } = desviosSync(e.faladas, m.ouvidas, L);
  const pior = d.reduce((a, b) => (b.desvio > a.desvio ? b : a), { palavra: "", t: 0, desvio: 0 });
  const media = d.reduce((s, x) => s + x.desvio, 0) / Math.max(1, d.length);
  const fora = ignoradas.length ? `; fora (Whisper sem confiança): ${ignoradas.map((x) => `"${x.palavra}" ${x.t.toFixed(1)} s (${x.motivo})`).join(", ")}` : "";
  out.push({
    id: "sync_legenda",
    ok: d.length > 0 && pior.desvio <= L.syncMaxS,
    mensagem: d.length
      ? `desvio da legenda: máx. ${Math.round(pior.desvio * 1000)} ms ("${pior.palavra}" em ${pior.t.toFixed(1)} s), média ${Math.round(media * 1000)} ms, ${d.length} palavras${fora}`
      : "nenhuma palavra casou com o Whisper",
  });
  out.push({ id: "provedor_tts", ok: !e.fallback.length, aviso: true, mensagem: e.fallback.length ? `falas por fallback: ${e.fallback.join(", ")}` : "todas as falas do primeiro provedor" });
  out.push({ id: "sons_sem_arquivo", ok: !e.sonsSemArquivo.length, aviso: true, mensagem: e.sonsSemArquivo.length ? `sons sem arquivo: ${e.sonsSemArquivo.join(", ")}` : "todo som tem arquivo" });
  return out;
}

// ---------- medições ----------

function rodar(cmd: string, args: string[], timeoutMs = 600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 << 20, timeout: timeoutMs }, (err, stdout, stderr) => (err ? reject(new Error(`${cmd}: ${stderr.split("\n").slice(-4).join(" ")}`)) : resolve(stdout + stderr)));
  });
}

export async function medirAudioVideo(mp4: string): Promise<Omit<Medidas, "ouvidas">> {
  const duracao = Number((await rodar("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4])).trim());
  const r = await rodar("ffmpeg", ["-hide_banner", "-nostats", "-i", mp4, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"]);
  const resumo = r.slice(r.lastIndexOf("Summary:"));
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(resumo)?.[1]);
  const picoDbtp = Number(/True peak:\s+Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(resumo)?.[1]);
  const b = await rodar("ffmpeg", ["-hide_banner", "-nostats", "-i", mp4, "-map", "0:v", "-vf", "blackdetect=d=0.1:pix_th=0.08", "-f", "null", "-"]);
  const pretos = [...b.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((x) => ({ ini: Number(x[1]), fim: Number(x[2]) }));
  return { duracao, lufs, picoDbtp, pretos };
}

/** Whisper com tempo por palavra no áudio do MP4. */
export async function ouvir(mp4: string, modelo = process.env.WHISPER_MODELO ?? "small"): Promise<PalavraOuvida[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "qa-whisper-"));
  try {
    const wav = path.join(dir, "audio.wav");
    await rodar("ffmpeg", ["-v", "error", "-i", mp4, "-ac", "1", "-ar", "16000", wav]);
    await rodar("whisper", [wav, "--model", modelo, "--language", "pt", "--word_timestamps", "True", "--output_format", "json", "--output_dir", dir, "--fp16", "False"], 1_800_000);
    const j = JSON.parse(readFileSync(path.join(dir, "audio.json"), "utf8")) as { segments: { words?: { word: string; start: number; end: number; probability?: number }[] }[] };
    return j.segments.flatMap((s) => s.words ?? []).map((w) => ({ texto: w.word.trim(), ini: w.start, fim: w.end, ...(w.probability !== undefined ? { prob: Math.round(w.probability * 1000) / 1000 } : {}) }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
