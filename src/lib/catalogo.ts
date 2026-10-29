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
  /** janelas por onde o vulto pode passar (0 = o vulto não aparece aqui antes do EP5) */
  janelas: number;
  /** tem assento para a pose `sentado` */
  assentos: boolean;
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
  /** luzes ambiente (estado de cada local) */
  luzes: string[];
  /** efeitos de luz: piscar_luz e os eventos que mudam a luz ambiente */
  efeitos: string[];
  /** evento → transição da luz ambiente do local */
  eventos_luz: Record<string, { de: string[]; para: string; descricao: string }>;
  /** ids de efeito (assets/audio/sons.json → sfx) */
  sons: string[];
  sons_descricao: Record<string, string>;
  /** instruções de mixagem por prefixo ("silencio_*" → o que faz); não tocam arquivo */
  sons_mix: Record<string, string>;
  musicas: string[];
  /** itens do estado que mudam o desenho (ex.: lanterna_cabeca no Caio) */
  itens_visiveis: Record<string, string>;
  /** camada (lanterna), pose ou prop que só vale com um destes itens em estado.itens (basta um) */
  exige_item: { camadas: Record<string, string[]>; poses: Record<string, string[]>; props: Record<string, string[]> };
  regras: string[];
};

export const CAMINHO_CATALOGO = path.resolve(import.meta.dirname, "../../assets/catalogo.json");

export function lerCatalogo(caminho = CAMINHO_CATALOGO): Catalogo {
  return JSON.parse(readFileSync(caminho, "utf8")) as Catalogo;
}

/** o id em `som` é uma instrução de mixagem (casa um prefixo de sons_mix)? */
export const ehInstrucaoMix = (cat: Pick<Catalogo, "sons_mix">, id: string) =>
  Object.keys(cat.sons_mix ?? {}).some((p) => id.startsWith(p.replace(/\*$/, "")));
