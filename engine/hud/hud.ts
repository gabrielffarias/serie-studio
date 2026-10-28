// HUD fixo da série (bíblia, seção 6): selo "● NOITE 1 · 18:47" e o medidor de
// BATERIA da lanterna (ícone de pilha + %). Amarelo abaixo de 50%, vermelho
// abaixo de 20% (com pulso). Zona reservada: x 60–420, y 110–300.
import type { Keyframe } from "../core/keyframes";

export type FaixaBateria = "normal" | "amarelo" | "vermelho";

export function faixaBateria(valor: number): FaixaBateria {
  return valor < 20 ? "vermelho" : valor < 50 ? "amarelo" : "normal";
}

export const COR_FAIXA: Record<FaixaBateria, string> = { normal: "#5BD16A", amarelo: "#FFC21A", vermelho: "#FF3B2B" };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** Separa "NOITE 1 · 18:47" em destaque ("NOITE 1") e resto ("· 18:47"). */
export function partesSelo(selo: string): [string, string] {
  const i = selo.indexOf("·");
  return i < 0 ? [selo.trim(), ""] : [selo.slice(0, i).trim(), selo.slice(i).trim()];
}

/**
 * HUD de um trecho: `valor` é a bateria mostrada; `pulso` liga a piscada do
 * medidor em vermelho entre t0 e t1 (encaixes secos, não seno).
 */
export function camadaHud(px: string, selo: string, nome: string, valor: number, janela: { t0: number; t1: number }): { html: string; kfs: Keyframe[] } {
  const faixa = faixaBateria(valor);
  const cor = COR_FAIXA[faixa];
  const [forte, resto] = partesSelo(selo.toUpperCase());
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  const kfs: Keyframe[] = [{ alvo: `#${px}-hud-pct`, prop: "opacity", t: 0, v: 1 }];
  if (faixa === "vermelho") {
    for (let t = janela.t0 + 0.6; t < janela.t1 - 0.4; t += 1.2) {
      kfs.push({ alvo: `#${px}-hud-pct`, prop: "opacity", t, v: 0.35 }, { alvo: `#${px}-hud-pct`, prop: "opacity", t: t + 0.3, v: 1 });
    }
  }
  const html =
    `<div id="${px}-hud" class="hud ui">` +
    `<div class="hud-selo"><i></i><b>${esc(forte)}</b><span>${esc(resto)}</span></div>` +
    `<div class="hud-medidor" id="${px}-hud-pct">` +
    `<svg width="92" height="48" viewBox="0 0 92 48"><rect x="3" y="3" width="76" height="42" rx="7" fill="none" stroke="${cor}" stroke-width="6"/>` +
    `<rect x="81" y="15" width="9" height="18" rx="3" fill="${cor}"/>` +
    `<rect x="10" y="10" width="${(62 * v) / 100}" height="28" rx="3" fill="${cor}"/></svg>` +
    `<div><b style="color:${cor}">${v}%</b><span>${esc(nome.toUpperCase())}</span></div>` +
    `</div></div>`;
  return { html, kfs };
}

export const CSS_HUD = `
.hud { position: absolute; left: 60px; top: 120px; width: 360px; }
.hud-selo { height: 56px; display: inline-flex; align-items: center; gap: 12px; padding: 0 22px 0 20px; border-radius: 8px; background: rgba(14,15,18,.92); color: #fff; font-size: 27px; white-space: nowrap; }
.hud-selo i { width: 18px; height: 18px; border-radius: 50%; background: #FF3B2B; }
.hud-selo span { color: #A9ADB4; font-size: 24px; }
.hud-medidor { margin-top: 14px; width: 300px; height: 100px; display: flex; align-items: center; gap: 16px; padding: 0 18px; border-radius: 8px; background: rgba(14,15,18,.92); }
.hud-medidor div { display: flex; flex-direction: column; line-height: 1; }
.hud-medidor b { font-family: "InterHF900", "InterHF", sans-serif; font-weight: 900; font-size: 54px; letter-spacing: 1px; }
.hud-medidor span { margin-top: 6px; color: #A9ADB4; font-size: 17px; letter-spacing: 3px; }`;
