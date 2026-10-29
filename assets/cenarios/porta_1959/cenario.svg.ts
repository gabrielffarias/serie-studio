// Porta de aço redonda, selada, com placa da COE (bíblia, seção 5).
// Vista no EP2 (fechada), aberta no EP8 (estado "aberta").
import type { Cenario } from "../../../engine/cenario/tipos";

const C = {
  parede: "#6B675F",
  paredeEscura: "#55524B",
  aco: "#8D949B",
  acoClaro: "#A9AFB5",
  acoEscuro: "#5E646A",
  ferrugem: "#7A4A2A",
  placa: "#C9B98A",
  placaTexto: "#2A2420",
  piso: "#4E4B45",
  contorno: "#2A2420",
  escuro: "#07080A",
};

const P = { x: 540, y: 880, r: 330 };

function parafusos(r: number, n: number): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `<circle cx="${(P.x + Math.cos(a) * r).toFixed(1)}" cy="${(P.y + Math.sin(a) * r).toFixed(1)}" r="11" fill="${C.acoEscuro}" stroke="${C.contorno}" stroke-width="4"/>`;
  }).join("");
}

function roda(): string {
  const raios = [0, 60, 120].map((g) => `<path d="M${P.x} ${P.y - 110} L${P.x} ${P.y + 110}" transform="rotate(${g} ${P.x} ${P.y})" stroke="${C.acoEscuro}" stroke-width="18" stroke-linecap="round"/>`).join("");
  return `<circle cx="${P.x}" cy="${P.y}" r="110" fill="none" stroke="${C.acoEscuro}" stroke-width="22"/>` + raios + `<circle cx="${P.x}" cy="${P.y}" r="30" fill="${C.acoClaro}" stroke="${C.contorno}" stroke-width="5"/>`;
}

export const porta_1959: Cenario = {
  id: "porta_1959",
  descricao: "Porta de aço redonda e selada numa parede de concreto antigo, com a placa COMISSÃO DE OBRAS ESPECIAIS · ACESSO PROIBIDO · 1959.",
  chaoY: 1480,
  estados: ["fechada", "aberta"],
  ancoras: {
    porta: { x: P.x, y: P.y },
    roda: { x: P.x, y: P.y },
    placa: { x: 540, y: 1330 },
    chao: { x: 540, y: 1480 },
  },
  fundo: (px) =>
    `<rect width="1080" height="1480" fill="${C.parede}"/>` +
    [260, 560, 860, 1160].map((y) => `<path d="M0 ${y} L1080 ${y}" stroke="${C.paredeEscura}" stroke-width="8"/>`).join("") +
    [200, 880].map((x) => `<path d="M${x} 0 L${x + 6} 1480" stroke="${C.paredeEscura}" stroke-width="6"/>`).join("") +
    // batente
    `<circle cx="${P.x}" cy="${P.y}" r="${P.r + 40}" fill="${C.acoEscuro}" stroke="${C.contorno}" stroke-width="7"/>` +
    // fechada
    `<g id="${px}-fechada">` +
    `<circle cx="${P.x}" cy="${P.y}" r="${P.r}" fill="${C.aco}" stroke="${C.contorno}" stroke-width="7"/>` +
    `<circle cx="${P.x}" cy="${P.y}" r="${P.r - 60}" fill="none" stroke="${C.acoClaro}" stroke-width="10"/>` +
    `<circle cx="${P.x}" cy="${P.y}" r="${P.r - 130}" fill="none" stroke="${C.acoEscuro}" stroke-width="8"/>` +
    parafusos(P.r - 28, 24) +
    roda() +
    `<path d="M${P.x + 140} ${P.y + 160} Q${P.x + 150} ${P.y + 250} ${P.x + 136} ${P.y + 320}" stroke="${C.ferrugem}" stroke-width="12" fill="none" opacity=".7"/>` +
    `<path d="M${P.x - 200} ${P.y + 120} Q${P.x - 196} ${P.y + 200} ${P.x - 210} ${P.y + 280}" stroke="${C.ferrugem}" stroke-width="9" fill="none" opacity=".6"/>` +
    `</g>` +
    // aberta: buraco escuro e a folha girada para o lado
    `<g id="${px}-aberta" opacity="0">` +
    `<circle cx="${P.x}" cy="${P.y}" r="${P.r}" fill="${C.escuro}"/>` +
    `<path d="M${P.x - 60} ${P.y + 250} L${P.x - 40} ${P.y + 120} L${P.x + 40} ${P.y + 120} L${P.x + 60} ${P.y + 250} Z" fill="#141519"/>` +
    `<ellipse cx="${P.x + P.r + 60}" cy="${P.y}" rx="70" ry="${P.r}" fill="${C.aco}" stroke="${C.contorno}" stroke-width="7"/>` +
    `</g>` +
    // placa
    `<rect x="250" y="1260" width="580" height="150" rx="8" fill="${C.placa}" stroke="${C.contorno}" stroke-width="6"/>` +
    `<text x="540" y="1312" text-anchor="middle" font-family="InterHF, Inter, sans-serif" font-weight="800" font-size="30" fill="${C.placaTexto}">COMISSÃO DE OBRAS ESPECIAIS</text>` +
    `<text x="540" y="1356" text-anchor="middle" font-family="InterHF, Inter, sans-serif" font-weight="800" font-size="34" fill="#8B1E14">ACESSO PROIBIDO</text>` +
    `<text x="540" y="1394" text-anchor="middle" font-family="InterHF, Inter, sans-serif" font-weight="800" font-size="28" fill="${C.placaTexto}">1959</text>` +
    `<rect y="1480" width="1080" height="440" fill="${C.piso}"/>` +
    `<rect y="1480" width="1080" height="14" fill="${C.paredeEscura}"/>`,
};
