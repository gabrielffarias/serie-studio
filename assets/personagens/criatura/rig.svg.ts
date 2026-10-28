// Os de baixo (bíblia, seções 4 e 8): ~1 m, magros, cinza-azulados, SEM OLHOS,
// membranas grandes nas laterais da cabeça, curvados, sem contorno preto.
// Variações para multidão: tom (normal, escura, clara) e vulto (silhueta, a
// única forma permitida antes do EP5).
import type { Figurino, VistaBase } from "../../../engine/rig/tipos";

type Tom = { corpo: string; sombra: string; membrana: string; opacidade: number };

export const TONS = {
  criatura: { corpo: "#AEB8C4", sombra: "#6E7A88", membrana: "#8C97A5", opacidade: 1 },
  criatura_escura: { corpo: "#8E99A7", sombra: "#59636F", membrana: "#717C8A", opacidade: 1 },
  criatura_clara: { corpo: "#C3CCD6", sombra: "#838E9C", membrana: "#A3AEBB", opacidade: 1 },
  criatura_vulto: { corpo: "#0B0C10", sombra: "#0B0C10", membrana: "#0B0C10", opacidade: 0.9 },
} satisfies Record<string, Tom>;

const prop = {
  quadril: 124, quadrilX: 24, coxa: 54, canela: 50,
  ombro: 104, ombroX: 46, braco: 72, antebraco: 68,
  cabeca: 168, cabecaR: 60, larguraPerna: 22, larguraBraco: 18,
};

function tronco(t: Tom, v: VistaBase): string {
  const w = v === "perfil" ? 30 : v === "3/4" ? 40 : 46;
  const corpo = `<path d="M${-w} 14 Q${-w - 8} -60 ${-w + 4} -112 Q0 -124 ${w - 4} -112 Q${w + 8} -60 ${w} 14 Z" fill="${t.corpo}"/>`;
  const costelas =
    v === "costas"
      ? `<path d="M0 -112 L0 8" stroke="${t.sombra}" stroke-width="7" stroke-linecap="round"/>` +
        [-90, -66, -42].map((y) => `<circle cx="0" cy="${y}" r="6" fill="${t.sombra}"/>`).join("")
      : [-84, -64, -44]
          .map((y) => `<path d="M${-w + 10} ${y} Q0 ${y + 8} ${w - 10} ${y}" stroke="${t.sombra}" stroke-width="5" fill="none" stroke-linecap="round"/>`)
          .join("");
  return corpo + costelas;
}

/** Cabeça alongada, sem olhos; as membranas são o que "ouve". */
function cabeca(t: Tom, v: VistaBase): { base: string; topo: string } {
  const membrana = (lado: 1 | -1, escala = 1) =>
    `<path transform="scale(${lado * escala} ${escala})" d="M38 -14 Q84 -96 168 -150 Q150 -60 128 -10 L112 6 Q90 38 44 30 Z" fill="${t.sombra}"/>` +
    `<path transform="scale(${lado * escala} ${escala})" d="M52 -4 Q100 -80 156 -132 M58 16 Q100 -30 124 -16" stroke="${t.membrana}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const cranio = (rx: number) => `<ellipse cx="0" cy="-4" rx="${rx}" ry="72" fill="${t.corpo}"/>`;
  switch (v) {
    case "frente":
    case "costas":
      return { base: membrana(1) + membrana(-1) + cranio(54), topo: "" };
    case "perfil":
      // focinho levemente à frente; a membrana fica para trás
      return { base: membrana(-1, 1.05) + `<path d="M-50 -60 Q10 -90 56 -30 Q70 20 40 60 Q-10 80 -50 40 Z" fill="${t.corpo}"/>`, topo: "" };
    case "3/4":
      return { base: membrana(-1, 1.05) + membrana(1, 0.7) + cranio(56), topo: "" };
  }
}

function pe(t: Tom): string {
  // três dedos (bíblia, pista `pegadas`)
  return `<path d="M-10 -4 L-18 18 M0 -4 L4 20 M10 -4 L24 16" stroke="${t.corpo}" stroke-width="12" stroke-linecap="round"/>`;
}

export function criatura(id: keyof typeof TONS): Figurino {
  const t = TONS[id];
  return {
    id,
    nome: id === "criatura_vulto" ? "Vulto" : "Os de baixo",
    prop,
    semRosto: true,
    semContorno: true,
    maoR: 12,
    cores: { pele: t.corpo, manga: t.corpo, perna: t.corpo, pe: t.corpo, sobrancelha: t.sombra },
    tronco: (v) => tronco(t, v),
    cabeca: (v) => cabeca(t, v),
    pe: () => pe(t),
  };
}

export const OPACIDADE = Object.fromEntries(Object.entries(TONS).map(([k, t]) => [k, t.opacidade]));
