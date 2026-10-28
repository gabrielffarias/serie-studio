// Camadas de luz por cima da cena (engine/STYLE.md: gradiente só aqui e no fundo).
// A parte animada (piscar, apagão, lanterna balançando) vem em keyframes no compose.
import type { Keyframe } from "../core/keyframes";
import { rng } from "../core/rng";

export const LUZES = ["normal", "escuro", "emergencia_vermelha", "lanterna", "apagao"] as const;
export type Luz = (typeof LUZES)[number];

export type OrigemLanterna = {
  x: number;
  y: number;
  /** graus; 0 = para a direita */
  angulo: number;
  /** de costas para a câmera: em vez de cone, um círculo de luz no alvo */
  alvo?: { x: number; y: number };
};

/** escuridão em volta do feixe: forte, mas deixando as silhuetas legíveis no celular */
const ESCURO_LANTERNA = 0.84;

/** Overlay estático da luz base do plano. Ids: `${px}-luz`, `${px}-cone`. */
export function camadaLuz(px: string, luz: Luz, lanterna?: OrigemLanterna): string {
  switch (luz) {
    case "normal":
      return `<rect id="${px}-luz" width="1080" height="1920" fill="#000" opacity="0"/>`;
    case "escuro":
      return `<rect id="${px}-luz" width="1080" height="1920" fill="#05070C" opacity=".55"/>`;
    case "apagao":
      return `<rect id="${px}-luz" width="1080" height="1920" fill="#030406" opacity=".93"/>`;
    case "emergencia_vermelha":
      // mesma receita da cena-exemplo
      return (
        `<defs><radialGradient id="${px}-alarme" cx=".5" cy=".18" r=".8">` +
        `<stop offset="0" stop-color="#ff2a1a" stop-opacity=".55"/><stop offset=".45" stop-color="#8a0d06" stop-opacity=".35"/>` +
        `<stop offset="1" stop-color="#05070c" stop-opacity=".78"/></radialGradient></defs>` +
        `<rect id="${px}-luz" width="1080" height="1920" fill="url(#${px}-alarme)"/>`
      );
    case "lanterna": {
      const o = lanterna ?? { x: 540, y: 700, angulo: 90 };
      // escuridão com um cone recortado (máscara) e um brilho suave dentro do cone
      const alcance = 1500, abertura = 26;
      const a1 = ((o.angulo - abertura) * Math.PI) / 180, a2 = ((o.angulo + abertura) * Math.PI) / 180;
      const p1 = `${(o.x + Math.cos(a1) * alcance).toFixed(0)} ${(o.y + Math.sin(a1) * alcance).toFixed(0)}`;
      const p2 = `${(o.x + Math.cos(a2) * alcance).toFixed(0)} ${(o.y + Math.sin(a2) * alcance).toFixed(0)}`;
      const cone = o.alvo
        ? `M${o.alvo.x - 300} ${o.alvo.y} a300 270 0 1 0 600 0 a300 270 0 1 0 -600 0 Z`
        : `M${o.x} ${o.y} L${p1} L${p2} Z`;
      return (
        `<defs>` +
        `<radialGradient id="${px}-feixe" cx="${o.alvo?.x ?? o.x}" cy="${o.alvo?.y ?? o.y}" r="${o.alvo ? 320 : alcance}" gradientUnits="userSpaceOnUse">` +
        `<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>` +
        `<mask id="${px}-mascara"><rect width="1080" height="1920" fill="#fff"/><path id="${px}-cone" d="${cone}" fill="url(#${px}-feixe)"/></mask>` +
        `</defs>` +
        `<rect id="${px}-luz" width="1080" height="1920" fill="#020305" opacity="${ESCURO_LANTERNA}" mask="url(#${px}-mascara)"/>` +
        (o.alvo ? "" : `<path d="${cone}" fill="#FFF3B0" opacity=".12"/>`)
      );
    }
  }
}

/** Efeito `piscar_luz`: a luz base some e volta em cortes secos, com semente. */
export function kfsPiscar(px: string, semente: string, duracao: number, opacidadeBase: number): Keyframe[] {
  const r = rng(semente);
  const kfs: Keyframe[] = [];
  let t = 0.3 + r() * 0.6;
  while (t < duracao - 0.2) {
    const apagado = 0.06 + r() * 0.12;
    kfs.push({ alvo: `#${px}-piscar`, prop: "opacity", t, v: 0.85 });
    kfs.push({ alvo: `#${px}-piscar`, prop: "opacity", t: t + apagado, v: 0 });
    // às vezes pisca duas vezes seguidas
    t += apagado + (r() < 0.35 ? 0.08 : 0.9 + r() * 1.6);
  }
  void opacidadeBase;
  return [{ alvo: `#${px}-piscar`, prop: "opacity", t: 0, v: 0 }, ...kfs];
}

/** Camada extra usada por `piscar_luz` (preto por cima, ligado por instantes). */
export const camadaPiscar = (px: string) => `<rect id="${px}-piscar" width="1080" height="1920" fill="#020305" opacity="0"/>`;
