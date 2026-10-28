// Dona Socorro: vende pão de queijo na Rodoviária há 30 anos (bíblia, seção 4).
import { CONTORNO } from "../../../engine/rig/rosto";
import type { Figurino, VistaBase } from "../../../engine/rig/tipos";

const C = {
  avental: "#7FB3D5",
  aventalEscuro: "#5F95B8",
  vestido: "#C0504D",
  pontos: "#F2E6CF",
  cabelo: "#BFBFBF",
  cabeloEscuro: "#9C9C9C",
  pele: "#A8754F",
  sandalia: "#5A3E2B",
  isopor: "#F4F4F0",
  isoporSombra: "#D9D9D2",
  alca: "#D23A2E",
};

const prop = {
  quadril: 195, quadrilX: 38, coxa: 90, canela: 85,
  ombro: 185, ombroX: 92, braco: 88, antebraco: 78,
  cabeca: 318, cabecaR: 118, larguraPerna: 50, larguraBraco: 46,
};

const CAB_Y = -(prop.cabeca - prop.ombro - 8);

const corpo: Record<VistaBase, string> = {
  frente: "M-94 20 Q-116 -100 -90 -192 Q0 -214 90 -192 Q116 -100 94 20 Z",
  costas: "M-94 20 Q-116 -100 -90 -192 Q0 -214 90 -192 Q116 -100 94 20 Z",
  perfil: "M-56 20 Q-74 -100 -54 -192 Q0 -208 56 -192 Q92 -110 70 20 Z",
  "3/4": "M-84 20 Q-104 -100 -80 -192 Q6 -212 80 -192 Q108 -100 86 20 Z",
};

const saiaPath: Record<VistaBase, string> = {
  frente: "M-98 -12 L-120 112 Q0 126 120 112 L98 -12 Z",
  costas: "M-98 -12 L-120 112 Q0 126 120 112 L98 -12 Z",
  perfil: "M-60 -12 L-78 112 Q4 122 90 112 L70 -12 Z",
  "3/4": "M-88 -12 L-110 112 Q0 126 110 112 L90 -12 Z",
};

/** pontinhos do vestido (fixos, sem sorteio) */
function pontos(x0: number, x1: number, y0: number, y1: number): string {
  let s = "";
  let linha = 0;
  for (let y = y0; y <= y1; y += 30, linha++) {
    for (let x = x0 + (linha % 2) * 15; x <= x1; x += 30) s += `<circle cx="${x}" cy="${y}" r="4.5" fill="${C.pontos}"/>`;
  }
  return s;
}


function tronco(v: VistaBase, px: string): string {
  const clip = `<clipPath id="${px}-clip"><path d="${corpo[v]}"/></clipPath>`;
  const babador: Record<VistaBase, string> = {
    frente: "M-52 -150 L52 -150 L64 20 L-64 20 Z",
    costas: "",
    perfil: "M30 -150 L58 -150 L76 20 L40 20 Z",
    "3/4": "M-26 -150 L66 -150 L82 20 L-20 20 Z",
  };
  const alcas: Record<VistaBase, string> = {
    frente: "M-48 -150 L-30 -200 M48 -150 L30 -200",
    costas: "M-40 -196 L-56 -60 M40 -196 L56 -60",
    perfil: "M34 -150 L14 -200",
    "3/4": "M-20 -150 L-8 -200 M62 -150 L50 -200",
  };
  const decote = v === "costas" ? "" : `<path d="M${v === "frente" ? -26 : v === "3/4" ? -10 : 18} -200 Q${v === "frente" ? 0 : v === "3/4" ? 14 : 34} -168 ${v === "frente" ? 26 : v === "3/4" ? 36 : 48} -200 Z" fill="${C.pele}"/>`;
  return (
    `<defs>${clip}</defs>` +
    `<path d="${corpo[v]}" fill="${C.vestido}"/>` +
    `<g clip-path="url(#${px}-clip)">${pontos(-120, 120, -190, 20)}</g>` +
    decote +
    (babador[v] ? `<path d="${babador[v]}" fill="${C.avental}"/>` : "") +
    `<path d="${alcas[v]}" stroke="${C.avental}" stroke-width="12" stroke-linecap="round" fill="none"/>`
  );
}

function saia(v: VistaBase, px: string): string {
  const id = `${px}-saia`;
  const avental: Record<VistaBase, string> = {
    frente: "M-70 -12 L-84 104 L84 104 L70 -12 Z",
    costas: "",
    perfil: "M40 -12 L52 104 L90 104 L74 -12 Z",
    "3/4": "M-30 -12 L-36 104 L104 104 L88 -12 Z",
  };
  const bolso: Record<VistaBase, string> = {
    frente: `<rect x="-44" y="22" width="88" height="44" rx="6" fill="${C.aventalEscuro}"/>`,
    costas: "",
    perfil: `<rect x="52" y="22" width="30" height="44" rx="6" fill="${C.aventalEscuro}"/>`,
    "3/4": `<rect x="10" y="22" width="76" height="44" rx="6" fill="${C.aventalEscuro}"/>`,
  };
  const laco = v === "costas" ? `<path d="M0 -6 Q-40 -30 -44 4 Q-30 16 0 -6 Q30 16 44 4 Q40 -30 0 -6 Z M-6 -4 L-18 50 M6 -4 L18 50" fill="${C.avental}" stroke="${C.avental}" stroke-width="10" stroke-linecap="round"/>` : "";
  return (
    `<defs><clipPath id="${id}"><path d="${saiaPath[v]}"/></clipPath></defs>` +
    `<path d="${saiaPath[v]}" fill="${C.vestido}"/>` +
    `<g clip-path="url(#${id})">${pontos(-130, 130, 0, 120)}</g>` +
    (avental[v] ? `<path d="${avental[v]}" fill="${C.avental}"/>` : "") +
    bolso[v] +
    laco
  );
}

const orelha = (x: number) => `<ellipse cx="${x}" cy="16" rx="17" ry="25" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/>`;
const coque = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="44" fill="${C.cabelo}" stroke="${CONTORNO}" stroke-width="6"/><path d="M${x - 30} ${y + 10} Q${x} ${y - 20} ${x + 30} ${y + 10}" stroke="${C.cabeloEscuro}" stroke-width="5" fill="none"/>`;

function cabeca(v: VistaBase): { base: string; topo: string } {
  const r = prop.cabecaR;
  const cranio = (cor: string) => `<circle cx="0" cy="0" r="${r}" fill="${cor}" stroke="${CONTORNO}" stroke-width="7"/>`;
  const cabelo = (d: string) => `<path d="${d}" fill="${C.cabelo}" stroke="${CONTORNO}" stroke-width="6" stroke-linejoin="round"/>`;
  switch (v) {
    case "frente":
      return {
        base: coque(0, -128) + orelha(-114) + orelha(114) + cranio(C.pele),
        topo:
          cabelo("M-116 -10 Q-122 -112 0 -120 Q122 -112 116 -10 Q100 -40 70 -52 Q30 -60 0 -84 Q-30 -60 -70 -52 Q-100 -40 -116 -10 Z") +
          `<path d="M0 -118 L0 -84" stroke="${C.cabeloEscuro}" stroke-width="5"/>`,
      };
    case "costas":
      return {
        base: orelha(-114) + orelha(114) + cranio(C.cabelo) + `<path d="M-50 96 Q0 120 50 96 L44 112 Q0 124 -44 112 Z" fill="${C.pele}"/>`,
        topo: coque(0, -118) + `<path d="M-90 -60 Q0 -90 90 -60" stroke="${C.cabeloEscuro}" stroke-width="5" fill="none"/>`,
      };
    case "perfil":
      return {
        base: coque(-62, -104) + cranio(C.pele),
        topo:
          cabelo("M-118 10 Q-124 -110 10 -120 Q90 -110 110 -40 Q60 -64 20 -60 Q-30 -40 -50 30 Q-90 60 -118 10 Z") +
          `<ellipse cx="-34" cy="18" rx="14" ry="22" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/>`,
      };
    case "3/4":
      return {
        base: coque(-36, -122) + cranio(C.pele),
        topo:
          cabelo("M-118 0 Q-124 -112 6 -120 Q114 -112 116 -20 Q90 -50 50 -58 Q10 -62 -20 -80 Q-60 -56 -84 -30 Q-100 0 -118 0 Z") +
          `<ellipse cx="-100" cy="16" rx="15" ry="23" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/>`,
      };
  }
}

function caixa(x: number, y: number, w: number, h: number): string {
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${C.isopor}" stroke="${CONTORNO}" stroke-width="6"/>` +
    `<rect x="${x + 6}" y="${y + h * 0.28}" width="${w - 12}" height="8" fill="${C.isoporSombra}"/>`
  );
}

export const socorro: Figurino = {
  id: "socorro",
  nome: "Dona Socorro",
  prop,
  cores: { pele: C.pele, manga: C.vestido, antebraco: C.pele, perna: C.pele, pe: C.sandalia, sobrancelha: "#6E6A66" },
  tronco,
  saia,
  cabeca: (v) => cabeca(v),
  pe: (v) =>
    v === "frente" || v === "costas"
      ? `<rect x="-30" y="-4" width="60" height="26" rx="11" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/><path d="M-26 6 L26 6" stroke="${C.sandalia}" stroke-width="9"/><rect x="-32" y="16" width="64" height="8" rx="4" fill="${C.sandalia}"/>`
      : `<rect x="-22" y="-4" width="${v === "3/4" ? 58 : 70}" height="26" rx="11" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/><path d="M0 6 L30 6" stroke="${C.sandalia}" stroke-width="9"/><rect x="-24" y="16" width="${v === "3/4" ? 62 : 74}" height="8" rx="4" fill="${C.sandalia}"/>`,
  acessorios: {
    // isopor pendurado pela alça, na mão direita
    isopor_mao: {
      junta: "mao_d",
      padrao: true,
      atras: true,
      pendurado: true,
      desenhar: (v) => {
        const w = v === "perfil" ? 80 : 120;
        return `<path d="M-30 50 Q0 -6 30 50" stroke="${C.alca}" stroke-width="10" fill="none"/>` + caixa(-w / 2, 44, w, 86);
      },
    },
    // isopor abraçado contra o peito
    isopor_peito: {
      junta: "tronco",
      padrao: false,
      desenhar: (v) => {
        const x = v === "perfil" ? 20 : v === "3/4" ? -40 : -80;
        const w = v === "perfil" ? 90 : 150;
        return `<path d="M${x + 20} -140 Q${x + w / 2} -190 ${x + w - 20} -140" stroke="${C.alca}" stroke-width="10" fill="none"/>` + caixa(x, -146, w, 104);
      },
    },
  },
};
