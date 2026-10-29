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

export type PlanoHud = { ini: number; dur: number; cena: boolean; lanterna: boolean };

const minutos = (h: string) => {
  const [a, b] = h.split(":").map(Number);
  return a * 60 + b;
};
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Tempo global em que um trecho acumulado (só dos planos escolhidos) é alcançado. */
function noTempo(planos: PlanoHud[], acumulado: number): number {
  let soma = 0;
  for (const p of planos) {
    if (acumulado <= soma + p.dur) return Math.round((p.ini + acumulado - soma) * 100) / 100;
    soma += p.dur;
  }
  const u = planos[planos.length - 1];
  return u ? u.ini + u.dur : 0;
}

/**
 * Passos do HUD ao longo do episódio: o relógio avança minuto a minuto nas
 * cenas até a hora final; a bateria cai 1% por vez só durante os planos com a
 * lanterna acesa, até o valor final. Cada passo cai no meio do seu trecho.
 */
export function passosHud(
  planos: PlanoHud[],
  hora: { de: string; para: string },
  bateria: { de: number; para: number },
): { horas: { t: number; hora: string }[]; bateria: { t: number; valor: number }[] } {
  const cenas = planos.filter((p) => p.cena);
  const tc = cenas.reduce((s, p) => s + p.dur, 0);
  const m0 = minutos(hora.de);
  let dm = minutos(hora.para) - m0;
  if (dm < 0) dm += 24 * 60;
  const horas = [{ t: 0, hora: hhmm(m0) }];
  for (let k = 1; k <= dm; k++) horas.push({ t: noTempo(cenas, ((k - 0.5) / dm) * tc), hora: hhmm(m0 + k) });

  const acesas = planos.filter((p) => p.cena && p.lanterna);
  const tl = acesas.reduce((s, p) => s + p.dur, 0);
  const queda = tl > 0 ? Math.max(0, Math.round(bateria.de - bateria.para)) : 0;
  const bat = [{ t: 0, valor: Math.round(bateria.de) }];
  for (let k = 1; k <= queda; k++) bat.push({ t: noTempo(acesas, ((k - 0.5) / queda) * tl), valor: Math.round(bateria.de) - k });
  return { horas, bateria: bat };
}

function medidor(id: string, nome: string, valor: number): string {
  const cor = COR_FAIXA[faixaBateria(valor)];
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    `<div class="hud-medidor" id="${id}">` +
    `<svg width="92" height="48" viewBox="0 0 92 48"><rect x="3" y="3" width="76" height="42" rx="7" fill="none" stroke="${cor}" stroke-width="6"/>` +
    `<rect x="81" y="15" width="9" height="18" rx="3" fill="${cor}"/>` +
    `<rect x="10" y="10" width="${(62 * v) / 100}" height="28" rx="3" fill="${cor}"/></svg>` +
    `<div id="${id}-pct"><b style="color:${cor}">${v}%</b><span>${esc(nome.toUpperCase())}</span></div>` +
    `</div>`
  );
}

/**
 * HUD do episódio inteiro: as variantes do relógio e do medidor ficam
 * empilhadas e o motor liga uma por vez (cortes secos). Em vermelho, o número
 * pulsa enquanto aquela variante está na tela.
 */
export function camadaHudEpisodio(
  px: string,
  selo: string,
  nome: string,
  passos: ReturnType<typeof passosHud>,
  total: number,
): { html: string; kfs: Keyframe[] } {
  const [forte] = partesSelo(selo.toUpperCase());
  const kfs: Keyframe[] = [];
  const liga = (ids: string[], ts: number[]) =>
    ids.forEach((id, i) => {
      kfs.push({ alvo: `#${id}`, prop: "opacity", t: 0, v: i === 0 ? 1 : 0 });
      if (i > 0) kfs.push({ alvo: `#${id}`, prop: "opacity", t: ts[i], v: 1 });
      if (i < ids.length - 1) kfs.push({ alvo: `#${id}`, prop: "opacity", t: ts[i + 1], v: 0 });
    });
  const idsHora = passos.horas.map((_, i) => `${px}-hora-${i}`);
  const idsBat = passos.bateria.map((_, i) => `${px}-bat-${i}`);
  liga(idsHora, passos.horas.map((h) => h.t));
  liga(idsBat, passos.bateria.map((b) => b.t));
  passos.bateria.forEach((b, i) => {
    if (faixaBateria(b.valor) !== "vermelho") return;
    const t0 = b.t, t1 = passos.bateria[i + 1]?.t ?? total;
    kfs.push({ alvo: `#${idsBat[i]}-pct`, prop: "opacity", t: 0, v: 1 });
    for (let t = t0 + 0.6; t < t1 - 0.4; t += 1.2) {
      kfs.push({ alvo: `#${idsBat[i]}-pct`, prop: "opacity", t, v: 0.35 }, { alvo: `#${idsBat[i]}-pct`, prop: "opacity", t: t + 0.3, v: 1 });
    }
  });
  const html =
    `<div id="${px}-hud" class="hud ui">` +
    `<div class="hud-selo"><i></i><b>${esc(forte)}</b><span class="hud-pilha">` +
    passos.horas.map((h, i) => `<span id="${idsHora[i]}">· ${h.hora}</span>`).join("") +
    `</span></div>` +
    `<div class="hud-pilha hud-medidores">` + passos.bateria.map((b, i) => medidor(idsBat[i], nome, b.valor)).join("") + `</div>` +
    `</div>`;
  return { html, kfs };
}

export const CSS_HUD = `
.hud-pilha { display: inline-grid; }
.hud-pilha > * { grid-area: 1 / 1; }
.hud-medidores { display: grid; margin-top: 14px; }
.hud-medidores > .hud-medidor { margin-top: 0; }
.hud { position: absolute; left: 60px; top: 120px; width: 360px; }
.hud-selo { height: 56px; display: inline-flex; align-items: center; gap: 12px; padding: 0 22px 0 20px; border-radius: 8px; background: rgba(14,15,18,.92); color: #fff; font-size: 27px; white-space: nowrap; }
.hud-selo i { width: 18px; height: 18px; border-radius: 50%; background: #FF3B2B; }
.hud-selo span { color: #A9ADB4; font-size: 24px; }
.hud-medidor { margin-top: 14px; width: 300px; height: 100px; display: flex; align-items: center; gap: 16px; padding: 0 18px; border-radius: 8px; background: rgba(14,15,18,.92); }
.hud-medidor div { display: flex; flex-direction: column; line-height: 1; }
.hud-medidor b { font-family: "InterHF900", "InterHF", sans-serif; font-weight: 900; font-size: 54px; letter-spacing: 1px; }
.hud-medidor span { margin-top: 6px; color: #A9ADB4; font-size: 17px; letter-spacing: 3px; }`;
