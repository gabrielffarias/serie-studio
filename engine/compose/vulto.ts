// Passagem do vulto (antes do EP5): ele nunca fica parado nem aparece inteiro.
// Cruza uma janela em ~0,5 s, por trás do vidro, baixo o bastante para a
// moldura de baixo cortar quase tudo: só passa o topo (ponta de orelha, ombro),
// com um borrão de movimento na horizontal.
import type { Keyframe } from "../core/keyframes";
import type { Retangulo } from "../cenario/tipos";

export const PASSAGEM = {
  /** duração da travessia (s) */
  dur: 0.5,
  /** quanto da altura da silhueta fica acima da moldura de baixo */
  visivel: 0.3,
  /** desvio do borrão horizontal (px) */
  borrao: 8,
};

/** pose da criatura na passagem (braços para trás): acima da moldura só sobe cabeça e ombro */
export const POSE_PASSAGEM = "passar";

/** Janela mais perto de x (centro). */
export function janelaMaisPerto(janelas: Retangulo[], x: number): Retangulo {
  return [...janelas].sort((a, b) => Math.abs(a.x + a.w / 2 - x) - Math.abs(b.x + b.w / 2 - x))[0];
}

/**
 * Trajeto da passagem: chão (y) tal que só `visivel` da altura fica acima da
 * moldura de baixo, e x de partida/chegada com a silhueta toda fora da janela.
 * `sentido` -1 = da direita para a esquerda.
 */
export function trajetoPassagem(
  j: Retangulo,
  pegada: { esq: number; dir: number; topo: number },
  escala: number,
  sentido: 1 | -1,
): { y: number; x0: number; x1: number } {
  const altura = -pegada.topo * escala;
  const y = j.y + j.h + altura * (1 - PASSAGEM.visivel);
  const largura = Math.max(Math.abs(pegada.esq), Math.abs(pegada.dir)) * escala + PASSAGEM.borrao * 2;
  const esq = j.x - largura, dir = j.x + j.w + largura;
  return sentido < 0 ? { y, x0: dir, x1: esq } : { y, x0: esq, x1: dir };
}

/** Recorte da janela e borrão; o grupo `${inst}-passa` liga e desliga a silhueta. */
export function svgPassagem(inst: string, j: Retangulo, conteudo: string): string {
  return (
    `<defs><clipPath id="${inst}-jan"><rect x="${j.x}" y="${j.y}" width="${j.w}" height="${j.h}" rx="${j.rx ?? 0}"/></clipPath>` +
    `<filter id="${inst}-borrao" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="${PASSAGEM.borrao} 0"/></filter></defs>` +
    `<g clip-path="url(#${inst}-jan)"><g id="${inst}-passa" filter="url(#${inst}-borrao)">${conteudo}</g></g>`
  );
}

/** Travessia em linha reta, sem parar; antes e depois a silhueta some. */
export function kfsPassagem(inst: string, tr: { x0: number; x1: number }, t0: number): Keyframe[] {
  const t1 = Math.round((t0 + PASSAGEM.dur) * 1000) / 1000;
  return [
    { alvo: `#${inst}-passa`, prop: "opacity", t: 0, v: 0 },
    { alvo: `#${inst}-passa`, prop: "opacity", t: t0, v: 1 },
    { alvo: `#${inst}`, prop: "x", t: t0, v: Math.round(tr.x1), dur: PASSAGEM.dur, ease: "none" },
    { alvo: `#${inst}-passa`, prop: "opacity", t: t1, v: 0 },
  ];
}
