// Um plano do roteiro → conteúdo visual (SVG + camadas HTML) e keyframes na
// timeline local do plano (0 = início do plano).
import type { Keyframe } from "../core/keyframes";
import { valoresFinais } from "../core/keyframes";
import { kfsAcao } from "../acoes/acoes";
import { kfsCamera } from "../camera/camera";
import { cenario } from "../cenario/cenarios";
import { kfsPiscar } from "../luz/luz";
import { camadaCartao } from "../hud/cartao";
import { telaContinua, telaResultado, telaVotacao } from "../hud/telas";
import type { VistaBase } from "../rig/tipos";
import type { Episodio, Plano } from "../../src/lib/episodio-schema";
import { extrasDaInstancia, montarCena, parseVista, type CenaSpec } from "./cena";

export type PlanoCena = Extract<Plano, { tipo: "cena" }>;

export type PlanoComposto = {
  /** SVG da cena (vazio em telas sem fundo) */
  svg: string;
  /** camadas HTML por cima do SVG (cartão, telas) */
  html: string;
  kfs: Keyframe[];
  /** fundo sólido quando não há cena (resultado) */
  fundo?: string;
};

export type ContextoPlano = {
  px: string;
  dur: number;
  itens: string[];
  semente: string;
};

/** Vistas extras pedidas por ações `virar` (a instância precisa ter o desenho delas). */
function vistasExtras(p: PlanoCena): Record<string, VistaBase[]> {
  const out: Record<string, VistaBase[]> = {};
  for (const pc of p.personagens) {
    if (pc.acao?.tipo === "virar" && typeof pc.acao.vista === "string") {
      (out[pc.id] ??= []).push(parseVista(pc.acao.vista as never).base);
    }
  }
  return out;
}

export function comporCena(p: PlanoCena, ctx: ContextoPlano): PlanoComposto {
  const spec: CenaSpec = {
    px: ctx.px,
    cenario: p.cenario,
    luz: p.luz ?? "normal",
    itens: ctx.itens,
    personagens: p.personagens.map((pc) => ({ id: pc.id, vista: pc.vista, pose: pc.pose, x: pc.x, y: pc.y, escala: pc.escala })),
    vistasExtras: vistasExtras(p),
  };
  const m = montarCena(spec);
  const kfs = [...m.kfs];

  // ações
  m.instancias.forEach((inst, i) => {
    const acao = p.personagens[i].acao;
    if (!acao) return;
    kfs.push(
      ...kfsAcao(acao as never, {
        id: inst.spec.id,
        inst: inst.inst,
        vista: inst.base,
        espelho: inst.espelho,
        pos: inst.pos,
        poseBase: inst.spec.pose,
        extras: extrasDaInstancia(inst.spec, ctx.itens),
        dur: ctx.dur,
        semente: `${ctx.semente}-${inst.inst}`,
      }),
    );
  });

  // o feixe da lanterna acompanha quem a segura quando anda
  const dono = m.instancias.find((i) => i.inst === m.lanterna?.dono);
  if (dono) {
    const mov = kfs.filter((k) => k.alvo === `#${dono.inst}` && (k.prop === "x" || k.prop === "y") && k.t + (k.dur ?? 0) > 0);
    for (const k of mov) {
      const v0 = k.prop === "x" ? dono.pos.x : dono.pos.y;
      for (const alvo of [`#${ctx.px}-cone`, `#${ctx.px}-brilho`]) kfs.push({ ...k, alvo, v: Math.round(((k.v as number) - v0) * 10) / 10 });
    }
  }

  // câmera: âncoras do cenário + cada personagem pelo id (foco na cabeça)
  const ancoras = { ...cenario(p.cenario).ancoras };
  for (const i of m.instancias) ancoras[i.spec.id] ??= { x: i.pos.x, y: i.pos.y - 420 * i.pos.escala };
  kfs.push(...kfsCamera(ctx.px, p.camera, ctx.dur, ancoras, `${ctx.semente}-cam`));

  // efeitos de luz
  if (p.efeitos.includes("piscar_luz")) kfs.push(...kfsPiscar(ctx.px, `${ctx.semente}-piscar`, ctx.dur, 0));
  if (p.efeitos.includes("apagao")) {
    // apagão no meio do plano: corte seco para quase preto
    if (!p.efeitos.includes("piscar_luz")) kfs.push({ alvo: `#${ctx.px}-piscar`, prop: "opacity", t: 0, v: 0 });
    kfs.push({ alvo: `#${ctx.px}-piscar`, prop: "opacity", t: Math.min(ctx.dur * 0.5, ctx.dur - 0.5), v: 0.93 });
  }

  let html = "";
  if (p.cartao) {
    const c = camadaCartao(ctx.px, p.cartao, 0.25, ctx.dur);
    html += c.html;
    kfs.push(...c.kfs);
  }
  return { svg: m.svg, html, kfs };
}

/** Último quadro de uma cena como keyframes estáticos em t=0 (fundo da votação). */
export function congelar(p: PlanoCena, ctx: ContextoPlano, durOriginal: number): PlanoComposto {
  const c = comporCena(p, { ...ctx, dur: durOriginal });
  const fim = valoresFinais(c.kfs);
  const kfs: Keyframe[] = [...fim].map(([chave, v]) => {
    const i = chave.lastIndexOf("|");
    return { alvo: chave.slice(0, i), prop: chave.slice(i + 1), t: 0, v };
  });
  return { svg: c.svg, html: "", kfs };
}

/** Plano de qualquer tipo → conteúdo. `anterior` é a última cena (para congelar). */
export function comporPlano(ep: Episodio, idx: number, ctx: ContextoPlano, duracoes: number[]): PlanoComposto {
  const p = ep.planos[idx];
  const cenaAnterior = (): { p: PlanoCena; dur: number } | undefined => {
    for (let i = idx - 1; i >= 0; i--) if (ep.planos[i].tipo === "cena") return { p: ep.planos[i] as PlanoCena, dur: duracoes[i] };
    return undefined;
  };
  switch (p.tipo) {
    case "cena":
      return comporCena(p, ctx);
    case "resultado": {
      const r = ep.resultado_anterior;
      if (!r) return { svg: "", html: "", kfs: [], fundo: FUNDO_TELA };
      const t = telaResultado(ctx.px, { opcao: r.opcao, pct_a: r.pct_a, pct_b: r.pct_b }, ctx.dur);
      return { svg: "", html: t.html, kfs: t.kfs, fundo: FUNDO_TELA };
    }
    case "votacao":
    case "continua": {
      const ant = cenaAnterior();
      const base = ant ? congelar(ant.p, ctx, ant.dur) : { svg: "", html: "", kfs: [] };
      const t = p.tipo === "votacao" ? telaVotacao(ctx.px, { rotulo: p.opcao_a.rotulo }, { rotulo: p.opcao_b.rotulo }, ctx.dur) : telaContinua(ctx.px);
      // o cartão da cena congelada não entra (a tela tem os próprios cartões)
      return { svg: base.svg, html: t.html, kfs: [...base.kfs, ...t.kfs], fundo: ant ? undefined : FUNDO_TELA };
    }
    case "cartao": {
      const c = camadaCartao(ctx.px, p.cartao, 0.15, ctx.dur);
      return { svg: "", html: c.html, kfs: c.kfs, fundo: FUNDO_TELA };
    }
    case "infografico":
      // Fase 1: infográficos ficam para quando um roteiro pedir (proibidos no EP1)
      throw new Error(`infográfico ${p.infografico.id} ainda não implementado`);
  }
}

export const FUNDO_TELA = "radial-gradient(ellipse at 50% 35%, #1B1F28 0%, #07080B 75%)";
