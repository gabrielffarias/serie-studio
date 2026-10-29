// Caio: técnico de manutenção do metrô (bíblia, seção 4). Visual é lei.
import { CONTORNO } from "../../../engine/rig/rosto";
import type { Figurino, VistaBase } from "../../../engine/rig/tipos";

const C = {
  macacao: "#E8752A",
  dobra: "#C9601F",
  faixa: "#C9CDD2",
  bone: "#1F2A44",
  aba: "#141C30",
  pele: "#B98260",
  cabelo: "#1A1414",
  botina: "#1A1A1A",
  cinto: "#3A3A3A",
};

const prop = {
  quadril: 215, quadrilX: 40, coxa: 100, canela: 95,
  ombro: 200, ombroX: 86, braco: 95, antebraco: 82,
  cabeca: 335, cabecaR: 118, larguraPerna: 56, larguraBraco: 46,
};

/** centro da cabeça no sistema da junta "cabeca" (pivô no pescoço) */
const CAB_Y = -(prop.cabeca - prop.ombro - 8);

const corpo: Record<VistaBase, string> = {
  frente: "M-96 34 Q-110 -90 -92 -206 Q0 -232 92 -206 Q110 -90 96 34 Z",
  costas: "M-96 34 Q-110 -90 -92 -206 Q0 -232 92 -206 Q110 -90 96 34 Z",
  perfil: "M-58 34 Q-70 -90 -56 -206 Q0 -224 58 -206 Q80 -100 66 34 Z",
  "3/4": "M-86 34 Q-100 -90 -82 -206 Q6 -230 80 -206 Q96 -90 84 34 Z",
};

const meiaLargura: Record<VistaBase, number> = { frente: 100, costas: 100, perfil: 66, "3/4": 90 };

function tronco(v: VistaBase, px: string): string {
  const w = meiaLargura[v];
  const cx = v === "3/4" ? -3 : v === "perfil" ? 4 : 0;
  const clip = `<clipPath id="${px}-clip"><path d="${corpo[v]}"/></clipPath>`;
  const ziper = v === "frente" ? `<path d="M0 -200 L0 0" stroke="${C.dobra}" stroke-width="6"/>` : v === "3/4" ? `<path d="M22 -205 Q26 -100 20 0" stroke="${C.dobra}" stroke-width="6" fill="none"/>` : "";
  const gola =
    v === "costas" ? "" : `<path d="M${cx - 30} -214 L${cx} -176 L${cx + 30} -214 Z" fill="${C.pele}"/>`;
  const chave =
    v === "costas"
      ? ""
      : `<g transform="translate(${v === "frente" ? -62 : v === "3/4" ? -52 : 10} 8)"><rect x="-7" y="0" width="14" height="34" rx="5" fill="#F2C230" stroke="${CONTORNO}" stroke-width="4"/><rect x="-3" y="34" width="6" height="30" fill="#9AA0A7"/></g>`;
  return (
    `<defs>${clip}</defs>` +
    `<path d="${corpo[v]}" fill="${C.macacao}"/>` +
    `<g clip-path="url(#${px}-clip)">` +
    `<rect x="${-w - 20}" y="-150" width="${2 * w + 40}" height="22" fill="${C.faixa}"/>` +
    `<rect x="${-w - 20}" y="-14" width="${2 * w + 40}" height="22" fill="${C.cinto}"/>` +
    (v === "perfil" ? `<path d="M30 -60 Q60 -40 56 0" stroke="${C.dobra}" stroke-width="7" fill="none"/>` : "") +
    `</g>` +
    ziper +
    gola +
    (v === "costas" ? "" : `<rect x="${cx - 12}" y="-16" width="24" height="26" rx="4" fill="#9AA0A7" stroke="${CONTORNO}" stroke-width="3"/>`) +
    chave
  );
}

const orelha = (x: number) =>
  `<ellipse cx="${x}" cy="12" rx="18" ry="27" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/>`;

function cabeca(v: VistaBase): { base: string; topo: string } {
  const r = prop.cabecaR;
  const cranio = (cor: string) => `<circle cx="0" cy="0" r="${r}" fill="${cor}" stroke="${CONTORNO}" stroke-width="7"/>`;
  const dome = (d: string) => `<path d="${d}" fill="${C.bone}" stroke="${CONTORNO}" stroke-width="6" stroke-linejoin="round"/>`;
  switch (v) {
    case "frente":
      return {
        base:
          orelha(-116) + orelha(116) + cranio(C.pele) +
          `<path d="M-108 -46 Q-114 -10 -104 20 L-90 18 Q-98 -10 -92 -46 Z" fill="${C.cabelo}"/>` +
          `<path d="M108 -46 Q114 -10 104 20 L90 18 Q98 -10 92 -46 Z" fill="${C.cabelo}"/>`,
        topo:
          dome("M-117 -44 Q-114 -124 0 -128 Q114 -124 117 -44 Q0 -60 -117 -44 Z") +
          `<path d="M-122 -46 Q0 -66 122 -46 Q126 -30 112 -28 Q0 -46 -112 -28 Q-126 -30 -122 -46 Z" fill="${C.aba}" stroke="${CONTORNO}" stroke-width="5"/>`,
      };
    case "costas":
      return {
        base: orelha(-116) + orelha(116) + cranio(C.cabelo) + `<path d="M-60 92 Q0 120 60 92 L50 112 Q0 124 -50 112 Z" fill="${C.pele}"/>`,
        topo:
          dome("M-118 -30 Q-116 -124 0 -128 Q116 -124 118 -30 Q0 -44 -118 -30 Z") +
          `<rect x="-26" y="-50" width="52" height="16" rx="6" fill="${C.cabelo}"/><path d="M-26 -42 L26 -42" stroke="#8A8F98" stroke-width="5"/>`,
      };
    case "perfil":
      return {
        base:
          cranio(C.pele) +
          `<path d="M-116 -40 Q-124 20 -96 64 Q-70 44 -62 0 Q-64 -24 -60 -40 Z" fill="${C.cabelo}"/>` +
          `<ellipse cx="-44" cy="16" rx="15" ry="23" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/>` +
          `<path d="M-40 6 Q-50 16 -42 28" stroke="${CONTORNO}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
        topo:
          dome("M-118 -36 Q-114 -124 8 -128 Q108 -120 116 -40 Q0 -52 -118 -36 Z") +
          `<path d="M70 -50 L190 -42 Q198 -32 186 -28 L66 -32 Z" fill="${C.aba}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>`,
      };
    case "3/4":
      return {
        base:
          cranio(C.pele) +
          `<path d="M-116 -40 Q-122 0 -110 40 L-92 34 Q-100 0 -94 -40 Z" fill="${C.cabelo}"/>` +
          orelha(-104),
        topo:
          dome("M-118 -40 Q-114 -124 4 -128 Q112 -122 117 -42 Q0 -56 -118 -40 Z") +
          `<path d="M-40 -48 Q80 -64 172 -44 Q180 -32 164 -28 Q80 -44 -40 -32 Z" fill="${C.aba}" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>`,
      };
  }
}

/** Lanterna de cabeça (item `lanterna_cabeca`), presa no boné. */
function lanterna(v: VistaBase): string {
  const pos: Record<VistaBase, [number, number] | null> = { frente: [0, -88], costas: null, perfil: [96, -86], "3/4": [52, -92] };
  const correia = `<path d="M-118 -70 Q0 -96 118 -70" stroke="#2B2F36" stroke-width="10" fill="none"/>`;
  const p = pos[v];
  if (!p) return `<g transform="translate(0 ${CAB_Y})"><path d="M-116 -64 Q0 -84 116 -64" stroke="#2B2F36" stroke-width="10" fill="none"/></g>`;
  const [x, y] = p;
  const lente = v === "perfil" ? `<rect x="${x + 12}" y="${y - 12}" width="10" height="24" rx="3" fill="#FFF3B0"/>` : `<circle cx="${x + (v === "3/4" ? 8 : 0)}" cy="${y}" r="12" fill="#FFF3B0" stroke="${CONTORNO}" stroke-width="3"/>`;
  return (
    `<g transform="translate(0 ${CAB_Y})">` +
    (v === "frente" ? correia : "") +
    `<rect x="${x - 24}" y="${y - 20}" width="${v === "perfil" ? 38 : 48}" height="40" rx="8" fill="#3B3F46" stroke="${CONTORNO}" stroke-width="5"/>` +
    lente +
    `</g>`
  );
}

/** comprimento da lanterna de mão a partir do pivô da mão, até a lente (o feixe sai daí) */
export const PONTA_LANTERNA_MAO = 98;

/**
 * Lanterna de mão (item `lanterna_mao`), presa na mão direita ao longo do
 * antebraço: o cabo fica atrás do punho e a cabeça com a lente sai à frente.
 */
function lanternaMao(): string {
  return (
    `<rect x="-14" y="-24" width="28" height="84" rx="7" fill="#2E3238" stroke="${CONTORNO}" stroke-width="5"/>` +
    `<path d="M-17 58 L17 58 L25 90 L-25 90 Z" fill="#454A52" stroke="${CONTORNO}" stroke-width="5" stroke-linejoin="round"/>` +
    `<rect x="-22" y="88" width="44" height="${PONTA_LANTERNA_MAO - 86}" rx="4" fill="#FFF3B0" stroke="${CONTORNO}" stroke-width="3"/>`
  );
}

export const caio: Figurino = {
  id: "caio",
  nome: "Caio",
  prop,
  cores: { pele: C.pele, manga: C.macacao, perna: C.macacao, pe: C.botina, sobrancelha: C.cabelo },
  tronco,
  cabeca: (v) => cabeca(v),
  detalheMembro: (_v, j) =>
    j.startsWith("canela") ? `<rect x="-28" y="34" width="56" height="18" fill="${C.faixa}"/>` : "",
  acessorios: {
    lanterna_cabeca: { junta: "cabeca", padrao: false, desenhar: lanterna },
    lanterna_mao: { junta: "mao_d", padrao: false, atras: true, desenhar: lanternaMao },
  },
};
