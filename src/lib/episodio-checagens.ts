// Checagens automáticas do roteiro, feitas no código (não confiamos na autoconferência do modelo).
// checarEpisodio: estrutura (duração, resultado, votação, ações, destaques, última frase).
// checarRoteiro: tudo isso + catálogo, cronograma de pistas, nó do esqueleto e estilo.
import { silabas } from "../../engine/hud/legenda";
import type { NoEsqueleto } from "./biblia";
import type { Catalogo } from "./catalogo";
import type { Episodio, Plano } from "./episodio-schema";
import type { Estado } from "./estado";

/** `aviso`: aparece na revisão, mas não bloqueia nem vai para o retry do roteiro. */
export type Checagem = { id: string; ok: boolean; mensagem: string; aviso?: boolean };

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

// ── checagens com catálogo, bíblia e estado ──────────────────────────────────

export type ContextoRoteiro = ContextoChecagem & {
  catalogo: Catalogo;
  /** pista → primeiro EP permitido (bíblia §9) */
  cronograma: Record<string, number>;
  /** nó do esqueleto que o roteiro deveria escrever */
  no: NoEsqueleto;
  estadoAntes: Estado;
};

/** EP a partir do qual os de baixo podem aparecer nítidos (antes disso, só vulto). */
export const EP_REVELACAO_CRIATURAS = 5;
/** sílabas por segundo da narração (voz calma); estimativa até a voz real da Fase 2 */
export const SILABAS_POR_SEGUNDO = 5;
/** folga depois da última palavra (mesma da Fase 2) */
export const FOLGA_FALA_S = 0.35;

type PlanoCena = Extract<Plano, { tipo: "cena" }>;
const cenas = (ep: Episodio) => ep.planos.filter((p): p is PlanoCena => p.tipo === "cena");
const lista = (xs: string[]) => [...new Set(xs)].join(", ");

/** Segundos estimados para falar o texto (sílabas + pausas de pontuação). */
export function tempoDeFala(texto: string): number {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const sil = palavras.reduce((s, p) => s + silabas(p) + (/[.,;:!?…]$/.test(p) ? 1.2 : 0), 0);
  return Math.round((sil / SILABAS_POR_SEGUNDO) * 100) / 100;
}

/** Duração do plano depois da voz: max(planejada, fala + folga). */
export function duracaoComVoz(p: Plano): number {
  const texto = [p.narracao?.tts, p.fala?.tts].filter(Boolean).join(" ");
  return texto ? Math.max(p.duracao_s, Math.round((tempoDeFala(texto) + FOLGA_FALA_S) * 10) / 10) : p.duracao_s;
}

export function checarCatalogo(ep: Episodio, cat: Catalogo): Checagem[] {
  const out: Checagem[] = [];
  const novos = new Map(ep.assets_novos.map((a) => [a.id, a.tipo]));
  const personagens = new Map(cat.personagens.map((p) => [p.id, p]));
  const cenarios = new Map(cat.cenarios.map((c) => [c.id, c]));
  const faltam: string[] = [];
  const acoesSemPose: string[] = [];
  const focos: string[] = [];
  const sentados: string[] = [];

  for (const p of ep.planos) {
    if (p.fala && !personagens.has(p.fala.personagem)) faltam.push(`${p.id}: personagem da fala ${p.fala.personagem}`);
    if (p.tipo === "infografico" && !cat.infograficos.some((i) => i.id === p.infografico.id) && !novos.has(p.infografico.id))
      faltam.push(`${p.id}: infográfico ${p.infografico.id}`);
    if (p.tipo !== "cena") continue;
    const c = cenarios.get(p.cenario);
    if (!c && !novos.has(p.cenario)) faltam.push(`${p.id}: cenário ${p.cenario}`);
    for (const pc of p.personagens) {
      const def = personagens.get(pc.id);
      if (!def) {
        if (!novos.has(pc.id)) faltam.push(`${p.id}: personagem ${pc.id}`);
        continue;
      }
      if (!def.poses.includes(pc.pose) && !novos.has(pc.pose)) faltam.push(`${p.id}: pose ${pc.pose} de ${pc.id}`);
      if (pc.acao && !def.acoes.includes(pc.acao.tipo)) acoesSemPose.push(`${p.id}: ${pc.id} não faz ${pc.acao.tipo}`);
      if (pc.pose === "sentado" && !pc.vista.startsWith("3/4")) sentados.push(`${p.id}: ${pc.id} sentado em ${pc.vista}`);
    }
    for (const pr of p.props) if (!cat.props.some((x) => x.id === pr.id) && !novos.has(pr.id)) faltam.push(`${p.id}: prop ${pr.id}`);
    const foco = p.camera?.foco;
    if (foco && !c?.ancoras.includes(foco) && !p.personagens.some((pc) => pc.id === foco)) focos.push(`${p.id}: ${foco}`);
  }
  out.push({
    id: "catalogo",
    ok: faltam.length === 0,
    mensagem: faltam.length ? `fora do catálogo e de assets_novos: ${lista(faltam)}` : "todo cenário, personagem, pose e prop existe no catálogo",
  });
  out.push({
    id: "acoes_possiveis",
    ok: acoesSemPose.length === 0,
    mensagem: acoesSemPose.length ? `ação sem as poses necessárias: ${lista(acoesSemPose)}` : "toda ação é possível para quem a faz",
  });
  out.push({
    id: "sentado_3_4",
    ok: sentados.length === 0,
    mensagem: sentados.length ? `a pose sentado só existe em 3/4: ${lista(sentados)}` : "pose sentado só em 3/4",
  });
  out.push({
    id: "camera_foco",
    ok: focos.length === 0,
    mensagem: focos.length ? `foco de câmera que não é âncora do cenário nem personagem do plano: ${lista(focos)}` : "focos de câmera válidos",
  });
  const luzEfeitos: string[] = [];
  for (const p of ep.planos) {
    if (p.tipo !== "cena") continue;
    if (p.luz && !cat.luzes.includes(p.luz)) luzEfeitos.push(`${p.id}: luz ${p.luz}`);
    for (const e of p.efeitos) if (!cat.efeitos.includes(e)) luzEfeitos.push(`${p.id}: efeito ${e}`);
  }
  out.push({
    id: "luz_efeitos",
    ok: luzEfeitos.length === 0,
    mensagem: luzEfeitos.length
      ? `luz ou efeito fora do catálogo (luzes: ${cat.luzes.join(", ")}; efeitos: ${cat.efeitos.join(", ")}): ${lista(luzEfeitos)}`
      : "luz e efeitos do catálogo",
  });
  const sons = cat.sons.length ? ep.planos.flatMap((p) => p.som ?? []).filter((s) => !cat.sons.includes(s)) : [];
  out.push({
    id: "sons",
    ok: sons.length === 0,
    aviso: true,
    mensagem: sons.length ? `sons fora da biblioteca: ${lista(sons)}` : cat.sons.length ? "sons da biblioteca" : "biblioteca de sons vazia (Fase 2)",
  });
  return out;
}

const itensDe = (e: Record<string, unknown> | undefined) => (Array.isArray(e?.itens) ? (e.itens as string[]) : undefined);

/**
 * Luz, pose ou prop que exige item (catálogo `exige_item`) só vale com o item
 * no estado. Os itens partem do estado anterior e seguem o `estado_antes` /
 * `estado_depois` dos planos, se o roteiro mudar os itens no meio.
 */
export function checarItens(ep: Episodio, cat: Catalogo, antes: Estado): Checagem[] {
  const ex = cat.exige_item;
  let itens = antes.itens ?? [];
  const faltam: string[] = [];
  const falta = (plano: string, o_que: string, precisa: string[] | undefined) => {
    if (precisa && !precisa.some((i) => itens.includes(i))) faltam.push(`${plano}: ${o_que} exige ${precisa.join(" ou ")}`);
  };
  for (const p of ep.planos) {
    if (p.tipo !== "cena") continue;
    itens = itensDe(p.estado_antes) ?? itens;
    if (p.luz) falta(p.id, `luz ${p.luz}`, ex.luz[p.luz]);
    for (const pc of p.personagens) falta(p.id, `pose ${pc.pose} (${pc.id})`, ex.poses[pc.pose]);
    for (const pr of p.props) falta(p.id, `prop ${pr.id}`, ex.props[pr.id]);
    itens = itensDe(p.estado_depois) ?? itens;
  }
  return [
    {
      id: "itens_exigidos",
      ok: faltam.length === 0,
      mensagem: faltam.length
        ? `item ausente do estado (itens: ${(antes.itens ?? []).join(", ") || "nenhum"}): ${lista(faltam)}`
        : `luz, poses e props com os itens do estado (${(antes.itens ?? []).join(", ") || "nenhum"})`,
    },
  ];
}

export function checarCronograma(ep: Episodio, cronograma: Record<string, number>, antes: Estado): Checagem[] {
  const out: Checagem[] = [];
  const finais = Array.isArray(ep.estado_final.pistas) ? (ep.estado_final.pistas as string[]) : antes.pistas;
  const novas = finais.filter((p) => !antes.pistas.includes(p));
  const cedo = novas.filter((p) => (cronograma[p] ?? Infinity) > ep.numero);
  const desconhecidas = novas.filter((p) => !(p in cronograma));
  out.push({
    id: "pistas_cronograma",
    ok: cedo.length === 0,
    mensagem: cedo.length
      ? `pistas antes da hora: ${cedo.map((p) => `${p} (EP${cronograma[p] ?? "?"})`).join(", ")}`
      : novas.length ? `pistas novas dentro do cronograma: ${novas.join(", ")}` : "nenhuma pista nova",
  });
  if (desconhecidas.length) out.push({ id: "pistas_conhecidas", ok: false, aviso: true, mensagem: `pistas fora do cronograma da bíblia: ${desconhecidas.join(", ")}` });

  // regra 3 da bíblia: os de baixo só como vulto antes do EP5
  if (ep.numero < EP_REVELACAO_CRIATURAS) {
    const nitidas = cenas(ep).flatMap((p) => p.personagens.filter((pc) => pc.id.startsWith("criatura") && pc.id !== "criatura_vulto").map((pc) => `${p.id}: ${pc.id}`));
    out.push({
      id: "so_vulto",
      ok: nitidas.length === 0,
      mensagem: nitidas.length ? `criatura nítida antes do EP${EP_REVELACAO_CRIATURAS}: ${nitidas.join(", ")}` : `antes do EP${EP_REVELACAO_CRIATURAS}, os de baixo só como vulto`,
    });
  }
  if (ep.numero === 1) {
    const info = ep.planos.filter((p) => p.tipo === "infografico").map((p) => p.id);
    out.push({ id: "sem_infografico_ep1", ok: info.length === 0, mensagem: info.length ? `infográfico no EP1: ${info.join(", ")}` : "EP1 sem infográfico" });
  }
  return out;
}

export function checarNo(ep: Episodio, no: NoEsqueleto): Checagem[] {
  const out: Checagem[] = [
    { id: "no_certo", ok: ep.no === no.no && ep.numero === no.numero, mensagem: `nó ${ep.no} (EP${ep.numero}); esperado ${no.no} (EP${no.numero})` },
  ];
  if (no.temVotacao) {
    const ok = ep.votacao.no_se_a === no.noSeA && ep.votacao.no_se_b === no.noSeB;
    out.push({
      id: "votacao_destinos",
      ok,
      mensagem: ok ? `A → ${no.noSeA}, B → ${no.noSeB}` : `destinos da votação ${ep.votacao.no_se_a}/${ep.votacao.no_se_b}; o esqueleto diz ${no.noSeA}/${no.noSeB}`,
    });
  }
  return out;
}

/** Regras de texto da skill: avisos para a revisão (a voz real da Fase 2 confirma). */
export function checarEstilo(ep: Episodio, ctx: ContextoChecagem, antes?: Estado): Checagem[] {
  const out: Checagem[] = [];
  const textos = ep.planos.flatMap((p) => [p.narracao, p.fala].filter((x): x is NonNullable<typeof x> => !!x).map((x) => ({ id: p.id, ...x })));

  const comDigito = textos.filter((t) => /\d/.test(t.tts)).map((t) => t.id);
  out.push({ id: "tts_por_extenso", ok: !comDigito.length, aviso: true, mensagem: comDigito.length ? `números em dígitos no tts: ${lista(comDigito)}` : "números por extenso no tts" });

  const longas = textos.filter((t) => t.tts.split(/[.!?…]+/).some((f) => f.trim().split(/\s+/).filter(Boolean).length > 12)).map((t) => t.id);
  out.push({ id: "frases_curtas", ok: !longas.length, aviso: true, mensagem: longas.length ? `frases com mais de 12 palavras: ${lista(longas)}` : "frases de até 12 palavras" });

  const apertados = ep.planos.filter((p) => duracaoComVoz(p) > p.duracao_s).map((p) => `${p.id} ${p.duracao_s}→${duracaoComVoz(p)}s`);
  out.push({ id: "fala_cabe", ok: !apertados.length, aviso: true, mensagem: apertados.length ? `a voz deve esticar: ${apertados.join(", ")}` : "a fala estimada cabe em todo plano" });

  const total = Math.round(ep.planos.reduce((s, p) => s + duracaoComVoz(p), 0) * 10) / 10;
  out.push({
    id: "duracao_com_voz",
    ok: total >= ctx.duracaoMinS && total <= ctx.duracaoMaxS,
    aviso: true,
    mensagem: `duração estimada com voz ${total}s (${ctx.duracaoMinS}–${ctx.duracaoMaxS}s)`,
  });

  const longosCena = cenas(ep).filter((p) => p.duracao_s < 2 || p.duracao_s > 6).map((p) => `${p.id} ${p.duracao_s}s`);
  out.push({ id: "planos_2_6s", ok: !longosCena.length, aviso: true, mensagem: longosCena.length ? `planos de cena fora de 2–6 s: ${longosCena.join(", ")}` : "planos de cena entre 2 e 6 s" });

  if (!ctx.houveVotacaoAnterior) {
    const primeira = ep.planos.find((p) => p.narracao)?.narracao?.legenda ?? "";
    out.push({ id: "abre_hora_local", ok: /\b\d{1,2}:\d{2}\b/.test(primeira), aviso: true, mensagem: `primeira narração com a hora: "${primeira}"` });
  }
  if (antes && typeof ep.estado_final.bateria === "number") {
    out.push({
      id: "medidor_muda",
      ok: ep.estado_final.bateria !== antes.bateria || ep.hud.medidor.valor !== antes.bateria,
      aviso: true,
      mensagem: `bateria ${antes.bateria} → HUD ${ep.hud.medidor.valor} → final ${ep.estado_final.bateria}`,
    });
  }
  return out;
}

export function checarRoteiro(ep: Episodio, ctx: ContextoRoteiro): Checagem[] {
  return [
    ...checarNo(ep, ctx.no),
    ...checarEpisodio(ep, ctx),
    ...checarCatalogo(ep, ctx.catalogo),
    ...checarItens(ep, ctx.catalogo, ctx.estadoAntes),
    ...checarCronograma(ep, ctx.cronograma, ctx.estadoAntes),
    ...checarEstilo(ep, ctx, ctx.estadoAntes),
  ];
}

/** Falhas que bloqueiam (vão para o retry e impedem a aprovação automática). */
export const falhasBloqueantes = (cs: Checagem[]) => cs.filter((c) => !c.ok && !c.aviso);
