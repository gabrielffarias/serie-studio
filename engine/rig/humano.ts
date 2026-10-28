// Esqueleto genérico de humano: monta o SVG de um personagem numa vista, com
// cada junta num grupo próprio (pivô na origem do grupo) para o GSAP girar.
// O visual específico vem do Figurino de cada personagem.
import { desenharRostos, CONTORNO } from "./rosto";
import type { Figurino, Junta, Lado, VistaBase } from "./tipos";

type Ponto = { x: number; y: number };

type Layout = {
  pernas: Record<Lado, Ponto>;
  ombros: Record<Lado, Ponto>;
  pescoco: Ponto;
  /** ordem de desenho das pernas (primeiro = mais longe) */
  ordemPernas: Lado[];
  /** braços desenhados antes do tronco (atrás) e depois (na frente) */
  bracosAtras: Lado[];
  bracosFrente: Lado[];
};

/** Posições das juntas a partir do quadril, por vista (olhando à direita). */
export function layout(v: VistaBase, f: Figurino): Layout {
  const p = f.prop;
  const pescoco = { x: v === "3/4" ? 8 : v === "perfil" ? 6 : 0, y: -p.ombro - 8 };
  switch (v) {
    case "frente":
      return {
        pernas: { d: { x: -p.quadrilX, y: 0 }, e: { x: p.quadrilX, y: 0 } },
        ombros: { d: { x: -p.ombroX, y: -p.ombro }, e: { x: p.ombroX, y: -p.ombro } },
        pescoco, ordemPernas: ["d", "e"], bracosAtras: [], bracosFrente: ["d", "e"],
      };
    case "costas":
      return {
        pernas: { d: { x: p.quadrilX, y: 0 }, e: { x: -p.quadrilX, y: 0 } },
        ombros: { d: { x: p.ombroX, y: -p.ombro }, e: { x: -p.ombroX, y: -p.ombro } },
        pescoco, ordemPernas: ["d", "e"], bracosAtras: ["d", "e"], bracosFrente: [],
      };
    case "perfil":
      return {
        pernas: { d: { x: -4, y: 0 }, e: { x: 8, y: 0 } },
        ombros: { d: { x: -6, y: -p.ombro }, e: { x: 6, y: -p.ombro + 4 } },
        pescoco, ordemPernas: ["e", "d"], bracosAtras: ["e"], bracosFrente: ["d"],
      };
    case "3/4":
      return {
        pernas: { d: { x: -p.quadrilX * 0.75, y: 0 }, e: { x: p.quadrilX * 0.6, y: 0 } },
        ombros: { d: { x: -p.ombroX * 0.78, y: -p.ombro }, e: { x: p.ombroX * 0.55, y: -p.ombro + 4 } },
        pescoco, ordemPernas: ["e", "d"], bracosAtras: ["e"], bracosFrente: ["d"],
      };
  }
}

const traco = (comprimento: number, largura: number, cor: string) =>
  `<path d="M0 0 L0 ${comprimento}" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round"/>`;

/**
 * Grupo de junta: o externo posiciona o pivô, o `-pos` desloca a junta quando o
 * segmento pai encolhe, e o interno (com id) gira.
 */
const junta = (px: string, nome: Junta, em: Ponto, conteudo: string) =>
  `<g transform="translate(${em.x.toFixed(1)} ${em.y.toFixed(1)})"><g id="${px}-${nome}-pos"><g id="${px}-${nome}">${conteudo}</g></g></g>`;

/** Forma do segmento num grupo próprio: encolher (scaleY) não afeta as juntas filhas. */
const segmento = (px: string, nome: Junta, conteudo: string) => `<g id="${px}-${nome}-seg">${conteudo}</g>`;

/** Junta filha de cada segmento encolhível e o comprimento do segmento. */
export function filhos(f: Figurino): Partial<Record<Junta, { filho: Junta; L: number }>> {
  const p = f.prop;
  return {
    coxa_d: { filho: "canela_d", L: p.coxa }, coxa_e: { filho: "canela_e", L: p.coxa },
    canela_d: { filho: "pe_d", L: p.canela }, canela_e: { filho: "pe_e", L: p.canela },
    braco_d: { filho: "antebraco_d", L: p.braco }, braco_e: { filho: "antebraco_e", L: p.braco },
    antebraco_d: { filho: "mao_d", L: p.antebraco }, antebraco_e: { filho: "mao_e", L: p.antebraco },
  };
}

function acessoriosDa(px: string, f: Figurino, v: VistaBase, j: Junta, atras: boolean): string {
  return Object.entries(f.acessorios ?? {})
    .filter(([, a]) => a.junta === j && !!a.atras === atras)
    .map(([nome, a]) => `<g id="${px}-ac-${nome}" opacity="${a.padrao ? 1 : 0}">${a.desenhar(v)}</g>`)
    .join("");
}

export function peBasico(v: VistaBase, cor: string): string {
  if (v === "frente" || v === "costas") {
    return `<rect x="-34" y="-6" width="68" height="30" rx="13" fill="${cor}" stroke="${CONTORNO}" stroke-width="5"/>`;
  }
  const comp = v === "3/4" ? 64 : 78;
  return `<rect x="-24" y="-6" width="${comp}" height="30" rx="13" fill="${cor}" stroke="${CONTORNO}" stroke-width="5"/>`;
}

function braco(px: string, f: Figurino, v: VistaBase, lado: Lado, em: Ponto): string {
  const p = f.prop;
  const m = `mao_${lado}` as Junta;
  const mao =
    acessoriosDa(px, f, v, m, true) +
    `<circle cx="0" cy="${Math.round((f.maoR ?? 27) * 0.45)}" r="${f.maoR ?? 27}" fill="${f.cores.pele}"${f.semContorno ? "" : ` stroke="${CONTORNO}" stroke-width="5"`}/>` +
    acessoriosDa(px, f, v, m, false);
  const ante =
    segmento(px, `antebraco_${lado}` as Junta, traco(p.antebraco, p.larguraBraco * 0.92, f.cores.antebraco ?? f.cores.manga) +
    (f.detalheMembro?.(v, `antebraco_${lado}` as Junta) ?? "")) +
    junta(px, m, { x: 0, y: p.antebraco }, mao);
  const sup =
    segmento(px, `braco_${lado}` as Junta, traco(p.braco, p.larguraBraco, f.cores.manga) +
    (f.detalheMembro?.(v, `braco_${lado}` as Junta) ?? "")) +
    junta(px, `antebraco_${lado}` as Junta, { x: 0, y: p.braco }, ante);
  return junta(px, `braco_${lado}` as Junta, em, sup);
}

function perna(px: string, f: Figurino, v: VistaBase, lado: Lado, em: Ponto): string {
  const p = f.prop;
  const pe = f.pe?.(v, lado) ?? peBasico(v, f.cores.pe);
  const canela =
    segmento(px, `canela_${lado}` as Junta, traco(p.canela, p.larguraPerna * 0.95, f.cores.canela ?? f.cores.perna) +
    (f.detalheMembro?.(v, `canela_${lado}` as Junta) ?? "")) +
    junta(px, `pe_${lado}` as Junta, { x: 0, y: p.canela }, pe);
  const coxa =
    segmento(px, `coxa_${lado}` as Junta, traco(p.coxa, p.larguraPerna, f.cores.perna) +
    (f.detalheMembro?.(v, `coxa_${lado}` as Junta) ?? "")) +
    junta(px, `canela_${lado}` as Junta, { x: 0, y: p.coxa }, canela);
  return junta(px, `coxa_${lado}` as Junta, em, coxa);
}

/**
 * SVG de uma vista do personagem, com a origem no chão entre os pés.
 * `px` é o prefixo único dos ids (ex.: "p03-caio-frente").
 */
export function desenharHumano(f: Figurino, v: VistaBase, px: string): string {
  const p = f.prop;
  const L = layout(v, f);
  const cab = f.cabeca(v, {});
  const centroCabeca = { x: 0, y: -(p.cabeca - p.ombro - 8) };
  const cabeca =
    `<g transform="translate(${centroCabeca.x} ${centroCabeca.y})">` +
    cab.base +
    (f.semRosto ? "" : desenharRostos(px, v, p.cabecaR, f.cores.sobrancelha)) +
    cab.topo +
    `</g>` +
    acessoriosDa(px, f, v, "cabeca", false);
  const tronco =
    L.bracosAtras.map((l) => braco(px, f, v, l, L.ombros[l])).join("") +
    f.tronco(v, px) +
    acessoriosDa(px, f, v, "tronco", false) +
    junta(px, "cabeca", L.pescoco, cabeca) +
    L.bracosFrente.map((l) => braco(px, f, v, l, L.ombros[l])).join("");
  const quadril =
    L.ordemPernas.map((l) => perna(px, f, v, l, L.pernas[l])).join("") +
    (f.saia?.(v, px) ?? "") +
    `<g id="${px}-tronco">${tronco}</g>`;
  return (
    `<g id="${px}-corpo">` +
    acessoriosDa(px, f, v, "tronco", true) +
    `<g transform="translate(0 ${-p.quadril})">${quadril}</g>` +
    `</g>`
  );
}
