// O motor calcula toda a animação no Node como keyframes; o navegador só
// entrega os segmentos para uma timeline GSAP pausada (engine/core/motor.js).

export type Valor = number | string;

/** "A partir de t, vá até v em dur segundos" (dur 0 = encaixe instantâneo). */
export type Keyframe = { alvo: string; prop: string; t: number; v: Valor; dur?: number; ease?: string };

/** Segmento compacto para o runtime: [alvo, prop, de, para, t, dur, ease]. */
export type Segmento = [string, string, Valor, Valor, number, number, string];

const arred = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Converte keyframes em segmentos fromTo. Cada (alvo, prop) precisa de um valor
 * inicial: o primeiro keyframe em t=0, ou `iniciais[alvo|prop]`.
 */
export function compilar(kfs: Keyframe[], iniciais: Record<string, Valor> = {}): Segmento[] {
  const trilhas = new Map<string, Keyframe[]>();
  for (const k of kfs) {
    const chave = `${k.alvo}|${k.prop}`;
    if (!trilhas.has(chave)) trilhas.set(chave, []);
    trilhas.get(chave)!.push(k);
  }
  const out: Segmento[] = [];
  for (const [chave, lista] of trilhas) {
    // ordem estável por tempo (keyframes no mesmo t: vale o último declarado)
    const ordenada = lista.map((k, i) => ({ k, i })).sort((a, b) => a.k.t - b.k.t || a.i - b.i).map((x) => x.k);
    // encaixes no mesmo instante: só o último vale (dois tweens de duração zero
    // no mesmo t deixam o runtime do HyperFrames no estado errado ao buscar o quadro)
    const ord = ordenada.filter((k, i) => {
      const prox = ordenada[i + 1];
      return !(prox && prox.t === k.t && (k.dur ?? 0) === 0 && (prox.dur ?? 0) === 0);
    });
    let atual: Valor | undefined = iniciais[chave];
    if (atual === undefined) {
      if (ord[0].t !== 0 || (ord[0].dur ?? 0) !== 0) {
        throw new Error(`trilha ${chave} sem valor inicial em t=0`);
      }
    }
    for (const k of ord) {
      const de = atual ?? k.v;
      out.push([k.alvo, k.prop, de, k.v, arred(k.t), arred(k.dur ?? 0), k.ease ?? "none"]);
      atual = k.v;
    }
  }
  return out;
}

/** Valor final de cada (alvo, prop): usado para congelar o último quadro (tela de votação). */
export function valoresFinais(kfs: Keyframe[]): Map<string, Valor> {
  const fim = new Map<string, { t: number; v: Valor }>();
  for (const k of kfs) {
    const chave = `${k.alvo}|${k.prop}`;
    const tFim = k.t + (k.dur ?? 0);
    const atual = fim.get(chave);
    if (!atual || tFim >= atual.t) fim.set(chave, { t: tFim, v: k.v });
  }
  return new Map([...fim].map(([c, x]) => [c, x.v]));
}

/** Desloca keyframes no tempo e troca o prefixo dos alvos (reaproveitar um bloco). */
export function deslocar(kfs: Keyframe[], dt: number): Keyframe[] {
  return kfs.map((k) => ({ ...k, t: k.t + dt }));
}
