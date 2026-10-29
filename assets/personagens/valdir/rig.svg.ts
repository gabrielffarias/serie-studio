// Dr. Valdir: servidor público da (fictícia) COE (bíblia, seção 4).
import { CONTORNO } from "../../../engine/rig/rosto";
import type { Figurino, VistaBase } from "../../../engine/rig/tipos";

const C = {
  terno: "#4A4E57",
  dobra: "#363941",
  gravata: "#7A1F2B",
  camisa: "#E9EDF2",
  pasta: "#7B4A2A",
  pastaEscura: "#5C3620",
  pele: "#E8C9A8",
  cabelo: "#9A9A9A",
  sapato: "#2A1E18",
};

// ~5% mais alto que o Caio e um pouco mais encorpado
const prop = {
  quadril: 232, quadrilX: 40, coxa: 112, canela: 100,
  ombro: 212, ombroX: 93, braco: 101, antebraco: 89,
  cabeca: 352, cabecaR: 118, larguraPerna: 56, larguraBraco: 50,
};

const corpo: Record<VistaBase, string> = {
  frente: "M-88 40 Q-100 -90 -88 -210 Q0 -232 88 -210 Q100 -90 88 40 Z",
  costas: "M-88 40 Q-100 -90 -88 -210 Q0 -232 88 -210 Q100 -90 88 40 Z",
  perfil: "M-54 40 Q-66 -90 -52 -210 Q0 -226 54 -210 Q70 -90 60 40 Z",
  "3/4": "M-80 40 Q-94 -90 -78 -210 Q6 -230 78 -210 Q92 -90 82 40 Z",
};

function tronco(v: VistaBase): string {
  const base = `<path d="${corpo[v]}" fill="${C.terno}"/>`;
  switch (v) {
    case "frente":
      return (
        base +
        `<path d="M-34 -214 L0 -104 L34 -214 Z" fill="${C.camisa}"/>` +
        `<path d="M-10 -200 L10 -200 L14 -120 L0 -100 L-14 -120 Z" fill="${C.gravata}"/>` +
        `<path d="M-40 -212 L-6 -98 M40 -212 L6 -98" stroke="${C.dobra}" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="M0 -98 L0 40" stroke="${C.dobra}" stroke-width="5"/>` +
        `<circle cx="-12" cy="-60" r="6" fill="${C.dobra}"/><circle cx="-12" cy="-20" r="6" fill="${C.dobra}"/>` +
        `<path d="M-70 -40 L-30 -40" stroke="${C.dobra}" stroke-width="6" stroke-linecap="round"/>`
      );
    case "costas":
      return base + `<path d="M0 -220 L0 40" stroke="${C.dobra}" stroke-width="5"/><path d="M-30 -226 Q0 -236 30 -226 L24 -210 Q0 -218 -24 -210 Z" fill="${C.camisa}"/>`;
    case "perfil":
      return (
        base +
        `<path d="M30 -214 L58 -204 L56 -120 L40 -120 Z" fill="${C.camisa}"/>` +
        `<path d="M46 -200 L60 -196 L62 -110 L52 -100 Z" fill="${C.gravata}"/>` +
        `<path d="M28 -212 Q40 -150 40 -110" stroke="${C.dobra}" stroke-width="8" fill="none" stroke-linecap="round"/>`
      );
    case "3/4":
      return (
        base +
        `<path d="M-8 -218 L24 -104 L54 -214 Z" fill="${C.camisa}"/>` +
        `<path d="M14 -202 L32 -202 L36 -120 L24 -102 L12 -120 Z" fill="${C.gravata}"/>` +
        `<path d="M-12 -214 L18 -98 M58 -212 L30 -98" stroke="${C.dobra}" stroke-width="8" stroke-linecap="round"/>` +
        `<path d="M22 -98 L18 40" stroke="${C.dobra}" stroke-width="5"/>` +
        `<circle cx="10" cy="-60" r="6" fill="${C.dobra}"/><circle cx="9" cy="-20" r="6" fill="${C.dobra}"/>`
      );
  }
}

const orelha = (x: number) => `<ellipse cx="${x}" cy="18" rx="17" ry="26" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/>`;
const lente = (x: number, rx = 22) => `<ellipse cx="${x}" cy="24" rx="${rx}" ry="21" fill="none" stroke="${CONTORNO}" stroke-width="4"/>`;

function cabeca(v: VistaBase): { base: string; topo: string } {
  const r = prop.cabecaR;
  const cranio = `<circle cx="0" cy="0" r="${r}" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="7"/>`;
  const lateral = (d: string) => `<path d="${d}" fill="${C.cabelo}"/>`;
  switch (v) {
    case "frente":
      return {
        base:
          orelha(-114) + orelha(114) + cranio +
          lateral("M-114 -24 Q-120 10 -108 44 L-96 40 Q-102 10 -98 -24 Z") +
          lateral("M114 -24 Q120 10 108 44 L96 40 Q102 10 98 -24 Z") +
          `<path d="M-30 -90 Q0 -100 30 -90" stroke="#D9B48F" stroke-width="6" fill="none" stroke-linecap="round"/>`,
        topo: lente(-40) + lente(40) + `<path d="M-18 22 Q0 14 18 22" stroke="${CONTORNO}" stroke-width="4" fill="none"/>`,
      };
    case "costas":
      return {
        base: orelha(-114) + orelha(114) + cranio + lateral("M-112 -20 Q-110 60 -40 100 Q0 110 40 100 Q110 60 112 -20 Q60 20 0 24 Q-60 20 -112 -20 Z"),
        topo: "",
      };
    case "perfil":
      return {
        base:
          cranio + lateral("M-116 -20 Q-118 50 -70 90 Q-40 60 -36 0 Q-46 -20 -60 -26 Z") +
          `<ellipse cx="-40" cy="18" rx="15" ry="23" fill="${C.pele}" stroke="${CONTORNO}" stroke-width="5"/>` +
          `<path d="M-36 8 Q-46 18 -38 30" stroke="${CONTORNO}" stroke-width="4" fill="none" stroke-linecap="round"/>`,
        topo: lente(78, 16) + `<path d="M62 22 L-26 12" stroke="${CONTORNO}" stroke-width="4"/>`,
      };
    case "3/4":
      return {
        base: cranio + lateral("M-116 -20 Q-122 30 -100 70 L-84 62 Q-98 20 -94 -24 Z") + orelha(-104),
        topo: lente(2) + lente(66, 18) + `<path d="M24 22 Q34 15 48 22" stroke="${CONTORNO}" stroke-width="4" fill="none"/><path d="M-20 22 L-86 12" stroke="${CONTORNO}" stroke-width="4"/>`,
      };
  }
}

function pasta(x: number, y: number, w: number, h: number): string {
  return (
    `<path d="M${x + w / 2 - 20} ${y} L${x + w / 2 - 20} ${y - 16} L${x + w / 2 + 20} ${y - 16} L${x + w / 2 + 20} ${y}" stroke="${C.pastaEscura}" stroke-width="8" fill="none" stroke-linejoin="round"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${C.pasta}" stroke="${CONTORNO}" stroke-width="6"/>` +
    `<path d="M${x} ${y + h * 0.35} L${x + w} ${y + h * 0.35}" stroke="${C.pastaEscura}" stroke-width="5"/>` +
    `<rect x="${x + w / 2 - 9}" y="${y + h * 0.35 - 7}" width="18" height="14" rx="3" fill="#C9A44A"/>`
  );
}

export const valdir: Figurino = {
  id: "valdir",
  nome: "Dr. Valdir",
  prop,
  // o terno foi desenhado para ombro 205 e meia largura 88
  escalaTronco: { x: 1.1, y: 212 / 205 },
  cores: { pele: C.pele, manga: C.terno, perna: C.terno, pe: C.sapato, sobrancelha: "#7A7A7A" },
  tronco: (v) => tronco(v),
  cabeca: (v) => cabeca(v),
  acessorios: {
    pasta: {
      junta: "mao_d",
      padrao: true,
      atras: true,
      pendurado: true,
      desenhar: (v) => (v === "perfil" ? pasta(-14, 40, 28, 90) : pasta(-62, 40, 124, 88)),
    },
    pasta_peito: {
      junta: "tronco",
      padrao: false,
      desenhar: (v) => (v === "perfil" ? pasta(36, -170, 30, 110) : v === "3/4" ? pasta(-40, -170, 130, 100) : pasta(-72, -170, 144, 100)),
    },
  },
};
