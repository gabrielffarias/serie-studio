// Telas fixas da série (SKILL.md, padrão de interface):
//   resultado  placar em barras A×B, a vencedora cresce, carimbo "O MAIS VOTADO FOI X" (4–6 s)
//   votacao    último quadro congelado e escurecido, cartões gigantes A (amarelo) e B (vermelho),
//              faixa "COMENTA A OU B ↓ · O MAIS VOTADO DECIDE O PRÓXIMO EPISÓDIO", pulso leve (6–8 s)
//   continua   selo "CONTINUA AMANHÃ" sobre o último quadro (2–3 s)
// Texto fora da UI do TikTok: x 108–900, nada abaixo de y 1700; legenda livre em y 1380–1540.
import type { Keyframe } from "../core/keyframes";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const AMARELO = "#FFC21A", VERMELHO = "#FF3B2B";

/** seta para baixo desenhada (o servidor não tem fonte de emoji para o 👇) */
const SETA = `<svg class="seta" width="44" height="52" viewBox="0 0 44 52"><path d="M22 4 L22 40 M6 26 L22 44 L38 26" stroke="#FFC21A" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export type Resultado = { opcao: "A" | "B"; pct_a: number; pct_b: number; rotulo_a?: string; rotulo_b?: string };

/** Altura das barras (px) a partir dos percentuais: a maior ocupa a altura toda. */
export function alturasBarras(pctA: number, pctB: number, max = 620): [number, number] {
  const m = Math.max(pctA, pctB, 1);
  return [Math.round((pctA / m) * max), Math.round((pctB / m) * max)];
}

export function telaResultado(px: string, r: Resultado, dur: number): { html: string; kfs: Keyframe[] } {
  const [hA, hB] = alturasBarras(r.pct_a, r.pct_b);
  const venc = r.opcao;
  const barra = (l: "A" | "B", h: number, pct: number, rotulo?: string) => {
    const cor = l === "A" ? AMARELO : VERMELHO;
    return (
      `<div class="res-col" id="${px}-col${l}">` +
      `<div class="res-pct cap" style="color:${cor}">${Math.round(pct)}%</div>` +
      `<div class="res-trilho"><div class="res-barra" id="${px}-barra${l}" style="height:${h}px;background:${cor}"></div></div>` +
      `<div class="res-letra cap" style="background:${cor};color:${l === "A" ? "#0E0F12" : "#fff"}">${l}</div>` +
      (rotulo ? `<div class="res-rotulo cap">${esc(rotulo.toUpperCase())}</div>` : "") +
      `</div>`
    );
  };
  const html =
    `<div id="${px}-resultado" class="tela">` +
    `<div class="res-titulo cap">RESULTADO DA VOTAÇÃO</div>` +
    `<div class="res-barras">${barra("A", hA, r.pct_a, r.rotulo_a)}${barra("B", hB, r.pct_b, r.rotulo_b)}</div>` +
    `<div id="${px}-carimbo" class="res-carimbo cap" style="opacity:0;border-color:${venc === "A" ? AMARELO : VERMELHO};color:${venc === "A" ? AMARELO : VERMELHO}">O MAIS VOTADO FOI ${venc}</div>` +
    `</div>`;
  const kfs: Keyframe[] = [];
  for (const l of ["A", "B"] as const) {
    // barras sobem juntas (0,7 s), a vencedora encaixa maior
    kfs.push({ alvo: `#${px}-barra${l}`, prop: "scaleY", t: 0, v: 0 }, { alvo: `#${px}-barra${l}`, prop: "scaleY", t: 0.3, v: 1, dur: 0.7, ease: "power2.out" });
    kfs.push({ alvo: `#${px}-col${l}`, prop: "scale", t: 0, v: 1 });
    if (l === venc) kfs.push({ alvo: `#${px}-col${l}`, prop: "scale", t: 1.2, v: 1.07, dur: 0.12, ease: "power2.out" }, { alvo: `#${px}-col${l}`, prop: "scale", t: 1.32, v: 1.04, dur: 0.06 });
    else kfs.push({ alvo: `#${px}-col${l}`, prop: "opacity", t: 0, v: 1 }, { alvo: `#${px}-col${l}`, prop: "opacity", t: 1.2, v: 0.45, dur: 0.12 });
  }
  const tc = Math.min(1.7, dur - 1);
  kfs.push(
    { alvo: `#${px}-carimbo`, prop: "opacity", t: 0, v: 0 },
    { alvo: `#${px}-carimbo`, prop: "scale", t: 0, v: 2.2 },
    { alvo: `#${px}-carimbo`, prop: "opacity", t: tc, v: 1 },
    { alvo: `#${px}-carimbo`, prop: "scale", t: tc, v: 0.94, dur: 0.14, ease: "power3.in" },
    { alvo: `#${px}-carimbo`, prop: "scale", t: tc + 0.14, v: 1, dur: 0.06 },
  );
  return { html, kfs };
}

export type Opcao = { rotulo: string };

export function telaVotacao(px: string, a: Opcao, b: Opcao, dur: number): { html: string; kfs: Keyframe[] } {
  const cartao = (l: "A" | "B", o: Opcao) =>
    `<div id="${px}-vot${l}" class="vot-cartao vot-${l}">` +
    `<div class="vot-letra cap">${l}</div><div class="vot-rotulo cap">${esc(o.rotulo.toUpperCase())}</div></div>`;
  const html =
    `<div id="${px}-votacao" class="tela tela-vot">` +
    `<div class="vot-titulo cap">E AGORA?</div>` +
    cartao("A", a) + cartao("B", b) +
    `<div class="vot-faixa ui"><div><b>COMENTA <span style="color:${AMARELO}">A</span> OU <span style="color:${VERMELHO}">B</span></b> ${SETA}</div><div class="vot-sub">O MAIS VOTADO DECIDE O PRÓXIMO EPISÓDIO</div></div>` +
    `</div>`;
  const kfs: Keyframe[] = [];
  // entrada com encaixe seco, B um pouco depois de A
  (["A", "B"] as const).forEach((l, i) => {
    const id = `#${px}-vot${l}`;
    const t0 = 0.15 + i * 0.25;
    kfs.push({ alvo: id, prop: "scale", t: 0, v: 0 }, { alvo: id, prop: "scale", t: t0, v: 1.08, dur: 0.12, ease: "power2.out" }, { alvo: id, prop: "scale", t: t0 + 0.12, v: 1, dur: 0.06 });
    // pulso leve alternado: 1 → 1,04 → 1 a cada 1,2 s (A e B em contratempo)
    for (let t = 1.2 + i * 0.6; t < dur - 0.4; t += 1.2) {
      kfs.push({ alvo: id, prop: "scale", t, v: 1.04, dur: 0.15, ease: "power2.out" }, { alvo: id, prop: "scale", t: t + 0.15, v: 1, dur: 0.2, ease: "power2.in" });
    }
  });
  kfs.push({ alvo: `#${px}-votacao`, prop: "opacity", t: 0, v: 1 });
  return { html, kfs };
}

export function telaContinua(px: string): { html: string; kfs: Keyframe[] } {
  const html = `<div id="${px}-continua" class="tela"><div id="${px}-selo-cont" class="cont-selo cap">CONTINUA <span style="color:${AMARELO}">AMANHÃ</span></div></div>`;
  const id = `#${px}-selo-cont`;
  return {
    html,
    kfs: [{ alvo: id, prop: "scale", t: 0, v: 0 }, { alvo: id, prop: "scale", t: 0.25, v: 1.08, dur: 0.12, ease: "power2.out" }, { alvo: id, prop: "scale", t: 0.37, v: 1, dur: 0.06 }],
  };
}

export const CSS_TELAS = `
.tela { position: absolute; inset: 0; }
.res-titulo { position: absolute; top: 330px; left: 0; right: 0; text-align: center; color: #fff; font-size: 72px; letter-spacing: 2px; }
.res-barras { position: absolute; top: 470px; left: 140px; right: 180px; height: 900px; display: flex; justify-content: space-around; align-items: flex-end; }
.res-col { display: flex; flex-direction: column; align-items: center; width: 260px; transform-origin: 50% 100%; }
.res-pct { font-size: 110px; line-height: 1; margin-bottom: 14px; -webkit-text-stroke: 10px #000; paint-order: stroke fill; }
.res-trilho { width: 200px; height: 620px; display: flex; align-items: flex-end; background: rgba(255,255,255,.08); border-radius: 12px; }
.res-barra { width: 100%; border-radius: 12px; transform-origin: 50% 100%; }
.res-letra { margin-top: 18px; width: 110px; height: 110px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 84px; }
.res-rotulo { margin-top: 12px; color: #fff; font-size: 40px; text-align: center; line-height: 1.05; }
.res-carimbo { position: absolute; top: 800px; left: 110px; right: 180px; text-align: center; font-size: 76px; padding: 14px 10px; border: 10px solid; border-radius: 14px;
  background: rgba(14,15,18,.92); transform-origin: 50% 50%; rotate: -6deg; }
.tela-vot { background: rgba(5,6,9,.62); }
.vot-titulo { position: absolute; top: 330px; left: 0; right: 0; text-align: center; color: #fff; font-size: 92px; letter-spacing: 3px; -webkit-text-stroke: 12px #000; paint-order: stroke fill; }
.vot-cartao { position: absolute; left: 108px; width: 792px; height: 330px; border-radius: 22px; display: flex; align-items: center; gap: 30px; padding: 0 40px;
  border: 8px solid #0E0F12; transform-origin: 50% 50%; }
.vot-A { top: 480px; background: #FFC21A; color: #0E0F12; }
.vot-B { top: 850px; background: #FF3B2B; color: #fff; }
.vot-letra { font-size: 230px; line-height: 1; width: 170px; text-align: center; }
.vot-rotulo { font-size: 86px; line-height: 1.02; flex: 1; }
.vot-faixa { position: absolute; top: 1225px; left: 60px; right: 140px; padding: 22px 26px; border-radius: 12px; background: rgba(14,15,18,.94); color: #fff; text-align: center; }
.vot-faixa > div:first-child { display: flex; align-items: center; justify-content: center; gap: 18px; font-size: 52px; }
.vot-faixa .vot-sub { margin-top: 8px; color: #A9ADB4; font-size: 28px; letter-spacing: 1px; }
.cont-selo { position: absolute; top: 800px; left: 108px; right: 180px; padding: 30px 0; text-align: center; font-size: 104px; color: #fff; border-radius: 12px;
  background: rgba(14,15,18,.92); transform-origin: 50% 50%; }`;
