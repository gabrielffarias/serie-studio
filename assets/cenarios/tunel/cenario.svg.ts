// Túnel: trilho, cabos na parede, poças, luz só da lanterna (bíblia, seção 5).
import type { Cenario } from "../../../engine/cenario/tipos";

const C = {
  fundo: "#121418",
  parede: "#2E3136",
  paredeClara: "#3A3E44",
  junta: "#24272B",
  chao: "#2A2C2F",
  brita: "#35373A",
  trilho: "#8A8F96",
  dormente: "#4A3B30",
  cabo: ["#1B1D21", "#3B2A22", "#24303A"],
  poca: "#1E2933",
  reflexo: "#3E5568",
};

// ponto de fuga do túnel
const PF = { x: 540, y: 980 };

export const tunel: Cenario = {
  id: "tunel",
  descricao: "Túnel escuro do metrô: trilhos até o ponto de fuga, cabos na parede, poças. A luz vem só da lanterna.",
  chaoY: 1480,
  ancoras: {
    fundo_tunel: PF,
    trilho: { x: 540, y: 1600 },
    parede_esq: { x: 160, y: 900 },
    parede_dir: { x: 920, y: 900 },
    poca: { x: 800, y: 1560 },
    chao: { x: 540, y: 1480 },
  },
  fundo: (px) =>
    `<defs><radialGradient id="${px}-boca" cx=".5" cy=".51" r=".5"><stop offset="0" stop-color="#050608"/><stop offset=".35" stop-color="${C.fundo}"/><stop offset="1" stop-color="${C.parede}"/></radialGradient></defs>` +
    `<rect width="1080" height="1920" fill="url(#${px}-boca)"/>` +
    // anéis de concreto em perspectiva (de longe para perto)
    [0.14, 0.24, 0.38, 0.58, 0.86]
      .map((k) => {
        const w = 540 * k * 2.2, h = 880 * k * 1.4;
        return `<path d="M${PF.x - w} ${PF.y + h * 0.55} L${PF.x - w} ${PF.y - h * 0.25} Q${PF.x - w} ${PF.y - h * 0.9} ${PF.x} ${PF.y - h * 0.92} Q${PF.x + w} ${PF.y - h * 0.9} ${PF.x + w} ${PF.y - h * 0.25} L${PF.x + w} ${PF.y + h * 0.55}" stroke="${C.junta}" stroke-width="${4 + k * 14}" fill="none"/>`;
      })
      .join("") +
    // cabos na parede esquerda e direita
    C.cabo
      .map((cor, i) => {
        const y = 620 + i * 46;
        return (
          `<path d="M0 ${y} Q260 ${y + 60} ${PF.x - 60} ${PF.y - 120 + i * 10}" stroke="${cor}" stroke-width="${18 - i * 3}" fill="none"/>` +
          `<path d="M1080 ${y + 30} Q820 ${y + 100} ${PF.x + 60} ${PF.y - 110 + i * 10}" stroke="${cor}" stroke-width="${18 - i * 3}" fill="none"/>`
        );
      })
      .join("") +
    [220, 420].map((y) => `<rect x="18" y="${640 + y}" width="40" height="60" rx="6" fill="${C.paredeClara}"/><rect x="1022" y="${640 + y}" width="40" height="60" rx="6" fill="${C.paredeClara}"/>`).join("") +
    // chão com brita, dormentes e trilhos convergindo
    `<path d="M0 1920 L0 1480 L${PF.x - 60} ${PF.y + 40} L${PF.x + 60} ${PF.y + 40} L1080 1480 L1080 1920 Z" fill="${C.chao}"/>` +
    Array.from({ length: 9 }, (_, i) => {
      const k = Math.pow((i + 1) / 9, 1.8);
      const y = PF.y + 40 + (1920 - PF.y) * k;
      const w = 60 + 560 * k;
      return `<path d="M${PF.x - w} ${y} L${PF.x + w} ${y}" stroke="${C.dormente}" stroke-width="${4 + 30 * k}"/>`;
    }).join("") +
    `<path d="M${PF.x - 22} ${PF.y + 40} L250 1920 M${PF.x + 22} ${PF.y + 40} L830 1920" stroke="${C.trilho}" stroke-width="14"/>` +
    `<path d="M${PF.x - 22} ${PF.y + 40} L250 1920 M${PF.x + 22} ${PF.y + 40} L830 1920" stroke="#B9BEC4" stroke-width="4" transform="translate(-4 0)"/>` +
    // poças
    `<ellipse cx="820" cy="1580" rx="150" ry="34" fill="${C.poca}"/><path d="M720 1574 L820 1572" stroke="${C.reflexo}" stroke-width="6" stroke-linecap="round"/>` +
    `<ellipse cx="200" cy="1760" rx="120" ry="28" fill="${C.poca}"/>`,
};
