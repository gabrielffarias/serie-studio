// Um plano do roteiro → conteúdo visual (SVG + camadas HTML) e keyframes na
// timeline local do plano (0 = início do plano).
import type { Keyframe } from "../core/keyframes";
import { amostrador, valoresFinais } from "../core/keyframes";
import { kfsAcao } from "../acoes/acoes";
import { kfsCamera } from "../camera/camera";
import { cenario } from "../cenario/cenarios";
import { kfsFeixe, kfsPiscar, type OrigemLanterna } from "../luz/luz";
import { prefixoVista } from "../rig/instancia";
import { camadaCartao } from "../hud/cartao";
import { telaContinua, telaResultado, telaVotacao } from "../hud/telas";
import type { PoseResolvida, VistaBase } from "../rig/tipos";
import type { LuzDoPlano } from "../../src/lib/luz";
import type { Episodio, Plano } from "../../src/lib/episodio-schema";
import { kfsPassagem, PASSAGEM } from "./vulto";
import { extrasDaInstancia, feixeDaMao, montarCena, parseVista, type CenaSpec, type InstanciaCena } from "./cena";

export type PlanoCena = Extract<Plano, { tipo: "cena" }>;

export type PlanoComposto = {
  /** SVG da cena (vazio em telas sem fundo) */
  svg: string;
  /** camadas HTML por cima do SVG (cartão, telas) */
  html: string;
  kfs: Keyframe[];
  /** fundo sólido quando não há cena (resultado) */
  fundo?: string;
  /** o que o compose ajustou ou não conseguiu resolver (arranjo, pés) */
  avisos?: string[];
};

export type ContextoPlano = {
  px: string;
  dur: number;
  itens: string[];
  semente: string;
  /** luz ambiente de cada plano de cena (percorrerLuz a partir do estado) */
  luzes?: Record<string, LuzDoPlano>;
  /** antes do EP5: o vulto só passa rápido por uma janela (engine/compose/vulto.ts) */
  passagemVulto?: boolean;
};

/** passo da amostragem do feixe durante as ações (s) */
const PASSO_FEIXE = 0.1;

/** Ângulo equivalente mais perto do anterior (o feixe não dá a volta inteira). */
const continuo = (a: number, ant: number) => a + 360 * Math.round((ant - a) / 360);

/**
 * O feixe acompanha quem segura a lanterna: amostra a raiz, a vista e as
 * juntas do braço ao longo do plano e move/gira o cone junto com a mão.
 */
function kfsFeixeSeguindo(px: string, dono: InstanciaCena, o0: OrigemLanterna, kfs: Keyframe[], dur: number): Keyframe[] {
  if (o0.alvo) return [];
  const s = amostrador(kfs);
  const out: Keyframe[] = [];
  let ant = { x: o0.x, y: o0.y, angulo: o0.angulo };
  let tAnt = 0;
  for (let t = PASSO_FEIXE; t <= dur + 1e-6; t += PASSO_FEIXE) {
    const raiz = `#${dono.inst}`;
    const x = s(raiz, "x", t, dono.pos.x), y = s(raiz, "y", t, dono.pos.y);
    let o = { x: o0.x + x - dono.pos.x, y: o0.y + y - dono.pos.y, angulo: o0.angulo };
    if (o0.naMao) {
      const base = dono.vistas.find((v) => s(`#${prefixoVista(dono.inst, v)}`, "opacity", t, v === dono.base ? 1 : 0) > 0.5) ?? dono.base;
      if (base === "costas") {
        tAnt = t;
        continue;
      }
      const pv = prefixoVista(dono.inst, base);
      const sx = s(`${raiz}-espelho`, "scaleX", t, dono.pos.espelho ? -dono.pos.escala : dono.pos.escala);
      const ang = (j: string) => s(`#${pv}-${j}`, "rotation", t, 0);
      const pr = {
        angulos: { tronco: ang("tronco"), braco_d: ang("braco_d"), antebraco_d: ang("antebraco_d"), mao_d: ang("mao_d") } as PoseResolvida["angulos"],
        escalas: { braco_d: s(`#${pv}-braco_d-seg`, "scaleY", t, 1), antebraco_d: s(`#${pv}-antebraco_d-seg`, "scaleY", t, 1) } as PoseResolvida["escalas"],
        corpo_y: s(`#${pv}-corpo`, "y", t, 0),
      };
      o = feixeDaMao(dono.spec.id, base, pr, { x, y, escala: Math.abs(sx), espelho: sx < 0 });
    }
    o.angulo = continuo(o.angulo, ant.angulo);
    if (Math.abs(o.x - ant.x) > 0.5 || Math.abs(o.y - ant.y) > 0.5 || Math.abs(o.angulo - ant.angulo) > 0.3) {
      out.push(...kfsFeixe(px, { ...o0, ...o }, Math.round(tAnt * 1000) / 1000, Math.round((t - tAnt) * 1000) / 1000));
      ant = o;
    }
    tAnt = t;
  }
  return out;
}

/**
 * Evento de luz no meio do plano: corte para quase preto, troca a camada
 * ambiente (amb0 → amb1) e a nova luz acende.
 */
function kfsEventoLuz(px: string, luz: LuzDoPlano, dur: number, temPiscar: boolean): Keyframe[] {
  const tm = Math.round(Math.min(dur * 0.5, dur - 0.6) * 100) / 100;
  const kfs: Keyframe[] = [
    { alvo: `#${px}-amb0`, prop: "opacity", t: tm, v: 0 },
    { alvo: `#${px}-amb1`, prop: "opacity", t: tm, v: 1 },
    { alvo: `#${px}-piscar`, prop: "opacity", t: tm, v: 0.95 },
    { alvo: `#${px}-piscar`, prop: "opacity", t: tm + 0.35, v: 0, dur: 0.25, ease: "power1.in" },
  ];
  if (!temPiscar) kfs.unshift({ alvo: `#${px}-piscar`, prop: "opacity", t: 0, v: 0 });
  if (luz.inicio === "escuro" || luz.fim === "escuro") kfs.push({ alvo: `#${px}-aro-g`, prop: "opacity", t: tm, v: luz.fim === "escuro" ? 1 : 0 });
  return kfs;
}

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
  const luz: LuzDoPlano = ctx.luzes?.[p.id] ?? { id: p.id, local: p.cenario, inicio: p.luz ?? "normal", fim: p.luz ?? "normal" };
  const spec: CenaSpec = {
    px: ctx.px,
    cenario: p.cenario,
    luz: luz.inicio,
    luzFim: luz.fim,
    lanterna: p.lanterna,
    itens: ctx.itens,
    personagens: p.personagens.map((pc) => ({
      id: pc.id, vista: pc.vista, pose: pc.pose, x: pc.x, y: pc.y, escala: pc.escala,
      // quem entra de fora do quadro não entra no arranjo
      livre: pc.acao?.tipo === "entrar" || pc.x < 0 || pc.x > 1,
    })),
    vistasExtras: vistasExtras(p),
    passagemVulto: ctx.passagemVulto,
  };
  const m = montarCena(spec);
  const kfs = [...m.kfs];

  // ações
  m.instancias.forEach((inst, i) => {
    const acao = p.personagens[i].acao;
    if (inst.passagem) {
      // a travessia substitui a ação do roteiro; começa no em_s dela
      const t0 = Math.min(acao?.em_s ?? 0.3, Math.max(0, ctx.dur - PASSAGEM.dur - 0.1));
      kfs.push(...kfsPassagem(inst.inst, inst.passagem, t0));
      return;
    }
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

  // o feixe da lanterna acompanha a mão (ou a cabeça) de quem a segura
  const dono = m.instancias.find((i) => i.inst === m.lanterna?.dono);
  if (dono && m.lanterna) kfs.push(...kfsFeixeSeguindo(ctx.px, dono, m.lanterna, kfs, ctx.dur));

  // câmera: âncoras do cenário + cada personagem pelo id (foco na cabeça)
  const ancoras = { ...cenario(p.cenario).ancoras };
  for (const i of m.instancias) ancoras[i.spec.id] ??= { x: i.pos.x, y: i.pos.y - 420 * i.pos.escala };
  kfs.push(...kfsCamera(ctx.px, p.camera, ctx.dur, ancoras, `${ctx.semente}-cam`));

  // efeitos de luz: piscar e o evento que muda a luz ambiente
  if (p.efeitos.includes("piscar_luz")) kfs.push(...kfsPiscar(ctx.px, `${ctx.semente}-piscar`, ctx.dur, 0));
  if (luz.evento) kfs.push(...kfsEventoLuz(ctx.px, luz, ctx.dur, p.efeitos.includes("piscar_luz")));
  else if (!p.efeitos.includes("piscar_luz")) kfs.push({ alvo: `#${ctx.px}-piscar`, prop: "opacity", t: 0, v: 0 });

  let html = "";
  if (p.cartao) {
    const c = camadaCartao(ctx.px, p.cartao, 0.25, ctx.dur);
    html += c.html;
    kfs.push(...c.kfs);
  }
  return { svg: m.svg, html, kfs, avisos: m.avisos.map((a) => `${p.id}: ${a}`) };
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
