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
};

export function montarCena(spec: CenaSpec): { svg: string; kfs: Keyframe[]; instancias: InstanciaCena[]; lanterna?: OrigemLanterna } {
  const c = cenario(spec.cenario);
  const instancias: InstanciaCena[] = spec.personagens.map((p, i) => {
    const { base, espelho } = parseVista(p.vista);
    const escala = p.escala ?? 1;
    const vistas = Array.from(new Set<VistaBase>([base, ...(spec.vistasExtras?.[p.id] ?? [])]));
    return {
      inst: `${spec.px}-${p.id}${i}`,
      spec: p,
      base,
      espelho,
      vistas,
      pos: { x: p.x * 1080, y: p.y !== undefined ? p.y * 1920 : c.chaoY, escala, espelho },
      // vulto atrás da janela: só aparece pelo recorte do lado de fora
      fora: !!c.recorteExterno && p.id === "criatura_vulto" && p.y !== undefined && p.y * 1920 < c.chaoY - 200,
    };
  });

  // profundidade: menor escala (mais longe) primeiro; depois quem está mais alto
  const ordem = [...instancias].sort((a, b) => a.pos.escala - b.pos.escala || a.pos.y - b.pos.y);
  const svgDe = (i: InstanciaCena) => svgInstancia(personagem(i.spec.id).d, i.inst, i.vistas, i.base);

  const fora = ordem.filter((i) => i.fora);
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
  return { svg, kfs, instancias, lanterna };
}
