// Plataforma da estação fantasma: azulejos creme e verde-água inacabados,
// andaimes, sacos de cimento, letreiro "1959" pintado à mão (bíblia, seção 5).
import type { Cenario } from "../../../engine/cenario/tipos";

const C = {
  teto: "#6F6A60",
  concreto: "#8E8A80",
  concretoEscuro: "#77736A",
  creme: "#E9DFC6",
  agua: "#8FC9B9",
  rejunte: "#BDB29A",
  tinta: "#8B2E1F",
  andaime: "#7D848B",
  andaimeEscuro: "#5D646B",
  saco: "#CFC6AE",
  sacoSombra: "#ADA48C",
  piso: "#9A968C",
  borda: "#D9C24A",
  fosso: "#16181B",
  contorno: "#2A2420",
};

// azulejos: falhas fixas (sem sorteio) onde a parede ficou só no concreto
const FALTA = new Set(["7,3", "8,3", "8,4", "9,4", "9,5", "1,9", "2,9", "2,10", "0,10", "10,8", "10,9", "11,9", "6,11", "11,2"]);

function azulejos(): string {
  const tam = 90;
  let s = `<rect x="0" y="380" width="1080" height="1040" fill="${C.concreto}"/>`;
  for (let col = 0; col < 12; col++) {
    for (let lin = 0; lin < 12; lin++) {
      if (FALTA.has(`${col},${lin}`)) continue;
      const x = col * tam, y = 380 + lin * tam;
      if (y > 1330) continue;
      // faixa verde-água no meio da parede
      const cor = lin === 6 || lin === 7 ? C.agua : C.creme;
      s += `<rect x="${x + 3}" y="${y + 3}" width="${tam - 6}" height="${tam - 6}" fill="${cor}"/>`;
    }
  }
  return s;
}

function andaime(x: number): string {
  const tubo = (x1: number, y1: number, x2: number, y2: number) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${C.andaime}" stroke-width="16" stroke-linecap="round"/>`;
  return (
    tubo(x, 560, x, 1430) + tubo(x + 260, 560, x + 260, 1430) +
    tubo(x - 10, 700, x + 270, 700) + tubo(x - 10, 1060, x + 270, 1060) +
    tubo(x, 700, x + 260, 1060) +
    `<rect x="${x - 20}" y="1040" width="300" height="26" fill="#8A6A46" stroke="${C.contorno}" stroke-width="5"/>` +
    `<rect x="${x - 20}" y="680" width="300" height="26" fill="#8A6A46" stroke="${C.contorno}" stroke-width="5"/>`
  );
}

function saco(x: number, y: number): string {
  return `<path d="M${x - 70} ${y} Q${x - 80} ${y - 50} ${x - 60} ${y - 70} L${x + 60} ${y - 70} Q${x + 80} ${y - 50} ${x + 70} ${y} Z" fill="${C.saco}" stroke="${C.contorno}" stroke-width="5"/><path d="M${x - 50} ${y - 36} L${x + 50} ${y - 36}" stroke="${C.sacoSombra}" stroke-width="6"/>`;
}

export const plataforma_1959: Cenario = {
  id: "plataforma_1959",
  descricao: "Plataforma inacabada da Estação 1959: azulejos creme e verde-água com falhas, andaime, sacos de cimento, letreiro 1959 pintado à mão.",
  chaoY: 1490,
  ancoras: {
    letreiro: { x: 720, y: 620 },
    andaime: { x: 250, y: 900 },
    sacos: { x: 860, y: 1380 },
    borda: { x: 540, y: 1720 },
    chao: { x: 540, y: 1490 },
  },
  fundo: () =>
    `<rect width="1080" height="390" fill="${C.teto}"/>` +
    [180, 540, 900].map((x) => `<rect x="${x - 20}" y="0" width="40" height="390" fill="${C.concretoEscuro}"/>`).join("") +
    `<path d="M0 300 Q540 360 1080 300" stroke="#2B2C2E" stroke-width="10" fill="none"/>` +
    `<g><circle cx="540" cy="340" r="26" fill="#3A3A3A"/></g>` +
    azulejos() +
    // letreiro pintado à mão (um pouco torto)
    `<g transform="rotate(-3 720 620)"><rect x="560" y="540" width="330" height="160" fill="${C.creme}" opacity=".9"/>` +
    `<text x="725" y="668" text-anchor="middle" font-family="Anton, sans-serif" font-size="150" fill="${C.tinta}" letter-spacing="6">1959</text>` +
    `<path d="M610 690 L612 730 M770 692 L771 744 M842 690 L843 720" stroke="${C.tinta}" stroke-width="6" stroke-linecap="round"/></g>` +
    andaime(120) +
    // piso, borda e fosso dos trilhos
    `<rect y="1420" width="1080" height="300" fill="${C.piso}"/>` +
    `<rect y="1420" width="1080" height="14" fill="${C.concretoEscuro}"/>` +
    `<rect y="1700" width="1080" height="26" fill="${C.borda}"/>` +
    `<rect y="1726" width="1080" height="194" fill="${C.fosso}"/>`,
  frente: () => saco(800, 1500) + saco(950, 1500) + saco(875, 1432),
};
