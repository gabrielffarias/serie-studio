// Catálogo de assets aprovados (assets/catalogo.json): o que o roteirista pode
// usar sem pedir asset novo. Na Fase 1 é gerado dos registros do motor
// (engine/catalogo.ts); a partir da Fase 3, do banco (só status APPROVED).
import { readFileSync } from "node:fs";
import path from "node:path";

export type ItemPersonagem = {
  id: string;
  nome: string;
  tipo: "humano" | "criatura";
  vistas: string[];
  poses: string[];
  /** acessórios ligados por pose ou por item do estado */
  acessorios: string[];
  /** ações que este personagem consegue fazer (tem as poses delas) */
  acoes: string[];
  notas: string[];
};

export type ItemCenario = {
  id: string;
  descricao: string;
  /** focos de câmera e pontos de referência (camera.foco) */
  ancoras: string[];
  estados: string[];
  notas: string[];
};

export type ItemAcao = { tipo: string; descricao: string; campos: string[]; vistas_recomendadas: string[] };

export type Catalogo = {
  versao: number;
  personagens: ItemPersonagem[];
  cenarios: ItemCenario[];
  props: { id: string; descricao: string; estados: string[] }[];
  infograficos: { id: string; descricao: string }[];
  acoes: ItemAcao[];
  camera: { mov: string; descricao: string }[];
  luzes: string[];
  efeitos: string[];
  sons: string[];
  musicas: string[];
  /** itens do estado que mudam o desenho (ex.: lanterna_cabeca no Caio) */
  itens_visiveis: Record<string, string>;
  regras: string[];
};

export const CAMINHO_CATALOGO = path.resolve(import.meta.dirname, "../../assets/catalogo.json");

export function lerCatalogo(caminho = CAMINHO_CATALOGO): Catalogo {
  return JSON.parse(readFileSync(caminho, "utf8")) as Catalogo;
}
