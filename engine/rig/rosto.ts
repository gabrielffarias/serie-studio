// Rosto mínimo (decisão de 2026-10-28): olhos ovais pequenos, a sobrancelha
// carrega a expressão, boca só quando a emoção pede. Criatura não usa isto.
import { EXPRESSOES, type Expressao, type VistaBase } from "./tipos";

export const CONTORNO = "#2A2420";

/** altura dos olhos abaixo do centro da cabeça (deixa espaço para aba de boné) */
const OLHO_Y = 24;

type Olho = { x: number; y: number; esc: number; interno: 1 | -1 };

/** Posições dos olhos na cabeça (centro da cabeça = 0,0; raio 118), olhando à direita. */
function olhos(v: VistaBase, r: number): Olho[] {
  const k = r / 118;
  const y = OLHO_Y * k;
  switch (v) {
    case "frente":
      return [
        { x: -40 * k, y, esc: 1, interno: 1 },
        { x: 40 * k, y, esc: 1, interno: -1 },
      ];
    case "3/4":
      return [
        { x: 2 * k, y, esc: 1, interno: 1 },
        { x: 66 * k, y, esc: 0.85, interno: -1 },
      ];
    case "perfil":
      return [{ x: 74 * k, y, esc: 1, interno: 1 }];
    case "costas":
      return [];
  }
}

/** Deslocamento [ponta interna, ponta externa] da sobrancelha (negativo = sobe). */
const SOBRANCELHA: Record<Expressao, [number, number] | "assimetrica"> = {
  neutro: [0, 0],
  medo: [-12, 5],
  surpresa: [-16, -10],
  alivio: [-6, -3],
  determinado: [10, -4],
  desconfiado: "assimetrica",
};

function sobrancelha(o: Olho, e: Expressao, idx: number, cor: string, k: number): string {
  const meio = 22 * k * o.esc;
  const yBase = o.y - 34 * k;
  let [din, dex] = SOBRANCELHA[e] === "assimetrica" ? (idx === 0 ? [6, 6] : [-12, -6]) : (SOBRANCELHA[e] as [number, number]);
  din *= k;
  dex *= k;
  const xin = o.x + o.interno * meio;
  const xex = o.x - o.interno * meio;
  return `<path d="M${xex.toFixed(1)} ${(yBase + dex).toFixed(1)} L${xin.toFixed(1)} ${(yBase + din).toFixed(1)}" stroke="${cor}" stroke-width="${(11 * k).toFixed(1)}" stroke-linecap="round" fill="none"/>`;
}

function boca(v: VistaBase, e: Expressao, k: number): string {
  const x = v === "frente" ? 0 : v === "3/4" ? 36 * k : 84 * k;
  const y = (OLHO_Y + 48) * k;
  switch (e) {
    case "medo":
      return `<ellipse cx="${x}" cy="${y}" rx="${9 * k}" ry="${11 * k}" fill="${CONTORNO}"/>`;
    case "surpresa":
      return `<ellipse cx="${x}" cy="${y + 4 * k}" rx="${13 * k}" ry="${17 * k}" fill="${CONTORNO}"/>`;
    case "alivio": {
      const w = (v === "perfil" ? 12 : 20) * k;
      return `<path d="M${x - w} ${y - 4 * k} Q${x} ${y + 12 * k} ${x + w} ${y - 4 * k}" stroke="${CONTORNO}" stroke-width="${7 * k}" stroke-linecap="round" fill="none"/>`;
    }
    default:
      return "";
  }
}

/** Um grupo por expressão; o motor liga a da pose atual por opacidade. */
export function desenharRostos(prefixo: string, v: VistaBase, r: number, corSobrancelha: string): string {
  if (v === "costas") return "";
  const k = r / 118;
  const os = olhos(v, r);
  const olhosSvg = os
    .map((o) => `<ellipse cx="${o.x.toFixed(1)}" cy="${o.y.toFixed(1)}" rx="${(9 * k * o.esc).toFixed(1)}" ry="${(13 * k).toFixed(1)}" fill="${CONTORNO}"/>`)
    .join("");
  const grupos = EXPRESSOES.map((e) => {
    const s = os.map((o, i) => sobrancelha(o, e, i, corSobrancelha, k)).join("");
    return `<g id="${prefixo}-rosto-${e}" opacity="${e === "neutro" ? 1 : 0}">${s}${boca(v, e, k)}</g>`;
  }).join("");
  return olhosSvg + grupos;
}
