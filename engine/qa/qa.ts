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
  ultimaFraseMin: 0.9,
  /** desvio máximo entre a palavra na legenda e a palavra ouvida pelo Whisper */
  syncMaxS: 0.15,
  /** silêncio antes da palavra a partir do qual o início do Whisper não vale (ver desviosSync) */
  pausaS: 0.2,
};

export type Medidas = {
  duracao: number;
  lufs: number;
  picoDbtp: number;
  pretos: { ini: number; fim: number }[];
  /** palavras que o Whisper ouviu no MP4 final */
  ouvidas: PalavraFalada[];
};

export type Esperado = {
  /** palavras faladas com o tempo que a legenda usa (timeline do episódio) */
  faladas: PalavraFalada[];
  ultimaFrase: string;
  /** falas que não saíram do primeiro provedor da ordem */
  fallback: string[];
  sonsSemArquivo: string[];
  /** escuros de propósito (corte do evento de luz): preto dentro deles não conta */
  pretosEsperados?: { ini: number; fim: number; motivo: string }[];
};

const tokens = (s: string) => normalizar(s).split(" ").filter(Boolean);

/** Quanto da frase esperada aparece, em ordem, no fim do que foi ouvido (0–1). */
export function ultimaFraseCompleta(frase: string, ouvidas: PalavraFalada[]): number {
  const alvo = tokens(frase);
  const fim = ouvidas.flatMap((w) => tokens(w.texto)).slice(-(alvo.length + 3));
  return alvo.length ? lcs(alvo, fim).length / alvo.length : 0;
}

/**
 * Desvio de cada palavra (legenda × Whisper), nas palavras que casam. Mede
 * o início; mas o Whisper gruda o silêncio na primeira palavra depois de uma
 * pausa (começo do plano, ponto final) e marca o início dela cedo demais.
 * Nessas, mede o fim, que ele acerta.
 */
export function desviosSync(faladas: PalavraFalada[], ouvidas: PalavraFalada[], pausaS = LIMITES.pausaS): { palavra: string; t: number; desvio: number; borda: "ini" | "fim" }[] {
  const a = faladas.map((w) => normalizar(w.texto));
  const b = ouvidas.map((w) => normalizar(w.texto));
  return lcs(a, b).map(([i, j]) => {
    const borda = i === 0 || faladas[i].ini - faladas[i - 1].fim >= pausaS ? "fim" : "ini";
    return { palavra: faladas[i].texto, t: faladas[i].ini, desvio: Math.round(Math.abs(faladas[i][borda] - ouvidas[j][borda]) * 1000) / 1000, borda };
  });
}

export function avaliarQa(m: Medidas, e: Esperado, L = LIMITES): Checagem[] {
  const out: Checagem[] = [];
  out.push({ id: "duracao", ok: m.duracao >= L.duracaoMin && m.duracao <= L.duracaoMax, mensagem: `duração ${m.duracao.toFixed(1)} s (${L.duracaoMin}–${L.duracaoMax})` });
  out.push({ id: "loudness", ok: Math.abs(m.lufs - L.lufs) <= L.lufsTolerancia, mensagem: `${m.lufs.toFixed(1)} LUFS integrado (alvo ${L.lufs} ±${L.lufsTolerancia})` });
  out.push({ id: "pico", ok: m.picoDbtp <= L.picoMaxDbtp, mensagem: `pico real ${m.picoDbtp.toFixed(1)} dBTP (máx. ${L.picoMaxDbtp})` });
  const esperado = (p: { ini: number; fim: number }) => (e.pretosEsperados ?? []).find((x) => p.ini >= x.ini && p.fim <= x.fim);
  const pretos = m.pretos.filter((p) => p.fim - p.ini > L.pretoMaxS && !esperado(p));
  const deProposito = m.pretos.filter(esperado).map((p) => `${p.ini.toFixed(1)}–${p.fim.toFixed(1)} s (${esperado(p)!.motivo})`);
  out.push({
    id: "telas_pretas",
    ok: !pretos.length,
    mensagem: pretos.length ? `tela preta: ${pretos.map((p) => `${p.ini.toFixed(1)}–${p.fim.toFixed(1)} s`).join(", ")}` : `nenhuma tela preta acima de ${L.pretoMaxS} s${deProposito.length ? `; escuro de propósito: ${deProposito.join(", ")}` : ""}`,
  });
  const fim = ultimaFraseCompleta(e.ultimaFrase, m.ouvidas);
  out.push({ id: "ultima_frase", ok: fim >= L.ultimaFraseMin, mensagem: `última frase "${e.ultimaFrase}" ouvida ${Math.round(fim * 100)}%` });

  const casadas = lcs(
    e.faladas.map((w) => normalizar(w.texto)),
    m.ouvidas.map((w) => normalizar(w.texto)),
  ).length;
  out.push({ id: "transcricao", ok: true, aviso: true, mensagem: `Whisper casou ${casadas} de ${e.faladas.length} palavras do roteiro (${Math.round((casadas / Math.max(1, e.faladas.length)) * 100)}%)` });

  const d = desviosSync(e.faladas, m.ouvidas);
  const pior = d.reduce((a, b) => (b.desvio > a.desvio ? b : a), { palavra: "", t: 0, desvio: 0 });
  const media = d.reduce((s, x) => s + x.desvio, 0) / Math.max(1, d.length);
  out.push({
    id: "sync_legenda",
    ok: d.length > 0 && pior.desvio <= L.syncMaxS,
    mensagem: d.length
      ? `desvio da legenda: máx. ${Math.round(pior.desvio * 1000)} ms ("${pior.palavra}" em ${pior.t.toFixed(1)} s), média ${Math.round(media * 1000)} ms, ${d.length} palavras`
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
export async function ouvir(mp4: string, modelo = process.env.WHISPER_MODELO ?? "small"): Promise<PalavraFalada[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "qa-whisper-"));
  try {
    const wav = path.join(dir, "audio.wav");
    await rodar("ffmpeg", ["-v", "error", "-i", mp4, "-ac", "1", "-ar", "16000", wav]);
    await rodar("whisper", [wav, "--model", modelo, "--language", "pt", "--word_timestamps", "True", "--output_format", "json", "--output_dir", dir, "--fp16", "False"], 1_800_000);
    const j = JSON.parse(readFileSync(path.join(dir, "audio.json"), "utf8")) as { segments: { words?: { word: string; start: number; end: number }[] }[] };
    return j.segments.flatMap((s) => s.words ?? []).map((w) => ({ texto: w.word.trim(), ini: w.start, fim: w.end }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
