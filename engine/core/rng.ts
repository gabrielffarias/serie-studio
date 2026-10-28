// Aleatoriedade determinística: mesma semente, mesmo vídeo.

/** Hash FNV-1a de 32 bits de uma string (para transformar "ep01/p03" em semente). */
export function hashSemente(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Gerador mulberry32: devolve uma função que sorteia em [0, 1). */
export function rng(semente: number | string): () => number {
  let a = typeof semente === "string" ? hashSemente(semente) : semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sorteia em [min, max). */
export const entre = (r: () => number, min: number, max: number) => min + r() * (max - min);
