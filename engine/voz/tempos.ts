// Tempos com voz (lógica pura): onde cada fala entra no plano, quanto o plano
// passa a durar e em que instante cada palavra da LEGENDA aparece.
//
// A legenda nem sempre é o texto falado ("18:04" ↔ "Dezoito e quatro"; na
// votação ela resume a frase). As palavras iguais nos dois (comparação sem
// acento, caixa e pontuação) viram âncoras com o tempo real da voz; o resto
// da legenda se espalha entre as âncoras vizinhas pelas sílabas.
import { normalizar, silabas, temposPorSilaba, type TempoPalavra } from "../hud/legenda";
import type { PalavraFalada } from "./provedores";

/** a primeira fala começa 0,2 s depois do corte */
export const INICIO_VOZ_S = 0.2;
/** respiro entre a narração e a fala do personagem no mesmo plano */
export const ENTRE_FALAS_S = 0.25;
/** respiro depois da última fala, antes do corte */
export const FOLGA_FIM_S = 0.35;

export type Audio = { duracao: number; palavras: PalavraFalada[] };
export type FalasDoPlano = { narracao?: Audio; fala?: Audio };

export type PlanoComVoz = {
  id: string;
  ini: number;
  dur: number;
  /** início de cada áudio na timeline do episódio */
  narracaoEm?: number;
  falaEm?: number;
  /** o plano esticou para a voz caber */
  esticou: boolean;
};

const arred = (n: number, casas = 3) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Fim do que é falado: o edge deixa ~0,4 s de silêncio no fim do arquivo (o áudio toca inteiro, mas não ocupa o plano). */
export const fimFalado = (a: Audio) => (a.palavras.length ? Math.min(a.duracao, a.palavras.at(-1)!.fim + 0.05) : a.duracao);

/**
 * Coloca narração e fala de cada plano e estica o plano se a voz não couber:
 * dur = max(planejada, fim da voz + folga), arredondada para cima em 0,1 s.
 */
export function posicionarFalas(planos: { id: string; duracao_s: number }[], falas: Record<string, FalasDoPlano>): PlanoComVoz[] {
  const out: PlanoComVoz[] = [];
  let t = 0;
  for (const p of planos) {
    const f = falas[p.id] ?? {};
    let cursor = INICIO_VOZ_S;
    let narracaoEm: number | undefined;
    let falaEm: number | undefined;
    if (f.narracao) {
      narracaoEm = cursor;
      cursor += fimFalado(f.narracao) + ENTRE_FALAS_S;
    }
    if (f.fala) {
      falaEm = cursor;
      cursor += fimFalado(f.fala) + ENTRE_FALAS_S;
    }
    const fimVoz = f.narracao || f.fala ? cursor - ENTRE_FALAS_S : 0;
    const necessaria = Math.ceil(arred((fimVoz + FOLGA_FIM_S) * 10, 6)) / 10;
    const dur = f.narracao || f.fala ? Math.max(p.duracao_s, necessaria) : p.duracao_s;
    out.push({
      id: p.id,
      ini: arred(t),
      dur: arred(dur),
      ...(narracaoEm !== undefined ? { narracaoEm: arred(t + narracaoEm) } : {}),
      ...(falaEm !== undefined ? { falaEm: arred(t + falaEm) } : {}),
      esticou: dur > p.duracao_s,
    });
    t += dur;
  }
  return out;
}

/** Palavras faladas deslocadas para a timeline do episódio. */
export const deslocar = (ps: PalavraFalada[], em: number): PalavraFalada[] => ps.map((w) => ({ texto: w.texto, ini: arred(w.ini + em), fim: arred(w.fim + em) }));

/** Sem tempo do provedor (Kokoro): estima pelas sílabas dentro do áudio (sem as bordas de silêncio). */
export function estimarPalavras(texto: string, duracao: number): PalavraFalada[] {
  return temposPorSilaba(texto, Math.min(0.08, duracao / 4), Math.max(0.1, duracao - 0.12)).map((w) => ({ texto: w.palavra, ini: w.ini, fim: w.fim }));
}

/** Pares (i em a, j em b) da maior subsequência comum. */
export function lcs(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) d[i][j] = a[i] && a[i] === b[j] ? d[i + 1][j + 1] + 1 : Math.max(d[i + 1][j], d[i][j + 1]);
  const pares: [number, number][] = [];
  for (let i = 0, j = 0; i < m && j < n; ) {
    if (a[i] && a[i] === b[j]) pares.push([i++, j++]);
    else if (d[i + 1][j] >= d[i][j + 1]) i++;
    else j++;
  }
  return pares;
}

/**
 * Tempo de cada palavra da legenda a partir das palavras faladas (já na
 * timeline do episódio). `quem` marca as palavras da fala de um personagem.
 */
export function alinharLegenda(legenda: string, faladas: PalavraFalada[], quem?: string): TempoPalavra[] {
  const tokens = legenda.split(/\s+/).filter(Boolean);
  if (!tokens.length || !faladas.length) return [];
  const pares = lcs(
    tokens.map((t) => normalizar(t)),
    faladas.map((w) => normalizar(w.texto)),
  );
  const tempos: ({ ini: number; fim: number } | null)[] = tokens.map(() => null);
  for (const [i, j] of pares) tempos[i] = { ini: faladas[j].ini, fim: faladas[j].fim };

  // buracos: espalha pelas sílabas entre o fim da âncora anterior e o início da seguinte
  for (let i = 0; i < tokens.length; ) {
    if (tempos[i]) {
      i++;
      continue;
    }
    let k = i;
    while (k < tokens.length && !tempos[k]) k++;
    const de = i > 0 ? tempos[i - 1]!.fim : faladas[0].ini;
    const ate = k < tokens.length ? tempos[k]!.ini : faladas.at(-1)!.fim;
    const pesos = tokens.slice(i, k).map((t) => silabas(t));
    const total = pesos.reduce((s, x) => s + x, 0);
    const passo = Math.max(0, ate - de) / total;
    let t = de;
    for (let x = i; x < k; x++) {
      tempos[x] = { ini: arred(t), fim: arred(t + pesos[x - i] * passo) };
      t += pesos[x - i] * passo;
    }
    i = k;
  }
  return tokens.map((p, i) => ({ palavra: p, ini: tempos[i]!.ini, fim: tempos[i]!.fim, ...(quem ? { quem } : {}) }));
}
