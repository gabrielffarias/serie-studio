// episodio.json → projeto HyperFrames: index.html (raiz 1080×1920, 30 fps) com
// uma subcomposição por plano em compositions/pNN.html, mais HUD e legenda na
// raiz. Toda a animação vira segmentos fromTo (engine/core/motor.js).
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compilar, type Keyframe } from "../core/keyframes";
import { CSS_CARTAO } from "../hud/cartao";
import { camadaHudEpisodio, CSS_HUD, partesSelo, passosHud } from "../hud/hud";
import { percorrerLuz } from "../../src/lib/luz";
import { EP_REVELACAO_CRIATURAS } from "../../src/lib/episodio-checagens";
import { blocos, camadaLegenda, CSS_LEGENDA, temposPorSilaba, type Falantes, type TempoPalavra } from "../hud/legenda";
import { CSS_TELAS } from "../hud/telas";
import { copiarVendor } from "../vendor";
import type { Episodio } from "../../src/lib/episodio-schema";
import { comporPlano, type PlanoComposto } from "./plano";

const RAIZ = path.resolve(import.meta.dirname, "../..");

export type OpcoesProjeto = {
  /** itens do estado antes do episódio (lanterna_cabeca etc.) */
  itens?: string[];
  /** luz ambiente de cada local antes do episódio (estado.luz_ambiente) */
  luzAmbiente?: Record<string, string>;
  /** tempos das palavras por plano (Whisper); sem isso, estimativa por sílaba */
  palavras?: Record<string, TempoPalavra[]>;
  /** nome e cor de quem fala, para a etiqueta da legenda (vozes.json) */
  falantes?: Falantes;
  /** só estes planos (medição de render de um plano isolado) */
  apenas?: string[];
};

export type Projeto = {
  dir: string;
  duracao: number;
  planos: { id: string; ini: number; dur: number }[];
  /** ajustes de arranjo e problemas que o compose achou */
  avisos: string[];
};

/** fontes locais (o render não busca nada na rede); cada subcomposição declara as suas */
const CSS_FONTES = `
@font-face { font-family: "Anton"; src: url("assets/fonts/anton-400.woff2") format("woff2"); }
@font-face { font-family: "InterHF"; font-weight: 800; src: url("assets/fonts/inter-800.woff2") format("woff2"); }
@font-face { font-family: "InterHF900"; font-weight: 900; src: url("assets/fonts/inter-900.woff2") format("woff2"); }
.cap { font-family: "Anton", sans-serif; }
.ui { font-family: "InterHF", sans-serif; font-weight: 800; }`;

const CSS_BASE = `${CSS_FONTES}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1920px; overflow: hidden; background: #07080B; }
`;

const json = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");

/** Uma subcomposição (cena) num arquivo com <template>. */
function htmlPlano(id: string, dur: number, c: PlanoComposto): string {
  const segs = compilar(c.kfs);
  return `<template>
<style>${CSS_FONTES}
#root { position: absolute; inset: 0; overflow: hidden; background: ${c.fundo ?? "#07080B"}; }
#root > svg { position: absolute; left: 0; top: 0; }
${CSS_CARTAO}
${CSS_TELAS}
</style>
<div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
${c.svg ? `<svg data-layout-allow-overflow width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">${c.svg}</svg>` : ""}
${c.html}
</div>
<script>
(function () {
  var tl = gsap.timeline({ paused: true });
  Motor.aplicar(tl, ${json(segs)}, document.querySelector('[data-composition-id="${id}"]'));
  tl.set({}, {}, ${dur});
  window.__timelines["${id}"] = tl;
})();
</script>
</template>
`;
}

/** Janela da legenda dentro do plano (sem voz): começa 0,2 s depois, termina 0,3 s antes. */
function temposDoPlano(texto: string, ini: number, dur: number): TempoPalavra[] {
  return temposPorSilaba(texto, ini + 0.2, ini + Math.max(0.6, dur - 0.3));
}

/** As últimas palavras do plano são da fala (a legenda vem narração e depois fala). */
function marcarFala(tempos: TempoPalavra[], fala: { personagem: string; legenda: string } | null | undefined): TempoPalavra[] {
  if (!fala) return tempos;
  const n = fala.legenda.split(/\s+/).filter(Boolean).length;
  return tempos.map((w, i) => (i >= tempos.length - n ? { ...w, quem: fala.personagem } : w));
}

export function montarProjeto(ep: Episodio, dir: string, op: OpcoesProjeto = {}): Projeto {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.join(dir, "compositions"), { recursive: true });
  copiarVendor(dir);
  copyFileSync(path.join(RAIZ, "engine/core/motor.js"), path.join(dir, "assets/vendor/motor.js"));
  writeFileSync(
    path.join(dir, "hyperframes.json"),
    JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true } }, null, 2),
  );

  const todas = ep.planos.map((p) => p.duracao_s);
  const indices = ep.planos.map((_, i) => i).filter((i) => !op.apenas || op.apenas.includes(ep.planos[i].id));
  const planos: Projeto["planos"] = [];
  let t = 0;
  for (const i of indices) {
    planos.push({ id: ep.planos[i].id, ini: Math.round(t * 1000) / 1000, dur: todas[i] });
    t += todas[i];
  }
  const total = Math.round(t * 1000) / 1000;

  const hosts: string[] = [];
  const kfsRaiz: Keyframe[] = [];
  const legendas: string[] = [];
  // luz ambiente de cada plano, a partir do estado (só muda com evento de luz)
  const luzes = Object.fromEntries(percorrerLuz(ep.planos, op.luzAmbiente ?? {}).planos.map((l) => [l.id, l]));

  // HUD: relógio até a hora final; bateria cai só com a lanterna acesa
  const horaFinal = typeof ep.estado_final.hora === "string" ? ep.estado_final.hora : partesSelo(ep.hud.selo)[1].replace(/[^\d:]/g, "");
  const batFinal = typeof ep.estado_final.bateria === "number" ? ep.estado_final.bateria : ep.hud.medidor.valor;
  const passos = passosHud(
    planos.map((pl) => {
      const p = ep.planos.find((x) => x.id === pl.id)!;
      return { ini: pl.ini, dur: pl.dur, cena: p.tipo === "cena", lanterna: p.tipo === "cena" && p.lanterna };
    }),
    { de: partesSelo(ep.hud.selo)[1].replace(/[^\d:]/g, ""), para: horaFinal },
    { de: ep.hud.medidor.valor, para: batFinal },
  );
  const hud = camadaHudEpisodio("r", ep.hud.selo, ep.hud.medidor.nome, passos, total);
  kfsRaiz.push(...hud.kfs, { alvo: "#r-hud", prop: "opacity", t: 0, v: 1 });

  const avisos: string[] = [];
  planos.forEach((pl, k) => {
    const i = indices[k];
    const p = ep.planos[i];
    const c = comporPlano(ep, i, { px: pl.id, dur: pl.dur, itens: op.itens ?? [], semente: `${ep.no}-${pl.id}`, luzes, passagemVulto: ep.numero < EP_REVELACAO_CRIATURAS }, todas);
    avisos.push(...(c.avisos ?? []));
    writeFileSync(path.join(dir, `compositions/${pl.id}.html`), htmlPlano(pl.id, pl.dur, c));
    hosts.push(
      `<div id="${pl.id}" data-composition-id="${pl.id}" data-composition-src="compositions/${pl.id}.html" data-start="${pl.ini}" data-duration="${pl.dur}" data-track-index="1" data-width="1080" data-height="1920"></div>`,
    );
    // HUD só nas cenas
    kfsRaiz.push({ alvo: "#r-hud", prop: "opacity", t: pl.ini, v: p.tipo === "cena" ? 1 : 0 });

    // legenda: narração e depois fala, dividindo a janela pelas sílabas
    const textos = [p.narracao?.legenda, p.fala?.legenda].filter((x): x is string => !!x);
    if (!textos.length) return;
    const tempos = op.palavras?.[pl.id] ?? marcarFala(temposDoPlano(textos.join(" "), pl.ini, pl.dur), p.fala);
    const leg = camadaLegenda(`r-${pl.id}`, blocos(tempos), ep.palavras_destaque, op.falantes);
    legendas.push(leg.html);
    kfsRaiz.push(...leg.kfs);
  });

  // HUD e legenda numa subcomposição própria por cima das cenas (o lint pede
  // que a raiz seja feita só de subcomposições)
  writeFileSync(
    path.join(dir, "compositions/camadas.html"),
    `<template>
<style>${CSS_FONTES}
#root { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
${CSS_HUD}
${CSS_LEGENDA}
</style>
<div id="root" data-composition-id="camadas" data-width="1080" data-height="1920">
${hud.html}
${legendas.join("\n")}
</div>
<script>
(function () {
  var tl = gsap.timeline({ paused: true });
  Motor.aplicar(tl, ${json(compilar(kfsRaiz))}, document.querySelector('[data-composition-id="camadas"]'));
  tl.set({}, {}, ${total});
  window.__timelines["camadas"] = tl;
})();
</script>
</template>
`,
  );
  hosts.push(
    `<div id="camadas" data-composition-id="camadas" data-composition-src="compositions/camadas.html" data-start="0" data-duration="${total}" data-track-index="2" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index:10"></div>`,
  );

  const index = `<!doctype html>
<html lang="pt-BR" data-resolution="portrait">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="assets/vendor/gsap.min.js"></script>
<script src="assets/vendor/motor.js"></script>
<style>
${CSS_BASE}
#root { position: relative; width: 100%; height: 100%; overflow: hidden; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${total}" data-width="1080" data-height="1920" data-fps="30">
${hosts.join("\n")}
</div>
<script>
(function () {
  var tl = gsap.timeline({ paused: true });
  tl.set({}, {}, ${total});
  window.__timelines["main"] = tl;
})();
</script>
</body>
</html>
`;
  writeFileSync(path.join(dir, "index.html"), index);
  return { dir, duracao: total, planos, avisos };
}
