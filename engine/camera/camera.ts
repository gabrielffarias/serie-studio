// Câmera de um plano: anima o grupo `${px}-cam` (scale, x, y; origem 0 0).
// STYLE.md §6: push_in/pull_out lineares e lentos; shake com semente e curto
// (≤ 0,6 s); corte_seco é a troca de plano em si (câmera parada).
// Nunca mostra borda: a câmera é limitada para o quadro escalado cobrir 1080×1920.
import type { Keyframe } from "../core/keyframes";
import { rng } from "../core/rng";
import type { Ponto } from "../cenario/tipos";

export type Camera = { mov: string; de?: number; para?: number; foco?: string; intensidade?: number };

const W = 1080, H = 1920;
const arred = (n: number) => Math.round(n * 10) / 10;

/** Translação que põe o ponto `f` do cenário no ponto `tela` com escala `s`, sem mostrar borda. */
export function enquadrar(s: number, f: Ponto, tela: Ponto = { x: W / 2, y: H / 2 }): { x: number; y: number } {
  const x = tela.x - f.x * s;
  const y = tela.y - f.y * s;
  return {
    x: arred(Math.min(0, Math.max(W - W * s, x))),
    y: arred(Math.min(0, Math.max(H - H * s, y))),
  };
}

const ZOOM_PAN = 1.18;
const ZOOM_SHAKE = 1.05;

/**
 * Keyframes da câmera para um plano de duração `dur`. `foco` é o nome de uma
 * âncora do cenário (ou de um personagem já resolvido em `ancoras`).
 */
export function kfsCamera(px: string, cam: Camera | null | undefined, dur: number, ancoras: Record<string, Ponto>, semente: string): Keyframe[] {
  const alvo = `#${px}-cam`;
  const foco = (cam?.foco && ancoras[cam.foco]) || { x: W / 2, y: H / 2 };
  const k = (t: number, s: number, p: { x: number; y: number }, d = 0, ease = "none"): Keyframe[] => [
    { alvo, prop: "scale", t, v: Math.round(s * 1000) / 1000, dur: d, ease },
    { alvo, prop: "x", t, v: p.x, dur: d, ease },
    { alvo, prop: "y", t, v: p.y, dur: d, ease },
  ];
  const mov = cam?.mov ?? "fixo";
  const inten = cam?.intensidade ?? 0.5;
  switch (mov) {
    case "push_in":
    case "pull_out": {
      const padrao = mov === "push_in" ? [1, 1.25] : [1.25, 1];
      const de = Math.max(1, cam?.de ?? padrao[0]);
      const para = Math.max(1, cam?.para ?? padrao[1]);
      // o foco caminha até o centro do quadro enquanto aproxima
      const telaDe = mov === "push_in" ? foco : { x: W / 2, y: H / 2 };
      const telaPara = mov === "push_in" ? { x: W / 2, y: H / 2 } : foco;
      return [...k(0, de, enquadrar(de, foco, telaDe)), ...k(0.001, para, enquadrar(para, foco, telaPara), dur - 0.001)];
    }
    case "pan_esq":
    case "pan_dir": {
      const s = Math.max(ZOOM_PAN, cam?.de ?? ZOOM_PAN);
      const xs = [0, W - W * s];
      const [x0, x1] = mov === "pan_dir" ? xs : [xs[1], xs[0]];
      const y = enquadrar(s, foco).y;
      return [...k(0, s, { x: arred(x0), y }), ...k(0.001, s, { x: arred(x1), y }, dur - 0.001)];
    }
    case "tilt_cima":
    case "tilt_baixo": {
      const s = Math.max(ZOOM_PAN, cam?.de ?? ZOOM_PAN);
      const ys = [0, H - H * s];
      // tilt para cima: a câmera sobe, o conteúdo desce (começa mostrando a parte de baixo)
      const [y0, y1] = mov === "tilt_cima" ? [ys[1], ys[0]] : ys;
      const x = enquadrar(s, foco).x;
      return [...k(0, s, { x, y: arred(y0) }), ...k(0.001, s, { x, y: arred(y1) }, dur - 0.001)];
    }
    case "shake": {
      const s = ZOOM_SHAKE;
      const base = enquadrar(s, foco);
      const r = rng(semente);
      const amp = 10 + 26 * inten;
      const fim = Math.min(0.6, dur);
      const out = k(0, s, base);
      for (let t = 0.04; t < fim; t += 0.05) {
        const decai = 1 - t / fim;
        // tremida dentro da margem do zoom (sem mostrar borda)
        const p = {
          x: arred(Math.min(0, Math.max(W - W * s, base.x + (r() * 2 - 1) * amp * decai))),
          y: arred(Math.min(0, Math.max(H - H * s, base.y + (r() * 2 - 1) * amp * decai))),
        };
        out.push(...k(t, s, p, 0.04));
      }
      out.push(...k(fim, s, base, 0.05));
      return out;
    }
    default:
      // fixo / corte_seco: enquadramento parado (com zoom se `de` vier)
      return k(0, Math.max(1, cam?.de ?? 1), enquadrar(Math.max(1, cam?.de ?? 1), foco));
  }
}
