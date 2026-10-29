// Legenda falada (engine/STYLE.md §7): 2 a 3 palavras por vez, Anton 96 px,
// branca com contorno preto grosso; a palavra sendo dita em vermelho, as
// palavras de destaque do episódio em amarelo.
//
// Sem voz (Fase 1), o tempo de cada palavra é estimado por sílabas dentro da
// janela do plano. Com voz (Fase 2), os tempos vêm do Whisper.
import type { Keyframe } from "../core/keyframes";

export type TempoPalavra = { palavra: string; ini: number; fim: number };
export type Bloco = { palavras: TempoPalavra[]; ini: number; fim: number };

export const COR = { branco: "#FFFFFF", vermelho: "#FF3B2B", amarelo: "#FFC21A" };

/** minúsculas, sem acento e sem pontuação (para comparar palavras) */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim();
}

/** Sílabas aproximadas em português: grupos de vogais (ditongos contam como uma). */
export function silabas(palavra: string): number {
  const p = normalizar(palavra).replace(/\s/g, "");
  if (/^\d+%?$/.test(p)) return Math.max(2, p.length); // números são falados por extenso
  const grupos = p.match(/[aeiouy]+/g);
  return Math.max(1, grupos?.length ?? 1);
}

/**
 * Distribui as palavras na janela [ini, fim] proporcionalmente às sílabas,
 * com uma pausa extra depois de vírgula/ponto.
 */
export function temposPorSilaba(texto: string, ini: number, fim: number): TempoPalavra[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  if (!palavras.length) return [];
  const PAUSA = 1.2; // em "sílabas"
  const pesos = palavras.map((p, i) => silabas(p) + (i < palavras.length - 1 && /[.,;:!?…]$/.test(p) ? PAUSA : 0));
  const total = pesos.reduce((a, b) => a + b, 0);
  const passo = (fim - ini) / total;
  const out: TempoPalavra[] = [];
  let t = ini;
  palavras.forEach((p, i) => {
    const falada = silabas(p) * passo;
    out.push({ palavra: p, ini: arred(t), fim: arred(t + falada) });
    t += pesos[i] * passo;
  });
  return out;
}

const arred = (n: number) => Math.round(n * 1000) / 1000;

/** caracteres que cabem numa linha de 96 px dentro de 80% da largura (Anton é condensada) */
export const MAX_CARACTERES = 18;

/**
 * Agrupa em blocos de até 3 palavras: quebra depois de pontuação e quando o
 * bloco passaria de MAX_CARACTERES. Um bloco fica na tela até o próximo começar.
 */
export function blocos(tempos: TempoPalavra[], max = 3): Bloco[] {
  const out: Bloco[] = [];
  let atual: TempoPalavra[] = [];
  const fechar = () => {
    if (atual.length) out.push({ palavras: atual, ini: atual[0].ini, fim: atual[atual.length - 1].fim });
    atual = [];
  };
  for (const w of tempos) {
    const tamanho = [...atual, w].map((x) => x.palavra).join(" ").length;
    if (atual.length && (atual.length >= max || tamanho > MAX_CARACTERES)) fechar();
    atual.push(w);
    if (/[.,;:!?…]$/.test(w.palavra)) fechar();
  }
  fechar();
  // sem buracos: cada bloco dura até o início do seguinte
  for (let i = 0; i < out.length - 1; i++) out[i].fim = out[i + 1].ini;
  return out;
}

/** Palavras que ficam amarelas (comparação sem acento; frases viram palavras soltas). */
export function ehDestaque(palavra: string, destaques: string[]): boolean {
  const alvo = normalizar(palavra);
  if (!alvo) return false;
  return destaques.some((d) => normalizar(d).split(" ").includes(alvo));
}

/** tamanho da fonte para o bloco caber na largura (96 px no máximo) */
export function tamanhoFonte(texto: string): number {
  return texto.length <= MAX_CARACTERES ? 96 : Math.max(64, Math.floor((96 * MAX_CARACTERES) / texto.length));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * HTML e keyframes da legenda de um trecho. `px` prefixa os ids; os tempos são
 * da timeline onde a camada vai morar.
 */
export function camadaLegenda(px: string, bs: Bloco[], destaques: string[]): { html: string; kfs: Keyframe[] } {
  const kfs: Keyframe[] = [];
  const html = bs
    .map((b, i) => {
      const id = `${px}-leg${i}`;
      kfs.push({ alvo: `#${id}`, prop: "opacity", t: 0, v: 0 }, { alvo: `#${id}`, prop: "opacity", t: b.ini, v: 1 }, { alvo: `#${id}`, prop: "opacity", t: b.fim, v: 0 });
      const texto = b.palavras.map((w) => w.palavra).join(" ").toUpperCase();
      const spans = b.palavras
        .map((w, j) => {
          const wid = `${id}-${j}`;
          const base = ehDestaque(w.palavra, destaques) ? COR.amarelo : COR.branco;
          kfs.push(
            { alvo: `#${wid}`, prop: "color", t: 0, v: base },
            { alvo: `#${wid}`, prop: "color", t: w.ini, v: COR.vermelho },
            { alvo: `#${wid}`, prop: "color", t: Math.max(w.ini, w.fim), v: base },
          );
          return `<span id="${wid}" style="color:${base}">${esc(w.palavra.toUpperCase())}</span>`;
        })
        .join(" ");
      return `<div id="${id}" class="legenda cap" style="opacity:0;font-size:${tamanhoFonte(texto)}px"><div>${spans}</div></div>`;
    })
    .join("");
  return { html, kfs };
}

export const CSS_LEGENDA = `
.legenda { position: absolute; left: 0; right: 0; top: 1380px; height: 160px; display: flex; align-items: center; justify-content: center;
  text-align: center; white-space: nowrap; color: #fff; -webkit-text-stroke: 12px #000; paint-order: stroke fill; letter-spacing: 1px; }`;
