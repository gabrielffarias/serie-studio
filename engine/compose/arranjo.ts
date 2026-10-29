// Arranjo dos personagens no início do plano (regra do compose):
// - no mesmo plano de profundidade (mesma escala), ninguém encosta em ninguém:
//   entre as extensões dos corpos fica pelo menos FOLGA px;
// - os pés ficam sempre à vista: quem está à frente (desenhado depois) não
//   cobre os pés de quem está atrás; o próprio acessório também não (pegada.cobrePes).
// Só a camada `frente` do cenário (barra, coluna) pode cobrir pés de propósito.
// Quem senta vai para um assento do cenário. O arranjo só mexe em x (e no y de
// quem senta); o que não couber vira problema.

export type CorpoArranjo = {
  id: string;
  x: number;
  /** chão do personagem (px do quadro) */
  y: number;
  escala: number;
  espelho: boolean;
  /** pegada na escala 1 olhando à direita (Desenhavel.pegada) */
  esq: number;
  dir: number;
  topo: number;
  pes: { x0: number; x1: number; y0: number; y1: number }[];
  /** faixa de x permitida (assento) */
  faixa?: [number, number];
};

export const FOLGA = 36;
export const MARGEM = 24;
/** escalas com diferença até isto estão no mesmo plano de profundidade */
export const MESMO_PLANO = 0.05;

type Intervalo = [number, number];

/** Extensão horizontal do corpo no quadro. */
export function extensao(c: CorpoArranjo, x = c.x): Intervalo {
  const a = c.espelho ? -c.dir : c.esq, b = c.espelho ? -c.esq : c.dir;
  return [x + a * c.escala, x + b * c.escala];
}

/** Pés no quadro: faixa horizontal e vertical de cada pé. */
export function pesNoQuadro(c: CorpoArranjo, x = c.x): { x: Intervalo; y: Intervalo }[] {
  return c.pes.map((p) => {
    const a = c.espelho ? -p.x1 : p.x0, b = c.espelho ? -p.x0 : p.x1;
    return { x: [x + a * c.escala, x + b * c.escala], y: [c.y + p.y0 * c.escala, c.y + p.y1 * c.escala] };
  });
}

const sobreposicao = (a: Intervalo, b: Intervalo) => Math.min(a[1], b[1]) - Math.max(a[0], b[0]);

/** Ordem de desenho: menor escala (mais longe) primeiro; depois quem está mais alto. */
export const ordemDeDesenho = <T extends { escala: number; y: number }>(cs: T[]): T[] =>
  [...cs].sort((a, b) => a.escala - b.escala || a.y - b.y);

/**
 * Quanto `tras` e `frente` (desenhado depois) precisam se afastar na
 * horizontal; 0 = ok. No mesmo plano, os corpos não se tocam; em planos
 * diferentes, o corpo da frente não cobre os pés de quem está atrás.
 */
export function deficit(tras: CorpoArranjo, frente: CorpoArranjo, xt = tras.x, xf = frente.x): number {
  const corpoF = extensao(frente, xf);
  if (Math.abs(tras.escala - frente.escala) <= MESMO_PLANO) {
    const s = sobreposicao(extensao(tras, xt), corpoF) + FOLGA;
    return s > 0 ? s : 0;
  }
  const alturaF: Intervalo = [frente.y + Math.min(frente.topo, 0) * frente.escala, frente.y + 30 * frente.escala];
  let pior = 0;
  for (const pe of pesNoQuadro(tras, xt)) {
    if (sobreposicao(pe.y, alturaF) <= 0) continue;
    const s = sobreposicao(pe.x, corpoF) + FOLGA / 2;
    if (s > pior) pior = s;
  }
  return pior;
}

function limites(c: CorpoArranjo, largura: number): Intervalo {
  const [a, b] = extensao(c, 0);
  let lo = MARGEM - a, hi = largura - MARGEM - b;
  if (c.faixa) {
    lo = Math.max(lo, c.faixa[0]);
    hi = Math.min(hi, c.faixa[1]);
  }
  return [lo, Math.max(lo, hi)];
}

/**
 * Afasta os personagens até cumprir as regras (relaxação: cada par em
 * conflito se afasta pela metade do que falta, dentro do quadro e do assento).
 * Devolve o x final de cada um, o que mudou e o que não deu para resolver.
 */
export function arranjar(corpos: CorpoArranjo[], largura = 1080): { x: number[]; ajustes: string[]; problemas: string[] } {
  const xs = corpos.map((c) => {
    const [lo, hi] = limites(c, largura);
    return Math.min(hi, Math.max(lo, c.x));
  });
  const idx = ordemDeDesenho(corpos.map((c, i) => ({ ...c, i }))).map((c) => c.i);
  const pares: [number, number][] = [];
  for (let a = 0; a < idx.length; a++) for (let b = a + 1; b < idx.length; b++) pares.push([idx[a], idx[b]]);

  for (let it = 0; it < 200; it++) {
    let mexeu = false;
    for (const [t, f] of pares) {
      const d = deficit(corpos[t], corpos[f], xs[t], xs[f]);
      if (d <= 0.5) continue;
      // quem está à esquerda vai para a esquerda (empate: o de trás)
      const sinal = xs[t] < xs[f] || (xs[t] === xs[f] && t < f) ? -1 : 1;
      const [lot, hit] = limites(corpos[t], largura);
      const [lof, hif] = limites(corpos[f], largura);
      const nt = Math.min(hit, Math.max(lot, xs[t] + (sinal * d) / 2));
      const nf = Math.min(hif, Math.max(lof, xs[f] - (sinal * d) / 2));
      // se um bateu no limite, o outro anda o resto
      const resto = d - Math.abs(nt - xs[t]) - Math.abs(nf - xs[f]);
      xs[t] = nt;
      xs[f] = Math.min(hif, Math.max(lof, nf - sinal * Math.max(0, resto)));
      mexeu = true;
    }
    if (!mexeu) break;
  }

  const ajustes: string[] = [];
  corpos.forEach((c, i) => {
    xs[i] = Math.round(xs[i]);
    if (Math.abs(xs[i] - c.x) >= 1) ajustes.push(`${c.id}: x ${Math.round(c.x)} → ${xs[i]}`);
  });
  const problemas = pares
    .filter(([t, f]) => deficit(corpos[t], corpos[f], xs[t], xs[f]) > 1)
    .map(([t, f]) => `${corpos[t].id} e ${corpos[f].id} não cabem lado a lado no quadro`);
  return { x: xs, ajustes, problemas };
}
