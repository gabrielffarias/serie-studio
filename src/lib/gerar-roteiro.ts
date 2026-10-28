// Etapa 1 (roteiro): monta o pedido MODO 2 da skill serie-interativa, chama o
// Claude, valida com Zod + checagens no código e, se falhar, faz UMA segunda
// chamada com os erros. Função de trabalho pura: o CLI e o disco entram por
// `deps` (o worker da Fase 3 usa a mesma função).
import type { NoEsqueleto } from "./biblia";
import type { Catalogo } from "./catalogo";
import { extrairJson } from "./claude-cli";
import { checarRoteiro, falhasBloqueantes, CONTEXTO_PADRAO, FOLGA_FALA_S, SILABAS_POR_SEGUNDO, type Checagem, type ContextoRoteiro } from "./episodio-checagens";
import { validarEpisodio, type Episodio } from "./episodio-schema";
import type { Estado } from "./estado";

export type ResultadoVotacao = { opcao: "A" | "B"; pct_a: number; pct_b: number; total_votos: number };

export type PedidoRoteiro = {
  serie: string;
  no: NoEsqueleto;
  estado: Estado;
  catalogo: Catalogo;
  /** pista → primeiro EP permitido */
  cronograma: Record<string, number>;
  resultado?: ResultadoVotacao | null;
  /** roteiros publicados mais recentes (caminhos relativos à raiz), do mais antigo ao mais novo */
  anteriores?: string[];
  /** comentário de quem rejeitou a versão anterior */
  comentario?: string;
  duracaoMinS?: number;
  duracaoMaxS?: number;
};

export type DepsRoteiro = {
  chamar: (prompt: string) => Promise<string>;
  /** guarda a resposta crua da tentativa e devolve o caminho relativo à raiz (o Claude lê no retry) */
  salvarTentativa: (n: number, bruto: string) => string;
  onLog?: (linha: string) => void;
};

export type SaidaRoteiro =
  | { ok: true; episodio: Episodio; checagens: Checagem[]; tentativas: number }
  | { ok: false; erros: string[]; tentativas: number };

export function contextoDoPedido(p: PedidoRoteiro): ContextoRoteiro {
  return {
    ...CONTEXTO_PADRAO,
    duracaoMinS: p.duracaoMinS ?? CONTEXTO_PADRAO.duracaoMinS,
    duracaoMaxS: p.duracaoMaxS ?? CONTEXTO_PADRAO.duracaoMaxS,
    houveVotacaoAnterior: !!p.resultado,
    noTemVotacao: p.no.temVotacao,
    catalogo: p.catalogo,
    cronograma: p.cronograma,
    no: p.no,
    estadoAntes: p.estado,
  };
}

export function promptRoteiro(p: PedidoRoteiro): string {
  const { no, estado } = p;
  const dir = `series/${p.serie}`;
  const min = p.duracaoMinS ?? CONTEXTO_PADRAO.duracaoMinS;
  const max = p.duracaoMaxS ?? CONTEXTO_PADRAO.duracaoMaxS;
  const leituras = [`${dir}/biblia.md`, `${dir}/estado.json`, "assets/catalogo.json", ...(p.anteriores ?? [])];
  const pistas = Object.entries(p.cronograma).filter(([, ep]) => ep <= no.numero).map(([k]) => k);
  const linhas = [
    `Use a skill serie-interativa no MODO 2 (próximo episódio) para a série ${p.serie}.`,
    `Escreva o nó \`${no.no}\` (EP${no.numero}) do esqueleto: ${no.resumo}`,
    `Leia antes, inteiros: ${leituras.join(", ")}.`,
    `Estado atual: noite ${estado.noite}, ${estado.hora}, local ${estado.local_atual}, bateria ${estado.bateria}. O HUD usa o selo "NOITE ${estado.noite} · HH:MM" e o medidor BATERIA.`,
    `Itens no estado: ${estado.itens.join(", ") || "nenhum"}. Luz, pose ou prop em \`exige_item\` do catálogo só com o item no estado; \`luz\` e \`efeitos\` só com os valores do catálogo (emergencia_vermelha e lanterna são luz, nunca efeito).`,
    p.resultado
      ? `Houve votação: venceu ${p.resultado.opcao} (A ${p.resultado.pct_a}% × B ${p.resultado.pct_b}%, ${p.resultado.total_votos} votos). Preencha resultado_anterior e abra com o plano \`resultado\` (4–6 s).`
      : "Não houve votação antes deste episódio: resultado_anterior é null, nenhum plano `resultado`, e a primeira narração traz a hora e o local.",
    no.temVotacao
      ? `Este nó termina com votação. A: "${no.opcaoA}"; B: "${no.opcaoB}". Use votacao.tem = true, votacao.no_se_a = "${no.noSeA}", votacao.no_se_b = "${no.noSeB}", e o último plano é \`votacao\` com 6 a 8 s.`
      : "Este nó não tem votação: votacao.tem = false, e o último plano é `continua` (2–3 s).",
    no.efeitos ? `Efeitos previstos no esqueleto: ${no.efeitos}` : "",
    `Pistas permitidas até aqui: ${pistas.join(", ") || "nenhuma"}. Nada de pista de episódio posterior.`,
    "Use só o que está no catálogo: ids de personagens, as poses e as `acoes` de cada personagem, cenários, âncoras do cenário (ou o id de um personagem do plano) em camera.foco. Siga as `regras` e as `notas` do catálogo. O que faltar vai em assets_novos.",
    no.numero === 1 ? "Não use infográfico neste episódio." : "",
    `Duração total entre ${min} e ${max} s (alvo 75). Com voz, cada plano dura pelo menos o tempo da fala + ${FOLGA_FALA_S} s (cerca de ${SILABAS_POR_SEGUNDO} sílabas por segundo); dimensione as durações para a narração caber.`,
    p.comentario ? `A versão anterior foi rejeitada na revisão com este comentário; corrija isto: ${p.comentario}` : "",
    "Devolva SÓ o JSON do episódio, sem texto em volta e sem cerca de código.",
  ];
  return linhas.filter(Boolean).join("\n");
}

export function promptCorrecao(p: PedidoRoteiro, arquivo: string, erros: string[]): string {
  return [
    promptRoteiro(p),
    "",
    `Sua tentativa anterior está em ${arquivo} e não passou na validação do código:`,
    ...erros.map((e) => `- ${e}`),
    "Leia o arquivo, corrija o necessário e devolva o JSON completo corrigido, sem texto em volta.",
  ].join("\n");
}

type Avaliacao = { episodio?: Episodio; checagens: Checagem[]; erros: string[] };

function avaliar(bruto: string, ctx: ContextoRoteiro): Avaliacao {
  let json: unknown;
  try {
    json = extrairJson(bruto);
  } catch (e) {
    return { checagens: [], erros: [(e as Error).message] };
  }
  const v = validarEpisodio(json);
  if (!v.ok) return { checagens: [], erros: v.erros };
  const checagens = checarRoteiro(v.episodio, ctx);
  return { episodio: v.episodio, checagens, erros: falhasBloqueantes(checagens).map((c) => `${c.id}: ${c.mensagem}`) };
}

/**
 * Até 2 chamadas. A segunda só acontece se a primeira tiver erro de schema ou
 * checagem bloqueante. Depois da segunda, um roteiro com schema válido segue
 * para a revisão (com as checagens em ❌ visíveis); schema inválido é falha.
 */
export async function gerarRoteiro(p: PedidoRoteiro, deps: DepsRoteiro): Promise<SaidaRoteiro> {
  const ctx = contextoDoPedido(p);
  const log = deps.onLog ?? (() => {});
  log(`roteiro ${p.no.no}: 1ª chamada`);
  let bruto = await deps.chamar(promptRoteiro(p));
  let arquivo = deps.salvarTentativa(1, bruto);
  let a = avaliar(bruto, ctx);
  if (!a.erros.length && a.episodio) return { ok: true, episodio: a.episodio, checagens: a.checagens, tentativas: 1 };

  log(`roteiro ${p.no.no}: 1ª tentativa com ${a.erros.length} erro(s):\n${a.erros.map((e) => `  - ${e}`).join("\n")}`);
  log(`roteiro ${p.no.no}: 2ª chamada com os erros`);
  bruto = await deps.chamar(promptCorrecao(p, arquivo, a.erros));
  arquivo = deps.salvarTentativa(2, bruto);
  a = avaliar(bruto, ctx);
  if (a.episodio) {
    if (a.erros.length) log(`roteiro ${p.no.no}: 2ª tentativa ainda com ${a.erros.length} checagem(ns) em ❌; vai para revisão assim`);
    return { ok: true, episodio: a.episodio, checagens: a.checagens, tentativas: 2 };
  }
  log(`roteiro ${p.no.no}: 2ª tentativa inválida (${arquivo})`);
  return { ok: false, erros: a.erros, tentativas: 2 };
}
