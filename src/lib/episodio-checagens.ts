// Checagens automáticas do roteiro, feitas no código (não confiamos na autoconferência do modelo).
// Catálogo e cronograma de pistas entram na Fase 1.
import type { Episodio } from "./episodio-schema";

export type Checagem = { id: string; ok: boolean; mensagem: string };

export type ContextoChecagem = {
  duracaoMinS: number;
  duracaoMaxS: number;
  /** houve votação no episódio anterior → abre com a tela de resultado */
  houveVotacaoAnterior: boolean;
  /** o nó do esqueleto termina com votação */
  noTemVotacao: boolean;
};

export const CONTEXTO_PADRAO: ContextoChecagem = {
  duracaoMinS: 65,
  duracaoMaxS: 90,
  houveVotacaoAnterior: false,
  noTemVotacao: false,
};

export function duracaoTotal(ep: Pick<Episodio, "planos">): number {
  // arredonda para evitar 74.99999 em somas de decimais
  return Math.round(ep.planos.reduce((s, p) => s + p.duracao_s, 0) * 1000) / 1000;
}

const normalizar = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function ultimaFalaDoEpisodio(ep: Episodio): string | null {
  for (let i = ep.planos.length - 1; i >= 0; i--) {
    const p = ep.planos[i];
    const t = p.fala?.tts ?? p.narracao?.tts;
    if (t) return t;
  }
  return null;
}

export function checarEpisodio(ep: Episodio, ctx: ContextoChecagem = CONTEXTO_PADRAO): Checagem[] {
  const out: Checagem[] = [];
  const add = (id: string, ok: boolean, mensagem: string) => out.push({ id, ok, mensagem });

  const total = duracaoTotal(ep);
  add(
    "duracao",
    total >= ctx.duracaoMinS && total <= ctx.duracaoMaxS,
    `duração total ${total}s (precisa estar entre ${ctx.duracaoMinS} e ${ctx.duracaoMaxS}s)`,
  );

  const ids = ep.planos.map((p) => p.id);
  add("ids_unicos", new Set(ids).size === ids.length, "ids dos planos sem repetição");

  const primeiro = ep.planos[0];
  if (ctx.houveVotacaoAnterior) {
    add(
      "abre_com_resultado",
      primeiro.tipo === "resultado" && !!ep.resultado_anterior,
      "houve votação: o primeiro plano é a tela de resultado e resultado_anterior está preenchido",
    );
  } else {
    add(
      "sem_resultado_indevido",
      !ep.planos.some((p) => p.tipo === "resultado"),
      "sem votação anterior: nenhum plano de resultado",
    );
  }

  const ultimo = ep.planos[ep.planos.length - 1];
  const votacoes = ep.planos.filter((p) => p.tipo === "votacao");
  if (ctx.noTemVotacao) {
    add(
      "termina_com_votacao",
      ultimo.tipo === "votacao" && votacoes.length === 1 && ep.votacao.tem,
      "o nó tem votação: o último plano é a tela VOTE A / VOTE B",
    );
    if (ultimo.tipo === "votacao") {
      add(
        "votacao_duracao",
        ultimo.duracao_s >= 6 && ultimo.duracao_s <= 8,
        `tela de votação com ${ultimo.duracao_s}s (6 a 8s)`,
      );
    }
  } else {
    add(
      "termina_sem_votacao",
      votacoes.length === 0 && !ep.votacao.tem && ultimo.tipo === "continua",
      "nó sem votação: termina com o selo CONTINUA AMANHÃ e sem tela de votação",
    );
  }

  const cenasSemAcao = ep.planos
    .filter((p) => p.tipo === "cena")
    .filter((p) => !p.personagens.some((c) => c.acao) && !p.props.some((pr) => pr.efeito) && !p.camera)
    .map((p) => p.id);
  add(
    "cenas_com_acao",
    cenasSemAcao.length === 0,
    cenasSemAcao.length ? `planos de cena sem ação visível: ${cenasSemAcao.join(", ")}` : "todo plano de cena tem ação visível",
  );

  const n = ep.palavras_destaque.length;
  add("palavras_destaque", n >= 3 && n <= 5, `${n} palavras de destaque (3 a 5)`);

  const fim = ultimaFalaDoEpisodio(ep);
  const confere = !!fim && normalizar(fim).endsWith(normalizar(ep.ultima_frase_falada));
  add(
    "ultima_frase",
    confere,
    confere
      ? `termina em "${ep.ultima_frase_falada}"`
      : `ultima_frase_falada "${ep.ultima_frase_falada}" não é o fim da última fala`,
  );

  return out;
}
