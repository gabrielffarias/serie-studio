// Monta um plano de cena: cenário (fundo/frente), personagens em ordem de
// profundidade, vultos "lá fora" recortados pela janela, câmera e luz.
// Devolve o SVG e os keyframes de t=0; o compose acrescenta as ações.
import type { Keyframe } from "../core/keyframes";
import { cenario } from "../cenario/cenarios";
import { camadaLuz, camadaPiscar, contornoDeLuz, type Luz, type OrigemLanterna } from "../luz/luz";
import { kfsPose, kfsRaiz, kfsVista, svgInstancia } from "../rig/instancia";
import { personagem, pose } from "../rig/personagens";
import { PONTA_LANTERNA_MAO } from "../../assets/personagens/caio/rig.svg";
import type { VistaBase } from "../rig/tipos";

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
  luz: Luz;
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

  // lanterna: sai da mão de quem está na pose segurar_lanterna; senão da cabeça
  // de quem tem a lanterna de cabeça; sem ninguém, vem de baixo (ponto de vista)
  let lanterna: OrigemLanterna | undefined;
  if (spec.luz === "lanterna") {
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
      const { d } = personagem(dono.spec.id);
      const pr = pose(dono.spec.id, dono.spec.pose, dono.base, extrasDaInstancia(dono.spec, spec.itens));
      const ponta = d.pontaDaMao!(dono.base, pr, "d", PONTA_LANTERNA_MAO);
      const dir = dono.espelho ? -1 : 1;
      lanterna = {
        x: dono.pos.x + dir * ponta.x * dono.pos.escala,
        y: dono.pos.y + ponta.y * dono.pos.escala,
        angulo: dono.espelho ? 180 - ponta.angulo : ponta.angulo,
        dono: dono.inst,
      };
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

  const svg =
    `<g id="${spec.px}-cam">` +
    `<g id="${spec.px}-fundo">${c.fundo(spec.px)}</g>` +
    (fora.length
      ? `<defs><clipPath id="${spec.px}-fora"><path d="${c.recorteExterno}"/></clipPath></defs><g clip-path="url(#${spec.px}-fora)">${fora.map(svgDe).join("")}</g>`
      : "") +
    dentro.map(svgDe).join("") +
    (c.frente ? `<g id="${spec.px}-frente">${c.frente(spec.px)}</g>` : "") +
    // a lanterna fica dentro da câmera (o cone acompanha o zoom) e ganha o contorno de luz por cima
    (spec.luz === "lanterna" ? camadaLuz(spec.px, spec.luz, lanterna) + contornoDeLuz(spec.px, dentro.map((i) => i.inst)) : "") +
    `</g>` +
    (spec.luz === "lanterna" ? "" : camadaLuz(spec.px, spec.luz, lanterna)) +
    camadaPiscar(spec.px);

  kfs.push(
    { alvo: `#${spec.px}-cam`, prop: "scale", t: 0, v: 1 },
    { alvo: `#${spec.px}-cam`, prop: "x", t: 0, v: 0 },
    { alvo: `#${spec.px}-cam`, prop: "y", t: 0, v: 0 },
  );
  return { svg, kfs, instancias, lanterna };
}
