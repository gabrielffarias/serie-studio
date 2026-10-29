// TtsProvider: uma interface, vários provedores, tentados na ordem de
// TTS_PROVEDORES (padrão "edge,kokoro"). Cada fala sai em WAV 48 kHz mono com
// os tempos das palavras; o cache por hash evita chamar o serviço de novo num
// re-render. Quem gerou cada fala vai para o log (falas.json).
//
// Produção (canal monetizado): Azure Speech, a API oficial das mesmas vozes
// neurais do edge. Enquanto não houver chave, Azure e VoiceStudio são só
// esqueleto (disponivel() = false) e a ordem fica edge → kokoro.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Vozes } from "../../src/lib/vozes";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const TTS_PY = path.join(RAIZ, "engine/voz/tts.py");
export const DIR_CACHE = path.join(RAIZ, "data/voz/cache");
export const DIR_KOKORO = path.join(RAIZ, "data/modelos/kokoro");

export type PalavraFalada = { texto: string; ini: number; fim: number };

export type PedidoFala = {
  texto: string;
  /** "narrador" ou o id do personagem em vozes.json */
  papel: string;
};

export type Sintese = {
  wav: string;
  duracao: number;
  /** tempos por palavra do próprio provedor; null = o provedor não dá (estimar) */
  palavras: PalavraFalada[] | null;
  provedor: string;
  voz: string;
  ajustes: string;
  hash: string;
  cache: boolean;
};

export interface TtsProvider {
  readonly id: string;
  disponivel(): boolean;
  /** descrição da voz deste papel neste provedor (entra no hash do cache) */
  voz(papel: string): { voz: string; ajustes: string };
  sintetizar(texto: string, papel: string, saida: string): Promise<{ duracao: number; palavras: PalavraFalada[] | null }>;
}

function configPapel(v: Vozes, papel: string) {
  const c = papel === "narrador" ? v.narrador : v.personagens[papel];
  if (!c) throw new Error(`sem voz para "${papel}" em vozes.json`);
  return c;
}

function python(args: string[], timeoutMs: number): Promise<{ duracao: number; palavras: PalavraFalada[] | null }> {
  return new Promise((resolve, reject) => {
    execFile("python3", [TTS_PY, ...args], { timeout: timeoutMs, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).trim().split("\n").at(-1)));
      resolve(JSON.parse(stdout));
    });
  });
}

export class EdgeTtsProvider implements TtsProvider {
  readonly id = "edge";
  constructor(private vozes: Vozes, private tentativas = 3) {}
  disponivel() {
    return existsSync(path.join(RAIZ, ".pydeps/edge_tts"));
  }
  voz(papel: string) {
    const e = configPapel(this.vozes, papel).edge;
    return { voz: e.voz, ajustes: `rate ${e.rate} pitch ${e.pitch}` };
  }
  async sintetizar(texto: string, papel: string, saida: string) {
    const e = configPapel(this.vozes, papel).edge;
    let erro: unknown;
    // o serviço às vezes não devolve áudio sem motivo; tenta de novo com espera
    for (let i = 0; i < this.tentativas; i++) {
      try {
        return await python(["edge", saida, texto, e.voz, e.rate, e.pitch], 60_000);
      } catch (err) {
        erro = err;
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      }
    }
    throw erro;
  }
}

export class KokoroProvider implements TtsProvider {
  readonly id = "kokoro";
  constructor(private vozes: Vozes) {}
  disponivel() {
    return existsSync(path.join(DIR_KOKORO, "kokoro-v1.0.onnx")) && existsSync(path.join(RAIZ, ".pydeps/kokoro_onnx"));
  }
  voz(papel: string) {
    const k = configPapel(this.vozes, papel).kokoro;
    if (!k) throw new Error(`sem voz kokoro para "${papel}" em vozes.json`);
    return { voz: k.voz, ajustes: `speed ${k.speed}` };
  }
  sintetizar(texto: string, papel: string, saida: string) {
    const k = configPapel(this.vozes, papel).kokoro!;
    return python(["kokoro", saida, texto, k.voz, String(k.speed), DIR_KOKORO], 300_000);
  }
}

/** Esqueleto: API oficial do Azure Speech (mesmas vozes neurais do edge). Precisa de AZURE_SPEECH_KEY e AZURE_SPEECH_REGION. */
export class AzureTtsProvider implements TtsProvider {
  readonly id = "azure";
  constructor(private vozes: Vozes) {}
  disponivel() {
    return false; // ligar quando a chave existir: !!process.env.AZURE_SPEECH_KEY && !!process.env.AZURE_SPEECH_REGION
  }
  voz(papel: string) {
    const e = configPapel(this.vozes, papel).edge;
    return { voz: e.voz, ajustes: `rate ${e.rate} pitch ${e.pitch}` };
  }
  async sintetizar(): Promise<never> {
    // SSML com <prosody rate pitch> e evento WordBoundary do SDK (mesmo formato do edge)
    throw new Error("Azure Speech ainda não implementado (falta a chave)");
  }
}

/** Esqueleto: VoiceStudio. */
export class VoiceStudioProvider implements TtsProvider {
  readonly id = "voicestudio";
  disponivel() {
    return false;
  }
  voz() {
    return { voz: "", ajustes: "" };
  }
  async sintetizar(): Promise<never> {
    throw new Error("VoiceStudio ainda não implementado");
  }
}

export const ORDEM_PADRAO = ["edge", "kokoro"];

export function provedores(vozes: Vozes, ordem = (process.env.TTS_PROVEDORES ?? ORDEM_PADRAO.join(",")).split(",")): TtsProvider[] {
  const todos: Record<string, TtsProvider> = {
    azure: new AzureTtsProvider(vozes),
    edge: new EdgeTtsProvider(vozes),
    kokoro: new KokoroProvider(vozes),
    voicestudio: new VoiceStudioProvider(),
  };
  return ordem.map((id) => {
    const p = todos[id.trim()];
    if (!p) throw new Error(`provedor de TTS desconhecido: ${id}`);
    return p;
  });
}

export const hashFala = (provedor: string, voz: string, ajustes: string, texto: string) =>
  createHash("sha256").update([provedor, voz, ajustes, texto].join("\u0000")).digest("hex").slice(0, 16);

/**
 * Tenta cada provedor na ordem; o primeiro que der certo gera a fala. Cache
 * por hash (provedor + voz + ajustes + texto). `falhas` guarda por que os
 * anteriores não serviram.
 */
export async function sintetizarComFallback(
  pedido: PedidoFala,
  lista: TtsProvider[],
  saida: string,
  dirCache = DIR_CACHE,
): Promise<Sintese & { falhas: string[] }> {
  const falhas: string[] = [];
  mkdirSync(dirCache, { recursive: true });
  for (const p of lista) {
    if (!p.disponivel()) {
      falhas.push(`${p.id}: indisponível`);
      continue;
    }
    try {
      const { voz, ajustes } = p.voz(pedido.papel);
      const hash = hashFala(p.id, voz, ajustes, pedido.texto);
      const wavCache = path.join(dirCache, `${hash}.wav`);
      const jsonCache = path.join(dirCache, `${hash}.json`);
      const cache = existsSync(wavCache) && existsSync(jsonCache);
      if (!cache) {
        const r = await p.sintetizar(pedido.texto, pedido.papel, wavCache);
        writeFileSync(jsonCache, JSON.stringify(r));
      }
      const r = JSON.parse(readFileSync(jsonCache, "utf8")) as { duracao: number; palavras: PalavraFalada[] | null };
      copyFileSync(wavCache, saida);
      return { wav: saida, ...r, provedor: p.id, voz, ajustes, hash, cache, falhas };
    } catch (err) {
      falhas.push(`${p.id}: ${(err as Error).message}`);
    }
  }
  throw new Error(`nenhum provedor de TTS conseguiu "${pedido.texto}": ${falhas.join("; ")}`);
}
