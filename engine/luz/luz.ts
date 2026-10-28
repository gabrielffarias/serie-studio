// Camadas de luz por cima da cena (engine/STYLE.md: gradiente só aqui e no fundo).
// Luz ambiente = estado do local; a lanterna é uma camada que soma por cima.
// A parte animada (piscar, eventos de luz, feixe seguindo a mão) vem em keyframes no compose.
import type { Keyframe } from "../core/keyframes";
import { rng } from "../core/rng";
import { LUZES_AMBIENTE, type LuzAmbiente } from "../../src/lib/luz";

export const LUZES = LUZES_AMBIENTE;
export type Luz = LuzAmbiente;

export type OrigemLanterna = {
  x: number;
  y: number;
  /** graus; 0 = para a direita */
  angulo: number;
  /** de costas para a câmera: em vez de cone, um círculo de luz no alvo */
  alvo?: { x: number; y: number };
  /** instância que segura a lanterna: o feixe acompanha a mão dela */
  dono?: string;
  /** a lanterna está na mão (segue o braço) ou na cabeça */
  naMao?: boolean;
};

/** escuridão do local escuro: ~18% de luz ambiente fica (forte, mas legível no celular) */
export const ESCURO_LANTERNA = 0.82;

/** contorno de luz fria nos personagens no escuro, para a silhueta ler */
export const CONTORNO_LANTERNA = { cor: "#AFC3E0", opacidade: 0.38, raio: 3 };

/** retângulo maior que o quadro: a luz fica dentro da câmera e não pode mostrar borda no zoom/pan */
const TELA = `x="-540" y="-960" width="2160" height="3840"`;

const ALCANCE = 1500;
const ABERTURA = 26;

/** Cone na origem, apontando para 0°: o motor posiciona e gira por keyframes (x, y, rotation). */
function conePadrao(): string {
  const a = (ABERTURA * Math.PI) / 180;
  const x = (Math.cos(a) * ALCANCE).toFixed(0), y = (Math.sin(a) * ALCANCE).toFixed(0);
  return `M0 0 L${x} ${-y} L${x} ${y} Z`;
}

/**
 * Máscara do feixe (ids `${px}-mascara`, `${px}-cone`): branco = o ambiente
 * vale; dentro do cone a camada ambiente some, então a lanterna soma luz ao
 * local sem trocar a luz dele.
 */
export function mascaraLanterna(px: string, o: OrigemLanterna): string {
  const cone = o.alvo
    ? `<ellipse id="${px}-cone" cx="${o.alvo.x}" cy="${o.alvo.y}" rx="300" ry="270" fill="url(#${px}-feixe)"/>`
    : `<path id="${px}-cone" d="${conePadrao()}" fill="url(#${px}-feixe)"/>`;
  const grad = o.alvo
    ? `<radialGradient id="${px}-feixe" cx="${o.alvo.x}" cy="${o.alvo.y}" r="320" gradientUnits="userSpaceOnUse">`
    : `<radialGradient id="${px}-feixe" cx="0" cy="0" r="${ALCANCE}" gradientUnits="userSpaceOnUse">`;
  return (
    `<defs>${grad}<stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></radialGradient>` +
    `<mask id="${px}-mascara" maskUnits="userSpaceOnUse" ${TELA}><rect ${TELA} fill="#fff"/>${cone}</mask></defs>`
  );
}

/** Brilho quente dentro do cone (id `${px}-brilho`), por cima do ambiente. */
export function brilhoLanterna(px: string, o: OrigemLanterna): string {
  return o.alvo ? "" : `<path id="${px}-brilho" d="${conePadrao()}" fill="#FFF3B0" opacity=".12"/>`;
}

/** Posição do feixe em t (cone e brilho andam juntos). */
export function kfsFeixe(px: string, o: OrigemLanterna, t: number, dur = 0): Keyframe[] {
  if (o.alvo) return [];
  const r = (n: number) => Math.round(n * 10) / 10;
  return [`#${px}-cone`, `#${px}-brilho`].flatMap((alvo) => [
    { alvo, prop: "x", t, v: r(o.x), dur },
    { alvo, prop: "y", t, v: r(o.y), dur },
    { alvo, prop: "rotation", t, v: r(o.angulo), dur },
  ]);
}

/**
 * Passada de contorno por cima da escuridão: cada personagem de novo (<use>,
 * em ordem de profundidade), escurecido como a escuridão deixa e com uma borda
 * fria. Como a cópia é opaca, quem está na frente cobre o contorno de quem
 * está atrás. Com lanterna, usa a máscara do feixe e some dentro dele.
 * Grupo `${px}-aro-g` (o compose liga/desliga quando a luz muda).
 */
export function contornoDeLuz(px: string, instancias: string[], comMascara: boolean): string {
  if (!instancias.length) return "";
  const c = CONTORNO_LANTERNA;
  const k = (1 - ESCURO_LANTERNA).toFixed(2);
  return (
    `<defs><filter id="${px}-aro" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${c.raio / 2}"/>` +
    `<feComponentTransfer result="d"><feFuncA type="linear" slope="4"/></feComponentTransfer>` +
    `<feComposite in="d" in2="SourceAlpha" operator="out" result="borda"/>` +
    `<feFlood flood-color="${c.cor}" flood-opacity="${c.opacidade}"/>` +
    `<feComposite in2="borda" operator="in" result="aro"/>` +
    `<feComponentTransfer in="SourceGraphic" result="escuro">` +
    `<feFuncR type="linear" slope="${k}"/><feFuncG type="linear" slope="${k}"/><feFuncB type="linear" slope="${k}"/></feComponentTransfer>` +
    `<feMerge><feMergeNode in="escuro"/><feMergeNode in="aro"/></feMerge></filter></defs>` +
    `<g id="${px}-aro-g"><g${comMascara ? ` mask="url(#${px}-mascara)"` : ""}>` +
    instancias.map((i) => `<use href="#${i}" filter="url(#${px}-aro)" style="--sombra:0"/>`).join("") +
    `</g></g>`
  );
}

/**
 * Camada da luz ambiente do local, dentro de um grupo `id` (o compose troca de
 * grupo quando um evento muda a luz). Com lanterna, recortada pelo feixe.
 */
export function camadaAmbiente(px: string, id: string, luz: Luz, comMascara: boolean): string {
  const m = comMascara ? ` mask="url(#${px}-mascara)"` : "";
  switch (luz) {
    case "normal":
      return `<g id="${id}"></g>`;
    case "escuro":
      return `<g id="${id}"><rect ${TELA} fill="#020305" opacity="${ESCURO_LANTERNA}"${m}/></g>`;
    case "emergencia_vermelha":
      // mesma receita da cena-exemplo (elipse de 0,8 do quadro centrada no alarme)
      return (
        `<g id="${id}"><defs><radialGradient id="${id}-g" cx="540" cy="346" r="864" gradientUnits="userSpaceOnUse" gradientTransform="translate(540 346) scale(1 1.778) translate(-540 -346)">` +
        `<stop offset="0" stop-color="#ff2a1a" stop-opacity=".55"/><stop offset=".45" stop-color="#8a0d06" stop-opacity=".35"/>` +
        `<stop offset="1" stop-color="#05070c" stop-opacity=".78"/></radialGradient></defs>` +
        `<rect ${TELA} fill="url(#${id}-g)"${m}/></g>`
      );
  }
}

/** Efeito `piscar_luz`: a luz base some e volta em cortes secos, com semente. */
export function kfsPiscar(px: string, semente: string, duracao: number, opacidadeBase: number): Keyframe[] {
  const r = rng(semente);
  const kfs: Keyframe[] = [];
  let t = 0.3 + r() * 0.6;
  while (t < duracao - 0.2) {
    const apagado = 0.06 + r() * 0.12;
    kfs.push({ alvo: `#${px}-piscar`, prop: "opacity", t, v: 0.85 });
    kfs.push({ alvo: `#${px}-piscar`, prop: "opacity", t: t + apagado, v: 0 });
    // às vezes pisca duas vezes seguidas
    t += apagado + (r() < 0.35 ? 0.08 : 0.9 + r() * 1.6);
  }
  void opacidadeBase;
  return [{ alvo: `#${px}-piscar`, prop: "opacity", t: 0, v: 0 }, ...kfs];
}

/** Camada extra usada por `piscar_luz` (preto por cima, ligado por instantes). */
export const camadaPiscar = (px: string) => `<rect id="${px}-piscar" width="1080" height="1920" fill="#020305" opacity="0"/>`;
