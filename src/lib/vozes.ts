// Vozes da série (series/<serie>/vozes.json): narrador e personagens, com a
// voz de cada provedor de TTS e a cor/nome da etiqueta na legenda das falas.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { Falantes } from "../../engine/hud/legenda";

const vozEdge = z.object({ voz: z.string(), rate: z.string().regex(/^[+-]\d+%$/), pitch: z.string().regex(/^[+-]\d+Hz$/) });
const vozKokoro = z.object({ voz: z.string(), speed: z.number().positive() });
const voz = z.object({ nome: z.string(), edge: vozEdge, kokoro: vozKokoro.optional() });

export const vozesSchema = z.object({
  provisorio: z.boolean().optional(),
  nota: z.string().optional(),
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
