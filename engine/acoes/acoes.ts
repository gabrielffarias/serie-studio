// Ações dos personagens → keyframes (STYLE.md §6: duro e econômico, pose → pose
// em 0,12 s com power2.out, segura, encaixa). Os ciclos de andar e correr usam
// 4 poses-chave por passo: contato, passagem, contato espelhado, passagem.
import type { Keyframe } from "../core/keyframes";
import { rng } from "../core/rng";
import { kfsPose, kfsRaiz, kfsVista, prefixoVista } from "../rig/instancia";
import { personagem, pose } from "../rig/personagens";
import { JUNTAS, type Junta, type PoseResolvida, type VistaBase } from "../rig/tipos";

export type Acao = { tipo: string; intensidade?: number; para_x?: number; em_s?: number; vista?: string; pose?: string };

export type ContextoAcao = {
  id: string;
  inst: string;
  vista: VistaBase;
  espelho: boolean;
  /** posição inicial em px do quadro */
  pos: { x: number; y: number; escala: number };
  poseBase: string;
  extras: Record<string, boolean>;
  /** duração do plano */
  dur: number;
  semente: string;
};

export const TRANSICAO = 0.12;
const VELOCIDADE = { andar: 300, correr: 640 }; // px/s na escala 1
const PASSO = { andar: 0.52, correr: 0.32 }; // s por passo (2 poses-chave seguradas)

/** Troca os lados (perna/braço da frente ↔ de trás). De frente/costas, os ângulos de tela também invertem. */
export function espelharLados(p: PoseResolvida, v: VistaBase): PoseResolvida {
  const frontal = v === "frente" || v === "costas";
  const angulos = { ...p.angulos };
  const escalas = { ...p.escalas };
  for (const j of JUNTAS) {
    if (!j.endsWith("_d")) continue;
    const e = j.replace(/_d$/, "_e") as Junta;
    const sinal = frontal ? -1 : 1;
    [angulos[j], angulos[e]] = [sinal * p.angulos[e] + 0, sinal * p.angulos[j] + 0];
    [escalas[j], escalas[e]] = [p.escalas[e], p.escalas[j]];
  }
  return { ...p, angulos, escalas };
}

/** Passagem: pernas quase retas, corpo um pouco mais alto. */
function passagem(p: PoseResolvida, sobe: number): PoseResolvida {
  const angulos = { ...p.angulos };
  for (const j of ["coxa_d", "coxa_e", "canela_d", "canela_e", "braco_d", "braco_e"] as Junta[]) angulos[j] = Math.round(p.angulos[j] * 0.25);
  return { ...p, angulos, corpo_y: p.corpo_y - sobe };
}

function kfsDe(ctx: ContextoAcao, p: PoseResolvida, t: number, dur = TRANSICAO, ease = "power2.out"): Keyframe[] {
  return kfsPose(personagem(ctx.id).d, ctx.inst, ctx.vista, p, t, dur, ease);
}

const P = (ctx: ContextoAcao, nome: string) => pose(ctx.id, nome, ctx.vista, ctx.extras);

/** Ciclo de andar/correr entre t0 e t1 (não move a raiz). */
export function ciclo(ctx: ContextoAcao, tipo: "andar" | "correr", t0: number, t1: number): Keyframe[] {
  const a = P(ctx, tipo);
  const chaves = [a, passagem(a, tipo === "andar" ? 8 : 14), espelharLados(a, ctx.vista), passagem(espelharLados(a, ctx.vista), tipo === "andar" ? 8 : 14)];
  const meio = PASSO[tipo] / 2;
  const kfs: Keyframe[] = [];
  let i = 0;
  for (let t = t0; t < t1 - 0.01; t += meio, i++) kfs.push(...kfsDe(ctx, chaves[i % 4], t, Math.min(0.08, meio / 2)));
  return kfs;
}

/** Deslocamento com ciclo: anda de x0 até x1 (px do quadro) começando em t0; devolve kfs e o tempo de chegada. */
export function deslocar(ctx: ContextoAcao, tipo: "andar" | "correr", x0: number, x1: number, t0: number): { kfs: Keyframe[]; chegada: number } {
  const vel = VELOCIDADE[tipo] * ctx.pos.escala;
  const tempo = Math.abs(x1 - x0) / vel;
  const chegada = Math.min(ctx.dur, t0 + tempo);
  // se não der tempo, sai do quadro no meio do caminho (o corte esconde)
  const xFim = tempo > 0 && chegada < t0 + tempo ? x0 + (x1 - x0) * ((chegada - t0) / tempo) : x1;
  const pos = (x: number) => ({ x, y: ctx.pos.y, escala: ctx.pos.escala, espelho: ctx.espelho });
  const kfs = [...kfsRaiz(ctx.inst, pos(x0), t0), ...kfsRaiz(ctx.inst, pos(xFim), t0 + 0.001, chegada - t0 - 0.001, "none"), ...ciclo(ctx, tipo, t0, chegada)];
  if (chegada < ctx.dur) kfs.push(...kfsDe(ctx, P(ctx, ctx.poseBase === tipo ? "em_pe" : ctx.poseBase), chegada));
  return { kfs, chegada };
}

/** Lado para onde o personagem olha (+1 direita, -1 esquerda; frente/costas: direita). */
const sentido = (ctx: ContextoAcao) => (ctx.espelho ? -1 : 1);

export function kfsAcao(acao: Acao, ctx: ContextoAcao): Keyframe[] {
  const t = Math.min(acao.em_s ?? (["entrar", "andar", "correr"].includes(acao.tipo) ? 0 : 0.3), Math.max(0, ctx.dur - 0.3));
  const inten = acao.intensidade ?? 0.5;
  const W = 1080;
  switch (acao.tipo) {
    case "andar":
    case "correr": {
      const tipo = acao.tipo;
      if (acao.para_x === undefined) {
        // sem destino: anda na direção do olhar o plano todo, até 30% do quadro
        const x1 = Math.max(0.04 * W, Math.min(0.96 * W, ctx.pos.x + sentido(ctx) * 0.3 * W));
        return deslocar(ctx, tipo, ctx.pos.x, x1, t).kfs;
      }
      return deslocar(ctx, tipo, ctx.pos.x, acao.para_x * W, t).kfs;
    }
    case "entrar": {
      // entra pelo lado de trás do olhar e para no x do plano
      const x0 = sentido(ctx) > 0 ? -0.18 * W : 1.18 * W;
      const x1 = acao.para_x !== undefined ? acao.para_x * W : ctx.pos.x;
      return deslocar(ctx, inten > 0.7 ? "correr" : "andar", x0, x1, t).kfs;
    }
    case "sair": {
      const x1 = acao.para_x !== undefined ? acao.para_x * W : sentido(ctx) > 0 ? 1.2 * W : -0.2 * W;
      return deslocar(ctx, inten > 0.7 ? "correr" : "andar", ctx.pos.x, x1, t).kfs;
    }
    case "apontar":
    case "agachar":
    case "empurrar": {
      const kfs: Keyframe[] = [];
      // antecipação só em ação grande: empurrar recua antes
      if (acao.tipo === "empurrar") {
        const base = P(ctx, ctx.poseBase);
        kfs.push(...kfsDe(ctx, { ...base, angulos: { ...base.angulos, tronco: base.angulos.tronco + 8 } }, t, 0.1));
        kfs.push(...kfsDe(ctx, P(ctx, "empurrar"), t + 0.12, 0.1, "power3.in"));
        return kfs;
      }
      return kfsDe(ctx, P(ctx, acao.tipo), t);
    }
    case "olhar":
      return kfsDe(ctx, P(ctx, acao.pose ?? "olhar_tras"), t);
    case "cair":
      return [...kfsDe(ctx, P(ctx, "assustado"), t, 0.08), ...kfsDe(ctx, P(ctx, "caido"), t + 0.12, 0.16, "power2.in")];
    case "levantar":
      return [...kfsDe(ctx, P(ctx, "agachar"), t, 0.16), ...kfsDe(ctx, P(ctx, "em_pe"), t + 0.4)];
    case "pegar":
    case "soltar": {
      // estende o braço, segura, volta (o prop entra/sai no compose)
      const volta = acao.pose ?? (ctx.poseBase === "braco_estendido" ? "em_pe" : ctx.poseBase);
      return [...kfsDe(ctx, P(ctx, "braco_estendido"), t, 0.14), ...kfsDe(ctx, P(ctx, volta), t + 0.5)];
    }
    case "tremer": {
      const r = rng(ctx.semente);
      const alvo = `#${prefixoVista(ctx.inst, ctx.vista)}-corpo`;
      const amp = 2 + 5 * inten;
      const kfs: Keyframe[] = [{ alvo, prop: "x", t: 0, v: 0 }];
      for (let s = t; s < ctx.dur - 0.05; s += 0.06) kfs.push({ alvo, prop: "x", t: s, v: Math.round((r() * 2 - 1) * amp * 10) / 10, dur: 0.03 });
      kfs.push({ alvo, prop: "x", t: ctx.dur - 0.05, v: 0 });
      return kfs;
    }
    case "respirar": {
      // tronco sobe 4 px a cada ~2 s, com encaixe (não seno)
      const alvo = `#${prefixoVista(ctx.inst, ctx.vista)}-corpo`;
      const y0 = P(ctx, ctx.poseBase).corpo_y;
      const kfs: Keyframe[] = [];
      for (let s = t + 0.8; s < ctx.dur - 0.3; s += 2) kfs.push({ alvo, prop: "y", t: s, v: y0 - 4, dur: 0.18, ease: "power2.out" }, { alvo, prop: "y", t: s + 0.9, v: y0, dur: 0.18, ease: "power2.out" });
      return kfs;
    }
    case "virar": {
      // corte seco para outra vista (a vista precisa estar nas vistas da instância)
      const nova = (acao.vista ?? "").split("_")[0] as VistaBase;
      if (!nova) return [];
      return kfsVista(ctx.inst, [ctx.vista, nova], nova, t);
    }
    default:
      return [];
  }
}
