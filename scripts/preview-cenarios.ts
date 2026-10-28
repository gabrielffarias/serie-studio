// Prévias dos cenários (assets/cenarios/<id>/preview.png) e a folha de cenas
// montadas com personagens e luz (assets/cenarios/preview-cenas.png).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compilar, type Keyframe } from "../engine/core/keyframes";
import { abrirNavegador, fotografar } from "../engine/core/navegador";
import { CENARIOS } from "../engine/cenario/cenarios";
import { montarCena, type CenaSpec } from "../engine/compose/cena";

const RAIZ = path.resolve(import.meta.dirname, "..");
const nm = (p: string) => `file://${path.join(RAIZ, "node_modules", p)}`;

const CENAS: CenaSpec[] = [
  {
    px: "a", cenario: "vagao", luz: "emergencia_vermelha",
    personagens: [
      { id: "criatura_vulto", vista: "perfil_dir", pose: "andar", x: 0.86, y: 0.47, escala: 0.9 },
      { id: "socorro", vista: "3/4_esq", pose: "sentado", x: 0.8, y: 0.71, escala: 0.9 },
      { id: "valdir", vista: "3/4_dir", pose: "olhar_tras", x: 0.56, escala: 0.95 },
      { id: "caio", vista: "3/4_esq", pose: "apontar", x: 0.3 },
    ],
  },
  {
    px: "b", cenario: "tunel", luz: "lanterna", itens: ["lanterna_cabeca"],
    personagens: [
      { id: "criatura_vulto", vista: "perfil_esq", pose: "espreitar", x: 0.8, y: 0.62, escala: 0.45 },
      { id: "valdir", vista: "perfil_dir", pose: "andar", x: 0.12, escala: 0.85 },
      { id: "socorro", vista: "perfil_dir", pose: "abracando_isopor", x: 0.24, escala: 0.9 },
      { id: "caio", vista: "perfil_dir", pose: "andar", x: 0.42 },
    ],
  },
  {
    px: "c", cenario: "plataforma_1959", luz: "escuro",
    personagens: [
      { id: "socorro", vista: "3/4_dir", pose: "abracando_isopor", x: 0.22, escala: 0.95 },
      { id: "valdir", vista: "3/4_esq", pose: "ajustar_oculos", x: 0.72, escala: 0.97 },
      { id: "caio", vista: "frente", pose: "em_pe", x: 0.47 },
    ],
  },
  {
    px: "d", cenario: "porta_1959", luz: "lanterna", itens: ["lanterna_cabeca"],
    personagens: [
      { id: "valdir", vista: "costas", pose: "em_pe", x: 0.66 },
      { id: "caio", vista: "costas", pose: "segurar_lanterna", x: 0.34 },
    ],
  },
];

function pagina(svgs: string[], segs: unknown, w: number, h: number, soltos = false): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Anton;src:url(${nm("@fontsource/anton/files/anton-latin-400-normal.woff2")})}
@font-face{font-family:InterHF;font-weight:800;src:url(${nm("@fontsource/inter/files/inter-latin-800-normal.woff2")})}
html,body{margin:0;background:#111}svg{display:block}</style>
<script src="${nm("gsap/dist/gsap.min.js")}"></script><script src="file://${path.join(RAIZ, "engine/core/motor.js")}"></script></head>
<body>${soltos ? `<div style="display:flex;width:${w}px;height:${h}px">${svgs.join("")}</div>` : `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">${svgs.join("")}</svg>`}
<script>const tl=gsap.timeline({paused:true});Motor.aplicar(tl,${JSON.stringify(segs)});tl.seek(0);</script></body></html>`;
}

async function main() {
  const tmp = path.join(RAIZ, "data/previews");
  mkdirSync(tmp, { recursive: true });
  const nav = await abrirNavegador();
  try {
    for (const c of Object.values(CENARIOS)) {
      const svg = `<g transform="scale(0.5)">${c.fundo(`pv-${c.id}`)}${c.frente?.(`pv-${c.id}`) ?? ""}</g>`;
      const html = path.join(tmp, `cenario-${c.id}.html`);
      writeFileSync(html, pagina([svg], [], 540, 960));
      const png = path.join(RAIZ, `assets/cenarios/${c.id}/preview.png`);
      await fotografar(nav, html, png, 540, 960);
      console.log(`🖼  ${path.relative(RAIZ, png)}`);
    }
    const svgs: string[] = [];
    const kfs: Keyframe[] = [];
    CENAS.forEach((spec, i) => {
      const m = montarCena(spec);
      void i;
      svgs.push(`<svg width="540" height="960" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">${m.svg}</svg>`);
      kfs.push(...m.kfs);
    });
    const html = path.join(tmp, "cenas.html");
    writeFileSync(html, pagina(svgs, compilar(kfs), 540 * CENAS.length, 960, true));
    const png = path.join(RAIZ, "assets/cenarios/preview-cenas.png");
    await fotografar(nav, html, png, 540 * CENAS.length, 960);
    console.log(`🖼  ${path.relative(RAIZ, png)}`);
  } finally {
    await nav.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
