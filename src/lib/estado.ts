// Estado da história (bíblia §7). O banco é a fonte da verdade a partir da
// Fase 3; series/<slug>/estado.json é o espelho que o roteirista lê.
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { estadoInicialDaBiblia } from "./biblia";

const ferimentoSchema = z.object({ quem: z.string(), onde: z.string(), gravidade: z.number().int().min(1).max(3) });

export const estadoSchema = z
  .object({
    serie: z.string().min(1),
    /** nó que o próximo roteiro vai escrever */
    proximo_no: z.string().regex(/^ep\d{2}(_[a-z0-9]+)?$/),
    /** último nó publicado (null antes do EP1) */
    ultimo_no: z.string().nullable(),
    bateria: z.number().min(0).max(100),
    comida_dias: z.number().min(0),
    agua_litros: z.number().min(0),
    ferimentos: z.array(ferimentoSchema),
    confianca_valdir: z.number().int().min(-2).max(2),
    exposicao: z.number().min(0).max(10),
    pistas: z.array(z.string()),
    grupo: z.array(z.string()),
    itens: z.array(z.string()),
    local_atual: z.string(),
    noite: z.number().int().min(1),
    hora: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .loose();

export type Estado = z.infer<typeof estadoSchema>;

/** Estado antes do primeiro episódio, lido da tabela da bíblia. */
export function estadoInicial(serie: string, biblia: string, primeiroNo = "ep01"): Estado {
  return estadoSchema.parse({ serie, proximo_no: primeiroNo, ultimo_no: null, ...estadoInicialDaBiblia(biblia) });
}

export const caminhoEstado = (serie: string) => path.resolve(import.meta.dirname, `../../series/${serie}/estado.json`);

export function lerEstado(serie: string): Estado {
  return estadoSchema.parse(JSON.parse(readFileSync(caminhoEstado(serie), "utf8")));
}
