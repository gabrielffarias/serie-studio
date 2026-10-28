// Uma instância de personagem em cena: SVG com as vistas necessárias e os
// keyframes que posicionam, trocam vista, aplicam pose e expressão.
import type { Keyframe } from "../core/keyframes";
import { desenharHumano, filhos, GESTOS_MAO, pontaDaMao } from "./humano";
import { EXPRESSOES, JUNTAS, type Figurino, type Junta, type PoseResolvida, type VistaBase } from "./tipos";

export const slugVista = (v: VistaBase) => (v === "3/4" ? "tq" : v);
export const prefixoVista = (inst: string, v: VistaBase) => `${inst}-${slugVista(v)}`;

/** Personagem desenhável: humano (Figurino) ou outro rig com a mesma interface. */
export type Desenhavel = {
  id: string;
  nome: string;
  desenhar(v: VistaBase, px: string): string;
  acessoriosPadrao(): Record<string, boolean>;
  temRosto: boolean;
  /** segmentos encolhíveis: junta filha e comprimento */
  filhos: Partial<Record<Junta, { filho: Junta; L: number }>>;
  /** acessórios pendurados e a cadeia de juntas até eles (contra-giro) */
  pendurados: Record<string, Junta[]>;
  /** raio da sombra de contato */
  sombraRx: number;
  /** altura do centro da cabeça acima do chão, na escala 1 */
  alturaCabeca: number;
  /** opacidade do desenho (vulto = 0,9) */
  opacidade?: number;
  /** ponta da mão (+ `alem` px no eixo do antebraço) e direção, na escala 1 olhando à direita */
  pontaDaMao?(v: VistaBase, pose: PoseResolvida, lado: "d" | "e", alem?: number): { x: number; y: number; angulo: number };
};

export function desenhavelHumano(f: Figurino): Desenhavel {
  return {
    id: f.id,
    nome: f.nome,
    desenhar: (v, px) => desenharHumano(f, v, px),
    acessoriosPadrao: () => ({
      ...(f.semRosto ? {} : Object.fromEntries(Object.keys(GESTOS_MAO).map((k) => [k, false]))),
      ...Object.fromEntries(Object.entries(f.acessorios ?? {}).map(([k, a]) => [k, a.padrao])),
    }),
    temRosto: !f.semRosto,
    filhos: filhos(f),
    pendurados: Object.fromEntries(
      Object.entries(f.acessorios ?? {})
        .filter(([, a]) => a.pendurado && a.junta.startsWith("mao_"))
        .map(([nome, a]) => {
          const lado = a.junta.slice(-1);
          return [nome, ["tronco", `braco_${lado}`, `antebraco_${lado}`, `mao_${lado}`] as Junta[]];
        }),
    ),
    sombraRx: Math.round(f.prop.cabecaR * 1.27),
    alturaCabeca: f.prop.quadril + f.prop.cabeca,
    pontaDaMao: (v, pose, lado, alem) => pontaDaMao(f, v, pose, lado, alem),
  };
}

/** SVG da instância: raiz posicionável (#inst), sombra e um grupo por vista. */
export function svgInstancia(d: Desenhavel, inst: string, vistas: VistaBase[], vistaInicial: VistaBase): string {
  const grupos = vistas
    .map((v) => {
      const px = prefixoVista(inst, v);
      return `<g id="${px}" opacity="${v === vistaInicial ? 1 : 0}">${d.desenhar(v, px)}</g>`;
    })
    .join("");
  return (
    `<g id="${inst}"><g id="${inst}-espelho">` +
    // opacidade por variável: a cópia de contorno (luz de lanterna) zera a sombra
    `<ellipse id="${inst}-sombra" cx="0" cy="4" rx="${d.sombraRx}" ry="22" fill="#000" style="opacity:var(--sombra,.25)"/>` +
    (d.opacidade !== undefined && d.opacidade < 1 ? `<g opacity="${d.opacidade}">${grupos}</g>` : grupos) +
    `</g></g>`
  );
}

/** Keyframes de pose numa vista: juntas, corpo, expressão e acessórios. */
export function kfsPose(
  d: Desenhavel,
  inst: string,
  v: VistaBase,
  pose: PoseResolvida,
  t: number,
  dur = 0,
  ease = "power2.out",
): Keyframe[] {
  const px = prefixoVista(inst, v);
  const kfs: Keyframe[] = [];
  for (const j of JUNTAS) kfs.push({ alvo: `#${px}-${j}`, prop: "rotation", t, v: pose.angulos[j], dur, ease });
  for (const [j, f] of Object.entries(d.filhos) as [Junta, { filho: Junta; L: number }][]) {
    const s = pose.escalas[j];
    kfs.push({ alvo: `#${px}-${j}-seg`, prop: "scaleY", t, v: s, dur, ease });
    kfs.push({ alvo: `#${px}-${f.filho}-pos`, prop: "y", t, v: Math.round(f.L * (s - 1) * 10) / 10, dur, ease });
  }
  kfs.push({ alvo: `#${px}-cabeca`, prop: "scaleX", t, v: pose.cabeca_virada ? -1 : 1 });
  kfs.push({ alvo: `#${px}-corpo`, prop: "y", t, v: pose.corpo_y, dur, ease });
  if (d.temRosto && v !== "costas") {
    for (const e of EXPRESSOES) kfs.push({ alvo: `#${px}-rosto-${e}`, prop: "opacity", t, v: e === pose.expressao ? 1 : 0 });
  }
  for (const [nome, cadeia] of Object.entries(d.pendurados)) {
    const soma = cadeia.reduce((s, j) => s + pose.angulos[j], 0);
    kfs.push({ alvo: `#${px}-ac-${nome}`, prop: "rotation", t, v: Math.round(-soma * 100) / 100 + 0, dur, ease });
  }
  for (const [nome, ligado] of Object.entries(pose.acessorios)) {
    kfs.push({ alvo: `#${px}-ac-${nome}`, prop: "opacity", t, v: ligado ? 1 : 0 });
  }
  return kfs;
}

/** Liga uma vista e desliga as outras (corte seco). */
export function kfsVista(inst: string, vistas: VistaBase[], ativa: VistaBase, t: number): Keyframe[] {
  return vistas.map((v) => ({ alvo: `#${prefixoVista(inst, v)}`, prop: "opacity", t, v: v === ativa ? 1 : 0 }));
}

/** Posição da raiz em px do quadro; `espelho` = olhando para a esquerda. */
export function kfsRaiz(
  inst: string,
  pos: { x: number; y: number; escala: number; espelho: boolean },
  t: number,
  dur = 0,
  ease = "none",
): Keyframe[] {
  return [
    { alvo: `#${inst}`, prop: "x", t, v: Math.round(pos.x * 10) / 10, dur, ease },
    { alvo: `#${inst}`, prop: "y", t, v: Math.round(pos.y * 10) / 10, dur, ease },
    // escala e espelho num grupo à parte: em SVG o GSAP aplica a escala depois
    // da translação, então escala na raiz multiplicaria também a posição
    { alvo: `#${inst}-espelho`, prop: "scaleX", t, v: pos.espelho ? -pos.escala : pos.escala, dur, ease },
    { alvo: `#${inst}-espelho`, prop: "scaleY", t, v: pos.escala, dur, ease },
  ];
}
