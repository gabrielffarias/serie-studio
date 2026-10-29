// Registro dos cenários do catálogo.
import { porta_1959 } from "../../assets/cenarios/porta_1959/cenario.svg";
import { plataforma_1959 } from "../../assets/cenarios/plataforma_1959/cenario.svg";
import { tunel } from "../../assets/cenarios/tunel/cenario.svg";
import { vagao } from "../../assets/cenarios/vagao/cenario.svg";
import type { Cenario } from "./tipos";

export const CENARIOS: Record<string, Cenario> = { vagao, tunel, plataforma_1959, porta_1959 };

export function cenario(id: string): Cenario {
  const c = CENARIOS[id];
  if (!c) throw new Error(`cenário fora do catálogo: ${id}`);
  return c;
}
