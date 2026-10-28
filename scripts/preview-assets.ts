// Folhas de prévia dos personagens (Parada 1 da Fase 1 e conferência de asset):
//   vistas.png        a mesma pose nas 4 vistas, lado a lado (várias poses, uma por linha)
//   poses-tq.png      todas as poses em 3/4
//   poses-frente.png  todas as poses de frente
//   expressoes.png    as expressões, de frente
// Uso: npm run preview:assets [id…]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compilar, type Keyframe } from "../engine/core/keyframes";
import { abrirNavegador, fotografar } from "../engine/core/navegador";
import { kfsPose, kfsRaiz, kfsVista, svgInstancia, slugVista } from "../engine/rig/instancia";
import { PERSONAGENS, pose } from "../engine/rig/personagens";
import { EXPRESSOES, VISTAS_BASE, type Expressao, type VistaBase } from "../engine/rig/tipos";

const RAIZ = path.resolve(import.meta.dirname, "..");
const TMP = path.join(RAIZ, "data/previews");
const ORDEM_VISTAS: VistaBase[] = ["frente", "3/4", "perfil", "costas"];

type Celula = { personagem: string; vista: VistaBase; pose: string; rotulo: string; expressao?: Expressao; extras?: Record<string, boolean> };

function folhaHtml(celulas: Celula[], cols: number, cw: number, ch: number, escala: number, chaoY: number): { html: string; w: number; h: number } {
  const linhas = Math.ceil(celulas.length / cols);
  const w = cols * cw, h = linhas * ch;
  const svgs: string[] = [];
  const kfs: Keyframe[] = [];
  celulas.forEach((c, i) => {
    const { d } = PERSONAGENS[c.personagem];
    const inst = `c${i}-${c.personagem}`;
    const cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + chaoY;
    svgs.push(
      `<g transform="translate(${cx} ${cy}) scale(${escala})">${svgInstancia(d, inst, VISTAS_BASE as unknown as VistaBase[], c.vista)}</g>` +
        `<text x="${cx}" y="${Math.floor(i / cols) * ch + ch - 18}" text-anchor="middle" class="r">${c.rotulo}</text>`,
    );
    const p = pose(c.personagem, c.pose, c.vista, c.extras);
    if (c.expressao) p.expressao = c.expressao;
    kfs.push(...kfsRaiz(inst, { x: 0, y: 0, escala: 1, espelho: false }, 0));
    kfs.push(...kfsVista(inst, VISTAS_BASE as unknown as VistaBase[], c.vista, 0));
    for (const v of VISTAS_BASE) kfs.push(...kfsPose(d, inst, v, pose(c.personagem, "em_pe", v), 0));
    kfs.push(...kfsPose(d, inst, c.vista, p, 0));
  });
  const segs = compilar(kfs);
  const nm = (p: string) => `file://${path.join(RAIZ, "node_modules", p)}`;
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>@font-face{font-family:I;font-weight:800;src:url(${nm("@fontsource/inter/files/inter-latin-800-normal.woff2")})}
html,body{margin:0;background:#E9E2D4}.r{font-family:I;font-weight:800;font-size:22px;fill:#2A2420}</style>
<script src="${nm("gsap/dist/gsap.min.js")}"></script><script src="file://${path.join(RAIZ, "engine/core/motor.js")}"></script></head>
<body><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
${Array.from({ length: linhas }, (_, l) => `<line x1="0" x2="${w}" y1="${l * ch + chaoY}" y2="${l * ch + chaoY}" stroke="#C9BFAE" stroke-width="3"/>`).join("")}
${svgs.join("\n")}</svg>
<script>const tl=gsap.timeline({paused:true});Motor.aplicar(tl,${JSON.stringify(segs)});tl.seek(0);</script></body></html>`;
  return { html, w, h };
}

/** poses das linhas da folha de vistas (as humanas, ou as primeiras do personagem) */
function linhasVistas(poses: string[]): string[] {
  const preferidas = ["em_pe", "apontar", "assustado", "andar"].filter((p) => poses.includes(p));
  return preferidas.length === 4 ? preferidas : poses.slice(0, 4);
}

async function main() {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(PERSONAGENS);
  mkdirSync(TMP, { recursive: true });
  const nav = await abrirNavegador();
  try {
    for (const id of ids) {
      const poses = Object.keys(PERSONAGENS[id].poses);
      // variações da criatura ficam na pasta dela, com o tom no nome
      const pasta = id.startsWith("criatura") ? "criatura" : id;
      const prefixo = pasta === id ? "" : `${id.replace("criatura_", "")}-`;
      const destino = path.join(RAIZ, `assets/personagens/${pasta}/preview`);
      mkdirSync(destino, { recursive: true });
      const folhas: Record<string, ReturnType<typeof folhaHtml>> = {
        vistas: folhaHtml(
          linhasVistas(poses).flatMap((p) => ORDEM_VISTAS.map((v) => ({ personagem: id, vista: v, pose: p, rotulo: `${p} · ${v}` }))),
          4, 380, 560, 0.66, 480,
        ),
        "poses-tq": folhaHtml(poses.map((p) => ({ personagem: id, vista: "3/4", pose: p, rotulo: p })), 5, 340, 540, 0.6, 460, ),
        "poses-frente": folhaHtml(poses.map((p) => ({ personagem: id, vista: "frente", pose: p, rotulo: p })), 5, 340, 540, 0.6, 460),
        expressoes: folhaHtml(
          EXPRESSOES.flatMap((e) => (["frente", "3/4"] as VistaBase[]).map((v) => ({ personagem: id, vista: v, pose: "em_pe", expressao: e, rotulo: `${e} · ${slugVista(v)}` }))),
          6, 330, 520, 0.62, 450,
        ),
      };
      if (!PERSONAGENS[id].d.temRosto) delete folhas.expressoes;
      for (const [nome, f] of Object.entries(folhas)) {
        const html = path.join(TMP, `${id}-${nome}.html`);
        writeFileSync(html, f.html);
        const png = path.join(destino, `${prefixo}${nome}.png`);
        await fotografar(nav, html, png, f.w, f.h);
        console.log(`🖼  ${path.relative(RAIZ, png)}`);
      }
    }
  } finally {
    await nav.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
