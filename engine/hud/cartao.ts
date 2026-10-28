// Cartão de título (STYLE.md §7): faixa #0E0F12 a 90%, Anton 56–104 px, trechos
// de destaque em amarelo (ou vermelho), entrada com encaixe seco 0 → 1,08 → 1
// em 0,18 s. Fica logo abaixo do HUD (y ≈ 330–500): acima das janelas e portas
// dos cenários e longe da legenda.
import type { Keyframe } from "../core/keyframes";
import { normalizar } from "./legenda";

export type Cartao = { texto: string; destaque?: string[]; cor?: "amarelo" | "vermelho" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** tamanho da fonte pelo texto: curto = gigante, longo = 56 px em até 3 linhas */
export function tamanhoCartao(texto: string): number {
  const n = texto.length;
  return n <= 14 ? 104 : n <= 28 ? 84 : n <= 44 ? 68 : 56;
}

/**
 * Pinta os trechos de destaque (comparação sem acento e sem caixa, palavra a
 * palavra, para "ACESSO PROIBIDO" achar "acesso proibido").
 */
export function marcarDestaques(texto: string, destaques: string[] = [], cor = "#FFC21A"): string {
  const palavras = texto.split(/(\s+)/);
  const alvos = destaques.map((d) => normalizar(d).split(" ").filter(Boolean)).filter((a) => a.length);
  const marcado = new Array(palavras.length).fill(false);
  const idx = palavras.map((p, i) => ({ p, i })).filter((x) => x.p.trim());
  for (const alvo of alvos) {
    for (let k = 0; k + alvo.length <= idx.length; k++) {
      if (alvo.every((a, j) => normalizar(idx[k + j].p) === a)) for (let j = 0; j < alvo.length; j++) marcado[idx[k + j].i] = true;
    }
  }
  return palavras.map((p, i) => (marcado[i] ? `<span style="color:${cor}">${esc(p)}</span>` : esc(p))).join("");
}

/** Cartão visível de t0 a t1 (tempos da timeline da camada). */
export function camadaCartao(px: string, c: Cartao, t0: number, t1: number): { html: string; kfs: Keyframe[] } {
  const id = `${px}-cartao`;
  const cor = c.cor === "vermelho" ? "#FF3B2B" : "#FFC21A";
  const html =
    `<div id="${id}" class="cartao cap" style="opacity:0">` +
    `<div class="cartao-texto" style="font-size:${tamanhoCartao(c.texto)}px">${marcarDestaques(c.texto.toUpperCase(), c.destaque, cor)}</div></div>`;
  const kfs: Keyframe[] = [
    { alvo: `#${id}`, prop: "opacity", t: 0, v: 0 },
    { alvo: `#${id}`, prop: "scale", t: 0, v: 0 },
    { alvo: `#${id}`, prop: "opacity", t: t0, v: 1 },
    { alvo: `#${id}`, prop: "scale", t: t0, v: 1.08, dur: 0.12, ease: "power2.out" },
    { alvo: `#${id}`, prop: "scale", t: t0 + 0.12, v: 1, dur: 0.06 },
    { alvo: `#${id}`, prop: "opacity", t: t1, v: 0 },
  ];
  return { html, kfs };
}

export const CSS_CARTAO = `
.cartao { position: absolute; left: 70px; right: 70px; top: 330px; min-height: 170px; padding: 26px 34px; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; background: rgba(14,15,18,.9); transform-origin: 50% 50%; }
.cartao-texto { color: #fff; text-align: center; line-height: 1.12; letter-spacing: 1px; }`;
