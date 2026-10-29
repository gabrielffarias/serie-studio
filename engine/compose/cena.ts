// Monta um plano de cena: cenário (fundo/frente), personagens em ordem de
// profundidade, vultos "lá fora" recortados pela janela, câmera e luz.
// Devolve o SVG e os keyframes de t=0; o compose acrescenta as ações.
import type { Keyframe } from "../core/keyframes";
import { cenario } from "../cenario/cenarios";
import { brilhoLanterna, camadaAmbiente, camadaPiscar, contornoDeLuz, kfsFeixe, mascaraLanterna, type Luz, type OrigemLanterna } from "../luz/luz";
import { kfsPose, kfsRaiz, kfsVista, svgInstancia } from "../rig/instancia";
import { personagem, pose } from "../rig/personagens";
import { PONTA_LANTERNA_MAO } from "../../assets/personagens/caio/rig.svg";
import type { PoseResolvida, VistaBase } from "../rig/tipos";
import type { Retangulo } from "../cenario/tipos";
import { arranjar, ordemDeDesenho, type CorpoArranjo } from "./arranjo";
import { janelaMaisPerto, POSE_PASSAGEM, svgPassagem, trajetoPassagem } from "./vulto";

export type VistaCena = "frente" | "costas" | "perfil_esq" | "perfil_dir" | "3/4_esq" | "3/4_dir";

export type PersonagemCena = {
  id: string;
  vista: VistaCena;
  pose: string;
  /** 0–1 na largura do quadro */
  x: number;
  /** 0–1 na altura; padrão = chão do cenário */
  y?: number;
  escala?: number;
  /** fora do arranjo (ex.: entra de fora do quadro) */
  livre?: boolean;
};

export type CenaSpec = {
  px: string;
  cenario: string;
  /** luz ambiente do local no início do plano */
  luz: Luz;
  /** luz depois do evento de luz do plano (troca no meio) */
  luzFim?: Luz;
  /** camada de lanterna acesa */
  lanterna?: boolean;
  personagens: PersonagemCena[];
  /** itens do estado (ex.: lanterna_cabeca liga o acessório do Caio) */
  itens?: string[];
  /** vistas extras que o plano vai usar (ação `virar`) */
  vistasExtras?: Record<string, VistaBase[]>;
  /** antes do EP5: o vulto só passa rápido por uma janela, cortado pela moldura */
  passagemVulto?: boolean;
};

export function parseVista(v: VistaCena): { base: VistaBase; espelho: boolean } {
  if (v === "frente" || v === "costas") return { base: v, espelho: false };
  const [base, lado] = v.split("_") as [VistaBase, "esq" | "dir"];
  return { base, espelho: lado === "esq" };
}

/** Acessórios ligados pelos itens do estado. */
export function extrasDosItens(idPersonagem: string, itens: string[] = []): Record<string, boolean> {
  return idPersonagem === "caio" && itens.includes("lanterna_cabeca") ? { lanterna_cabeca: true } : {};
}

/** Pose em que o Caio segura a lanterna de mão: o feixe sai da mão. */
export const POSE_LANTERNA_MAO = "segurar_lanterna";

/**
 * Acessórios de uma instância: os itens do estado e o que a pose segura. Quem
 * começa o plano com a lanterna de mão continua com ela durante as ações.
 */
export function extrasDaInstancia(p: { id: string; pose: string }, itens: string[] = []): Record<string, boolean> {
  return { ...extrasDosItens(p.id, itens), ...(p.pose === POSE_LANTERNA_MAO ? { lanterna_mao: true } : {}) };
}

/**
 * Origem e direção do feixe da lanterna de mão para uma pose (ângulos, escalas,
 * corpo_y) e uma posição na cena. Usado no início do plano e, no compose, a
 * cada amostra durante as ações (o feixe acompanha a mão).
 */
export function feixeDaMao(
  id: string,
  base: VistaBase,
  pr: Pick<PoseResolvida, "angulos" | "escalas" | "corpo_y">,
  pos: { x: number; y: number; escala: number; espelho: boolean },
): { x: number; y: number; angulo: number } {
  const { d } = personagem(id);
  const ponta = d.pontaDaMao!(base, pr as PoseResolvida, "d", PONTA_LANTERNA_MAO);
  const dir = pos.espelho ? -1 : 1;
  return {
    x: pos.x + dir * ponta.x * pos.escala,
    y: pos.y + ponta.y * pos.escala,
    angulo: pos.espelho ? 180 - ponta.angulo : ponta.angulo,
  };
}

export type InstanciaCena = {
  inst: string;
  spec: PersonagemCena;
  base: VistaBase;
  espelho: boolean;
  vistas: VistaBase[];
  pos: { x: number; y: number; escala: number; espelho: boolean };
  fora: boolean;
  /** passagem do vulto pela janela (o compose anima a travessia) */
  passagem?: { janela: Retangulo; x0: number; x1: number };
};

export const ID_VULTO = "criatura_vulto";

export function montarCena(spec: CenaSpec): {
  svg: string;
  kfs: Keyframe[];
  instancias: InstanciaCena[];
  lanterna?: OrigemLanterna;
  /** o que o arranjo mudou ou não conseguiu resolver */
  avisos: string[];
} {
  const c = cenario(spec.cenario);
  const avisos: string[] = [];
  const pegadaDe = (p: PersonagemCena, base: VistaBase) =>
    personagem(p.id).d.pegada!(base, pose(p.id, p.pose, base, extrasDaInstancia(p, spec.itens)));
  const instancias: InstanciaCena[] = spec.personagens.map((p, i) => {
    const { base, espelho } = parseVista(p.vista);
    const escala = p.escala ?? 1;
    const vistas = Array.from(new Set<VistaBase>([base, ...(spec.vistasExtras?.[p.id] ?? [])]));
    const inst = `${spec.px}-${p.id}${i}`;
    const pos = { x: p.x * 1080, y: p.y !== undefined ? p.y * 1920 : c.chaoY, escala, espelho };
    if (p.id === ID_VULTO && spec.passagemVulto) {
      if (!c.janelas?.length) throw new Error(`${inst}: antes do EP5 o vulto só passa por uma janela, e ${c.id} não tem janelas`);
      // pose própria da passagem: braços para trás, só cabeça e ombro no alto
      const sp = { ...p, pose: POSE_PASSAGEM };
      const janela = janelaMaisPerto(c.janelas, pos.x);
      const tr = trajetoPassagem(janela, pegadaDe(sp, base), escala, espelho ? -1 : 1);
      return { inst, spec: sp, base, espelho, vistas, pos: { ...pos, x: tr.x0, y: tr.y }, fora: true, passagem: { janela, x0: tr.x0, x1: tr.x1 } };
    }
    // vulto atrás da janela: só aparece pelo recorte do lado de fora
    const fora = !!c.recorteExterno && p.id === ID_VULTO && p.y !== undefined && p.y * 1920 < c.chaoY - 200;
    return { inst, spec: p, base, espelho, vistas, pos, fora };
  });

  // arranjo: quem senta vai para o assento; ninguém encosta em ninguém no mesmo
  // plano e ninguém cobre os pés de quem está atrás (engine/compose/arranjo.ts)
  const arranjaveis = instancias.filter((i) => !i.fora && !i.spec.livre);
  const corpos: CorpoArranjo[] = arranjaveis.map((i) => {
    const g = pegadaDe(i.spec, i.base);
    if (g.cobrePes.length) avisos.push(`${i.inst}: ${g.cobrePes.join(", ")} cobre os pés na pose ${i.spec.pose}`);
    let faixa: [number, number] | undefined;
    if (i.spec.pose === "sentado" && c.assentos?.length) {
      const a = [...c.assentos].sort((p, q) => Math.abs((p.x0 + p.x1) / 2 - i.pos.x) - Math.abs((q.x0 + q.x1) / 2 - i.pos.x))[0];
      faixa = [a.x0, a.x1];
      i.pos.y = a.y;
    }
    return { id: i.inst, x: i.pos.x, y: i.pos.y, escala: i.pos.escala, espelho: i.espelho, esq: g.esq, dir: g.dir, topo: g.topo, pes: g.pes, faixa };
  });
  const arr = arranjar(corpos);
  arranjaveis.forEach((i, k) => (i.pos.x = arr.x[k]));
  avisos.push(...arr.ajustes.map((a) => `arranjo ${a}`), ...arr.problemas);

  // profundidade: menor escala (mais longe) primeiro; depois quem está mais alto
  const ordem = ordemDeDesenho(instancias.map((i) => ({ i, escala: i.pos.escala, y: i.pos.y }))).map((o) => o.i);
  const svgDe = (i: InstanciaCena) => {
    const svg = svgInstancia(personagem(i.spec.id).d, i.inst, i.vistas, i.base);
    return i.passagem ? svgPassagem(i.inst, i.passagem.janela, svg) : svg;
  };

  const fora = ordem.filter((i) => i.fora && !i.passagem);
  const passagens = ordem.filter((i) => i.passagem);
  const dentro = ordem.filter((i) => !i.fora);

  const kfs: Keyframe[] = [];
  for (const i of instancias) {
    const { d } = personagem(i.spec.id);
    const extras = extrasDaInstancia(i.spec, spec.itens);
    kfs.push(...kfsRaiz(i.inst, i.pos, 0));
    kfs.push(...kfsVista(i.inst, i.vistas, i.base, 0));
    for (const v of i.vistas) kfs.push(...kfsPose(d, i.inst, v, pose(i.spec.id, v === i.base ? i.spec.pose : "em_pe", v, extras), 0));
  }

  // lanterna (camada): sai da mão de quem está na pose segurar_lanterna; senão
  // da cabeça de quem tem a lanterna de cabeça; sem ninguém, vem de baixo (ponto de vista)
  let lanterna: OrigemLanterna | undefined;
  if (spec.lanterna) {
    const naMao = instancias.find((i) => i.spec.pose === POSE_LANTERNA_MAO);
    const dono = naMao ?? instancias.find((i) => extrasDosItens(i.spec.id, spec.itens).lanterna_cabeca);
    if (!dono) {
      lanterna = { x: 540, y: 2000, angulo: -90 };
    } else if (dono.base === "costas") {
      // de costas, ilumina o que está à frente dele: a âncora principal do cenário
      const { d } = personagem(dono.spec.id);
      const alvo = Object.values(c.ancoras)[0] ?? { x: 540, y: 820 };
      lanterna = { x: dono.pos.x, y: dono.pos.y - (d.alturaCabeca + 88) * dono.pos.escala, angulo: 90, alvo, dono: dono.inst };
    } else if (dono === naMao) {
      const pr = pose(dono.spec.id, dono.spec.pose, dono.base, extrasDaInstancia(dono.spec, spec.itens));
      lanterna = { ...feixeDaMao(dono.spec.id, dono.base, pr, dono.pos), dono: dono.inst, naMao: true };
    } else {
      const { d } = personagem(dono.spec.id);
      const dir = dono.espelho ? -1 : 1;
      const frontal = dono.base === "frente";
      lanterna = {
        x: dono.pos.x + (frontal ? 0 : dir * 80 * dono.pos.escala),
        y: dono.pos.y - (d.alturaCabeca + 88) * dono.pos.escala,
        angulo: frontal ? 90 : dono.espelho ? 168 : 12,
        dono: dono.inst,
      };
    }
  }

  // luz ambiente do local dentro da câmera (a lanterna recorta e soma por cima);
  // com evento de luz, o compose troca do grupo amb0 para o amb1 no meio do plano
  const comMascara = !!lanterna;
  const luzFim = spec.luzFim ?? spec.luz;
  const temEscuro = spec.luz === "escuro" || luzFim === "escuro";
  const svg =
    `<g id="${spec.px}-cam">` +
    `<g id="${spec.px}-fundo">${c.fundo(spec.px)}</g>` +
    (fora.length
      ? `<defs><clipPath id="${spec.px}-fora"><path d="${c.recorteExterno}"/></clipPath></defs><g clip-path="url(#${spec.px}-fora)">${fora.map(svgDe).join("")}</g>`
      : "") +
    passagens.map(svgDe).join("") +
    dentro.map(svgDe).join("") +
    (c.frente ? `<g id="${spec.px}-frente">${c.frente(spec.px)}</g>` : "") +
    (lanterna ? mascaraLanterna(spec.px, lanterna) : "") +
    camadaAmbiente(spec.px, `${spec.px}-amb0`, spec.luz, comMascara) +
    (luzFim !== spec.luz ? camadaAmbiente(spec.px, `${spec.px}-amb1`, luzFim, comMascara) : "") +
    (temEscuro ? contornoDeLuz(spec.px, dentro.map((i) => i.inst), comMascara) : "") +
    (lanterna ? brilhoLanterna(spec.px, lanterna) : "") +
    `</g>` +
    camadaPiscar(spec.px);

  kfs.push(
    { alvo: `#${spec.px}-cam`, prop: "scale", t: 0, v: 1 },
    { alvo: `#${spec.px}-cam`, prop: "x", t: 0, v: 0 },
    { alvo: `#${spec.px}-cam`, prop: "y", t: 0, v: 0 },
    { alvo: `#${spec.px}-amb0`, prop: "opacity", t: 0, v: 1 },
  );
  if (luzFim !== spec.luz) kfs.push({ alvo: `#${spec.px}-amb1`, prop: "opacity", t: 0, v: 0 });
  if (temEscuro) kfs.push({ alvo: `#${spec.px}-aro-g`, prop: "opacity", t: 0, v: spec.luz === "escuro" ? 1 : 0 });
  if (lanterna) kfs.push(...kfsFeixe(spec.px, lanterna, 0));
  return { svg, kfs, instancias, lanterna, avisos };
}
