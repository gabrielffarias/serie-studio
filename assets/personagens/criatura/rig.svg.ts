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

// ~metade da altura de um adulto mesmo curvada (folha lineup)
const prop = {
  quadril: 150, quadrilX: 22, coxa: 70, canela: 64,
  ombro: 104, ombroX: 44, braco: 96, antebraco: 90,
  cabeca: 168, cabecaR: 60, larguraPerna: 17, larguraBraco: 12,
};

function tronco(t: Tom, v: VistaBase): string {
  // costas arqueadas: os ombros sobem acima do pescoço (a cabeça pende entre eles)
  const corpo: Record<VistaBase, string> = {
    frente: "M-40 14 Q-50 -50 -54 -110 Q-58 -158 -26 -146 Q0 -112 26 -146 Q58 -158 54 -110 Q50 -50 40 14 Z",
    costas: "M-40 14 Q-50 -50 -54 -110 Q-58 -160 -24 -150 Q0 -134 24 -150 Q58 -160 54 -110 Q50 -50 40 14 Z",
    perfil: "M-26 14 Q-44 -50 -40 -110 Q-34 -156 6 -146 Q34 -128 30 -96 Q34 -40 28 14 Z",
    "3/4": "M-36 14 Q-50 -50 -50 -110 Q-52 -156 -16 -146 Q8 -116 34 -136 Q52 -136 46 -96 Q46 -46 36 14 Z",
  };
  const costelas =
    v === "costas"
      ? `<path d="M0 -118 L0 8" stroke="${t.sombra}" stroke-width="6" stroke-linecap="round"/>` +
        [-96, -74, -52, -30].map((y) => `<circle cx="0" cy="${y}" r="5" fill="${t.sombra}"/>`).join("")
      : [-80, -62, -44]
          .map((y) => {
            const w = v === "perfil" ? 20 : 34;
            return `<path d="M${-w} ${y} Q0 ${y + 7} ${w} ${y}" stroke="${t.sombra}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
          })
          .join("");
  return `<path d="${corpo[v]}" fill="${t.corpo}"/>` + costelas;
}

/**
 * Membrana de morcego: varetas saindo da base, borda recortada em arcos entre
 * as pontas, um rasgo em V e um furo (fill-rule evenodd). Desenhada para a direita.
 */
function membrana(t: Tom, lado: 1 | -1, escala = 1): string {
  const tr = `transform="scale(${lado * escala} ${escala})"`;
  const forma =
    "M36 -20 Q80 -96 150 -158 Q144 -118 168 -96 Q142 -84 154 -52 L136 -48 L146 -30 L128 -26 Q124 -6 134 8 Q96 4 72 30 Q54 36 40 26 Z" +
    " M104 -76 L116 -86 L120 -70 L110 -64 Z";
  const varetas = "M46 -6 L150 -158 M48 0 L168 -96 M50 6 L154 -52 M50 12 L134 8";
  return (
    `<path ${tr} d="${forma}" fill="${t.sombra}" fill-rule="evenodd"/>` +
    `<path ${tr} d="${varetas}" stroke="${t.membrana}" stroke-width="4" fill="none" stroke-linecap="round"/>`
  );
}

/** Cabeça estreita e comprida, queixo em ponta, sem olhos; pende abaixo da linha dos ombros. */
function cabeca(t: Tom, v: VistaBase): { base: string; topo: string } {
  const forma = (w: number) => `M0 -62 Q${w} -58 ${w} -8 Q${w - 4} 36 10 70 Q0 78 -10 70 Q${-w + 4} 36 ${-w} -8 Q${-w} -58 0 -62 Z`;
  // sombra projetada no peito: separa a cabeça do tronco (mesma cor, sem contorno)
  const cranio = (w: number) =>
    `<path transform="translate(0 12) scale(1.12)" d="${forma(w)}" fill="${t.sombra}"/><path d="${forma(w)}" fill="${t.corpo}"/>`;
  const focinho = "M-34 -44 Q0 -60 30 -36 Q56 -8 70 46 Q58 62 32 52 Q-6 36 -32 10 Q-44 -18 -34 -44 Z";
  const baixa = (dx: number, dy: number, s: string) => `<g transform="translate(${dx} ${dy})">${s}</g>`;
  switch (v) {
    case "frente":
    case "costas":
      return { base: baixa(0, 84, membrana(t, 1, 0.62) + membrana(t, -1, 0.62) + cranio(40)), topo: "" };
    case "perfil":
      // focinho para a frente e para baixo; a membrana fica para trás
      return {
        base: baixa(66, 56, `<g transform="scale(0.82)">` + membrana(t, -1, 0.7) + `<path transform="translate(-4 10) scale(1.1)" d="${focinho}" fill="${t.sombra}"/><path d="${focinho}" fill="${t.corpo}"/></g>`),
        topo: "",
      };
    case "3/4":
      return { base: baixa(40, 70, membrana(t, -1, 0.66) + membrana(t, 1, 0.46) + cranio(38)), topo: "" };
  }
}

/** Mão: palma pequena e três dedos compridos e finos, curvos como garras. */
function mao(t: Tom, v: VistaBase): string {
  const frontal = v === "frente" || v === "costas";
  const dedos = frontal
    ? "M0 4 Q-14 26 -12 46 M0 6 Q2 30 0 50 M0 4 Q14 26 12 46"
    : "M0 4 Q16 24 26 42 M0 6 Q8 30 12 50 M0 4 Q-2 28 -6 46";
  return `<circle cx="0" cy="2" r="9" fill="${t.corpo}"/><path d="${dedos}" stroke="${t.corpo}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
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
    maoR: 9,
    mao: (v) => mao(t, v),
    cores: { pele: t.corpo, manga: t.corpo, perna: t.corpo, pe: t.corpo, sobrancelha: t.sombra },
    tronco: (v) => tronco(t, v),
    cabeca: (v) => cabeca(t, v),
    pe: () => pe(t),
  };
}

export const OPACIDADE = Object.fromEntries(Object.entries(TONS).map(([k, t]) => [k, t.opacidade]));
