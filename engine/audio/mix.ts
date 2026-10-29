// Mixagem do episódio (ffmpeg): voz comprimida, efeitos nos planos, música
// (drone) em loop com ducking sob a voz e master em -14 LUFS integrado com
// pico real abaixo de -1 dBTP (loudnorm em duas passadas).
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { instanteEventoLuz } from "../compose/plano";

const RAIZ = path.resolve(import.meta.dirname, "../..");
export const DIR_AUDIO = path.join(RAIZ, "assets/audio");

export const ALVO_LUFS = -14;
/** alvo do loudnorm um pouco abaixo de -1 dBTP: o AAC do MP4 sobe o pico uns décimos */
export const ALVO_TP = -1.5;
/** ganhos relativos à voz (dB) */
export const GANHO_SFX_DB = -4;
export const GANHO_MUSICA_DB = -15;

export type Sons = {
  sfx: Record<string, { arquivos: string[]; ganho_db?: number }>;
  musica: Record<string, { arquivo: string; loop?: boolean }>;
  /** instruções de mixagem por prefixo do id (ex.: "silencio_" baixa a música no plano) */
  mix?: Record<string, { musica_db: number }>;
};
/** rampa da música ao entrar e sair de um trecho de silêncio */
export const RAMPA_SILENCIO_S = 0.4;
export const lerSons = (): Sons => JSON.parse(readFileSync(path.join(DIR_AUDIO, "sons.json"), "utf8"));

export type Colocado = { id: string; arquivo: string; t: number; ganhoDb: number };
/** trecho em que a música desce `db` (instrução silencio_*) */
export type Silencio = { id: string; ini: number; fim: number; db: number };
export type PlanoSom = { id: string; ini: number; dur: number; som: string[]; eventoLuz: boolean };

const arred = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Onde cada efeito entra. Os sons de um plano se espalham pela duração; o
 * zumbido do apagão termina no instante em que a luz corta. Ids com vários
 * arquivos giram em rodízio pelo episódio (nunca o mesmo duas vezes
 * seguidas). Id de instrução de mixagem (silencio_*) vira um trecho de música
 * baixa no plano inteiro. Id sem arquivo volta em `semArquivo` (aviso no QA).
 */
export function planejarSfx(
  planos: PlanoSom[],
  sons: Sons,
  duracaoArquivo: (arq: string) => number,
): { colocados: Colocado[]; silencios: Silencio[]; semArquivo: string[] } {
  const colocados: Colocado[] = [];
  const silencios: Silencio[] = [];
  const semArquivo = new Set<string>();
  const giro: Record<string, number> = {};
  for (const p of planos) {
    p.som.forEach((id, i) => {
      const mix = Object.entries(sons.mix ?? {}).find(([prefixo]) => id.startsWith(prefixo));
      if (mix) {
        silencios.push({ id, ini: arred(p.ini), fim: arred(p.ini + p.dur), db: mix[1].musica_db });
        return;
      }
      const s = sons.sfx[id];
      if (!s?.arquivos.length) {
        semArquivo.add(id);
        return;
      }
      const n = giro[id] ?? 0;
      giro[id] = n + 1;
      const arquivo = s.arquivos[n % s.arquivos.length];
      let t = Math.max(p.ini, p.ini + (p.dur * (i + 0.5)) / p.som.length - 0.1);
      // o zumbido pode começar no plano anterior (o som atravessa o corte)
      if (id === "zumbido_corta" && p.eventoLuz) t = Math.max(0, p.ini + instanteEventoLuz(p.dur) - duracaoArquivo(arquivo) + 0.05);
      colocados.push({ id, arquivo, t: arred(t), ganhoDb: GANHO_SFX_DB + (s.ganho_db ?? 0) });
    });
  }
  return { colocados, silencios, semArquivo: [...semArquivo] };
}

/**
 * Expressão do filtro volume (eval=frame) da música: 1 fora dos silêncios e
 * 10^(db/20) dentro, com rampa linear de RAMPA_SILENCIO_S nas bordas.
 */
export function ganhoMusicaExpr(silencios: Silencio[], r = RAMPA_SILENCIO_S): string {
  if (!silencios.length) return "1";
  return silencios
    .map((x) => {
      const g = Math.round(10 ** (x.db / 20) * 10000) / 10000;
      // dentro (0–1): sobe em r a partir de ini, desce em r até fim
      const dentro = `clip(min((t-${x.ini})/${r},(${x.fim}-t)/${r}),0,1)`;
      return `(1-${Math.round((1 - g) * 10000) / 10000}*${dentro})`;
    })
    .join("*");
}

export type EntradaMix = {
  duracao: number;
  vozes: { wav: string; t: number }[];
  sfx: Colocado[];
  musica?: string;
  silencios?: Silencio[];
};

/** Grafo do ffmpeg (sem o master). Entradas na ordem: vozes, sfx, música. */
export function grafoMix(e: EntradaMix): { entradas: string[][]; filtro: string } {
  const entradas: string[][] = [];
  const f: string[] = [];
  const ms = (t: number) => Math.round(t * 1000);
  e.vozes.forEach((v, i) => {
    entradas.push(["-i", v.wav]);
    f.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms(v.t)}:all=1[v${i}]`);
  });
  const nv = e.vozes.length;
  f.push(
    `${e.vozes.map((_, i) => `[v${i}]`).join("")}amix=inputs=${nv}:normalize=0:duration=longest,apad=whole_dur=${e.duracao},` +
      `highpass=f=80,acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=2,alimiter=limit=0.9,asplit=2[voz][sc]`,
  );
  e.sfx.forEach((s, k) => {
    const i = nv + k;
    entradas.push(["-i", path.join(DIR_AUDIO, s.arquivo)]);
    f.push(`[${i}:a]aresample=48000,aformat=channel_layouts=mono,volume=${s.ganhoDb}dB,adelay=${ms(s.t)}:all=1[s${k}]`);
  });
  const temSfx = e.sfx.length > 0;
  if (temSfx) f.push(`${e.sfx.map((_, k) => `[s${k}]`).join("")}amix=inputs=${e.sfx.length}:normalize=0:duration=longest[sfx]`);
  let temMusica = false;
  if (e.musica) {
    const i = nv + e.sfx.length;
    entradas.push(["-stream_loop", "-1", "-i", path.join(DIR_AUDIO, e.musica)]);
    // ducking: a voz comprime a música (~10–12 dB) enquanto alguém fala
    f.push(
      `[${i}:a]aresample=48000,aformat=channel_layouts=mono,atrim=0:${e.duracao},volume=${GANHO_MUSICA_DB}dB,` +
        (e.silencios?.length ? `volume='${ganhoMusicaExpr(e.silencios)}':eval=frame,` : "") +
        `afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, e.duracao - 2)}:d=2[mus0]`,
      `[mus0][sc]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=450:knee=4[mus]`,
    );
    temMusica = true;
  } else f.push(`[sc]anullsink`);
  const bus = ["[voz]", temSfx ? "[sfx]" : "", temMusica ? "[mus]" : ""].filter(Boolean);
  f.push(`${bus.join("")}amix=inputs=${bus.length}:normalize=0:duration=first,atrim=0:${e.duracao}[mix]`);
  return { entradas, filtro: f.join(";\n") };
}

function ffmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", ["-hide_banner", "-y", ...args], { maxBuffer: 64 << 20 }, (err, _out, stderr) => (err ? reject(new Error(stderr.split("\n").slice(-6).join("\n"))) : resolve(stderr)));
  });
}

/** Mixa e masteriza em WAV 48 kHz estéreo. */
export async function mixar(e: EntradaMix, saida: string): Promise<{ medidoAntes: Record<string, string> }> {
  const { entradas, filtro } = grafoMix(e);
  const bruto = saida.replace(/\.wav$/, "-bruto.wav");
  await ffmpeg([...entradas.flat(), "-filter_complex", filtro, "-map", "[mix]", "-ar", "48000", "-ac", "1", bruto]);
  // loudnorm: 1ª passada mede, 2ª aplica linear com os valores medidos
  const ln = `loudnorm=I=${ALVO_LUFS}:TP=${ALVO_TP}:LRA=20`;
  const log = await ffmpeg(["-i", bruto, "-af", `${ln}:print_format=json`, "-f", "null", "-"]);
  const m = JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1)) as Record<string, string>;
  await ffmpeg([
    "-i",
    bruto,
    "-af",
    `${ln}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`,
    "-ac",
    "2",
    saida,
  ]);
  return { medidoAntes: m };
}
