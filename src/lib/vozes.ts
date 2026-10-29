// Vozes da série (series/<serie>/vozes.json): narrador e personagens, com a
// voz de cada provedor de TTS e a cor/nome da etiqueta na legenda das falas.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Falantes } from "../../engine/hud/legenda";

const vozEdge = z.object({ voz: z.string(), rate: z.string().regex(/^[+-]\d+%$/), pitch: z.string().regex(/^[+-]\d+Hz$/) });
const vozKokoro = z.object({ voz: z.string(), speed: z.number().positive() });
/** ritmo real medido nas falas sintetizadas (scripts/medir-ritmo.ts) */
const ritmo = z.object({ silabas_por_s: z.number().positive(), pausa_s: z.number().nonnegative(), inicio_s: z.number().nonnegative(), trechos: z.number().int().optional() });
export type Ritmo = z.infer<typeof ritmo>;
const voz = z.object({ nome: z.string(), edge: vozEdge, kokoro: vozKokoro.optional(), ritmo: ritmo.optional() });

export const vozesSchema = z.object({
  provisorio: z.boolean().optional(),
  nota: z.string().optional(),
  nota_ritmo: z.string().optional(),
  /** "voz": cada personagem fala com a própria voz; "tela": narrador único, falas de personagem só na legenda com a etiqueta do nome */
  falas: z.enum(["voz", "tela"]).optional(),
  narrador: voz,
  personagens: z.record(z.string(), voz.extend({ cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/) })),
});
export type Vozes = z.infer<typeof vozesSchema>;

export const caminhoVozes = (serie: string) => path.resolve(import.meta.dirname, `../../series/${serie}/vozes.json`);

export function lerVozes(serie: string): Vozes | undefined {
  const arq = caminhoVozes(serie);
  return existsSync(arq) ? vozesSchema.parse(JSON.parse(readFileSync(arq, "utf8"))) : undefined;
}

/** nome e cor de cada personagem, para a etiqueta da legenda */
export const falantesDe = (v: Vozes | undefined): Falantes =>
  Object.fromEntries(Object.entries(v?.personagens ?? {}).map(([id, p]) => [id, { nome: p.nome, cor: p.cor }]));

/** falas de personagem com voz própria? (narrador único: não) */
export const falasComVoz = (v: Vozes | undefined) => (v?.falas ?? "voz") === "voz";

/** ritmo da voz de um papel ("narrador" ou id do personagem), se medido */
export const ritmoDe = (v: Vozes | undefined, papel: string): Ritmo | undefined => (papel === "narrador" ? v?.narrador : v?.personagens[papel])?.ritmo;
