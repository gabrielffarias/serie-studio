// Interior do vagão: bancos azuis, barras amarelas, janelas escuras (bíblia, seção 5).
// Sem logo, marca ou nome do Metrô-DF.
import type { Cenario } from "../../../engine/cenario/tipos";

const C = {
  teto: "#B9BCBE",
  luminaria: "#DADDD8",
  parede: "#D6D3CA",
  paredeBaixa: "#BDB8AC",
  janela: "#28303C",
  // lado de fora (parede do túnel com o reflexo da luz do vagão): um pouco mais
  // claro que o vidro, para o vulto escuro recortar
  fora: "#465266",
  reflexo: "#3A4452",
  moldura: "#8E949B",
  barra: "#F2C230",
  barraSombra: "#C99B12",
  banco: "#2E5C9A",
  bancoSombra: "#22467A",
  piso: "#5E6166",
  pisoLinha: "#4C4F54",
  contorno: "#2A2420",
};

function janela(x: number): string {
  return (
    `<rect x="${x - 14}" y="506" width="${308}" height="408" rx="34" fill="${C.moldura}"/>` +
    `<rect x="${x}" y="520" width="280" height="380" rx="26" fill="${C.janela}"/>` +
    `<rect x="${x + 18}" y="538" width="244" height="344" rx="16" fill="${C.fora}"/>` +
    `<path d="M${x + 30} 560 L${x + 90} 560 L${x + 20} 700 Z" fill="${C.reflexo}" opacity=".7"/>`
  );
}

export const vagao: Cenario = {
  id: "vagao",
  descricao: "Interior do vagão parado: janelas pretas, bancos azuis, barras amarelas, porta de emergência no meio.",
  chaoY: 1470,
  ancoras: {
    janela_esq: { x: 210, y: 710 },
    janela_dir: { x: 870, y: 710 },
    porta_emergencia: { x: 540, y: 900 },
    banco: { x: 540, y: 1250 },
    teto: { x: 540, y: 200 },
    chao: { x: 540, y: 1470 },
  },
  // as duas janelas grandes e as duas da porta
  recorteExterno: "M70 520 h280 v380 h-280 Z M730 520 h280 v380 h-280 Z M420 520 h100 v300 h-100 Z M560 520 h100 v300 h-100 Z",
  fundo: () =>
    // teto e luminárias apagadas
    `<rect width="1080" height="380" fill="${C.teto}"/>` +
    [140, 540, 940].map((x) => `<rect x="${x - 120}" y="120" width="240" height="56" rx="14" fill="${C.luminaria}" stroke="${C.moldura}" stroke-width="5"/>`).join("") +
    `<rect y="370" width="1080" height="20" fill="${C.moldura}"/>` +
    // parede com janelas
    `<rect y="390" width="1080" height="1080" fill="${C.parede}"/>` +
    janela(70) + janela(730) +
    // porta de emergência entre as janelas
    `<rect x="400" y="430" width="280" height="1040" fill="#C9C5BB" stroke="${C.moldura}" stroke-width="8"/>` +
    `<path d="M540 430 L540 1470" stroke="${C.moldura}" stroke-width="6"/>` +
    [420, 560].map((x) => `<rect x="${x}" y="520" width="100" height="300" rx="16" fill="${C.janela}"/><rect x="${x + 12}" y="532" width="76" height="276" rx="10" fill="${C.fora}"/>`).join("") +
    `<rect x="478" y="880" width="124" height="70" rx="8" fill="#D1271B" stroke="${C.contorno}" stroke-width="5"/>` +
    `<text data-layout-ignore x="540" y="926" text-anchor="middle" font-family="InterHF, Inter, sans-serif" font-weight="800" font-size="20" fill="#fff">EMERGÊNCIA</text>` +
    // faixa baixa e bancos
    `<rect y="1110" width="1080" height="360" fill="${C.paredeBaixa}"/>` +
    `<rect x="0" y="1080" width="400" height="150" rx="22" fill="${C.banco}"/><rect x="680" y="1080" width="400" height="150" rx="22" fill="${C.banco}"/>` +
    `<rect x="0" y="1230" width="400" height="60" rx="16" fill="${C.bancoSombra}"/><rect x="680" y="1230" width="400" height="60" rx="16" fill="${C.bancoSombra}"/>` +
    `<rect x="0" y="1290" width="400" height="180" fill="#3B3E44"/><rect x="680" y="1290" width="400" height="180" fill="#3B3E44"/>` +
    // barra horizontal e piso
    `<rect y="460" width="1080" height="22" rx="11" fill="${C.barra}"/>` +
    `<rect y="1470" width="1080" height="450" fill="${C.piso}"/>` +
    `<rect y="1470" width="1080" height="14" fill="${C.pisoLinha}"/>` +
    [1580, 1720, 1860].map((y) => `<path d="M0 ${y} L1080 ${y}" stroke="${C.pisoLinha}" stroke-width="4" opacity=".6"/>`).join("") +
    // barras verticais do fundo
    [380, 700].map((x) => `<rect x="${x - 12}" y="390" width="24" height="1080" fill="${C.barraSombra}"/>`).join(""),
  // barra vertical em primeiro plano (passa na frente dos personagens)
  frente: () =>
    `<rect x="40" y="0" width="46" height="1920" fill="${C.barra}"/><rect x="74" y="0" width="12" height="1920" fill="${C.barraSombra}"/>`,
};
