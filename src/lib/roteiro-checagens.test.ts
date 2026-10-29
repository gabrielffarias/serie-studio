import { describe, expect, it } from "vitest";
import { gerarCatalogo } from "../../engine/catalogo";
import { cronogramaPistas, esqueleto, estadoInicialDaBiblia, tabelaDaSecao } from "./biblia";
import { checarRoteiro, duracaoComVoz, falhasBloqueantes, tempoDeFala, CONTEXTO_PADRAO, type ContextoRoteiro } from "./episodio-checagens";
import { validarEpisodio, type Episodio } from "./episodio-schema";
import { estadoInicial } from "./estado";
import { BIBLIA, ep1Json } from "./fixtures/roteiro";

const catalogo = gerarCatalogo();
const nos = esqueleto(BIBLIA);

describe("bíblia", () => {
  it("lê o cronograma de pistas (primeiro EP de cada chave, inclusive duas na mesma linha)", () => {
    const c = cronogramaPistas(BIBLIA);
    expect(c).toMatchObject({ vulto_janela: 1, pegadas: 2, porta_vista: 2, simbolos: 4, mapa_riscado: 4, criaturas: 5, semente: 9 });
  });

  it("lê o esqueleto: votação do EP1 leva aos dois nós do EP2; a do EP3 converge no EP4", () => {
    const ep01 = nos.find((n) => n.no === "ep01")!;
    expect(ep01).toMatchObject({ numero: 1, temVotacao: true, opcaoA: "sair pelo túnel com Caio", opcaoB: "ficar trancados no vagão", noSeA: "ep02_tunel", noSeB: "ep02_vagao" });
    expect(nos.find((n) => n.no === "ep03")).toMatchObject({ noSeA: "ep04", noSeB: "ep04" });
    expect(nos.find((n) => n.no === "ep02_tunel")?.temVotacao).toBe(false);
    expect(nos).toHaveLength(13);
  });

  it("lê o estado inicial, dividindo noite / hora", () => {
    expect(estadoInicialDaBiblia(BIBLIA)).toEqual({
      bateria: 100, comida_dias: 1, agua_litros: 1.5, ferimentos: [], confianca_valdir: 0, exposicao: 0,
      pistas: [], grupo: ["caio", "socorro", "valdir"], itens: ["lanterna_mao"], local_atual: "vagao", noite: 1, hora: "18:04",
      luz_ambiente: { vagao: "normal", tunel: "escuro", plataforma_1959: "escuro", porta_1959: "escuro" },
    });
  });

  it("tabela de seção inexistente é erro", () => {
    expect(() => tabelaDaSecao(BIBLIA, /não existe/)).toThrow(/seção não encontrada/);
  });
});

describe("catálogo", () => {
  it("tem os 3 humanos, os 4 tons da criatura e os 4 cenários", () => {
    expect(catalogo.personagens.map((p) => p.id)).toEqual(["caio", "socorro", "valdir", "criatura", "criatura_escura", "criatura_clara", "criatura_vulto"]);
    expect(catalogo.cenarios.map((c) => c.id)).toEqual(["vagao", "tunel", "plataforma_1959", "porta_1959"]);
  });

  it("a criatura não aponta nem cai (não tem essas poses); os humanos fazem tudo", () => {
    const vulto = catalogo.personagens.find((p) => p.id === "criatura_vulto")!;
    expect(vulto.acoes).toContain("andar");
    expect(vulto.acoes).not.toContain("apontar");
    expect(vulto.acoes).not.toContain("cair");
    expect(catalogo.personagens.find((p) => p.id === "socorro")!.acoes).toHaveLength(15);
  });

  it("movimento recomenda perfil e 3/4; gestos de mão não aparecem como acessórios", () => {
    expect(catalogo.acoes.find((a) => a.tipo === "andar")!.vistas_recomendadas).toEqual(["perfil_esq", "perfil_dir", "3/4_esq", "3/4_dir"]);
    expect(catalogo.personagens.find((p) => p.id === "valdir")!.acessorios).toEqual(["pasta", "pasta_peito"]);
  });

  it("diz o que exige item: luz lanterna (mão ou cabeça) e a pose segurar_lanterna (mão)", () => {
    expect(catalogo.exige_item).toEqual({ camadas: { lanterna: ["lanterna_mao", "lanterna_cabeca"] }, poses: { segurar_lanterna: ["lanterna_mao"] }, props: {} });
    expect(catalogo.efeitos).toEqual(["piscar_luz", "apagao", "luz_emergencia_falha", "luz_volta"]);
    expect(catalogo.personagens.find((p) => p.id === "caio")!.acessorios).toEqual(["lanterna_cabeca", "lanterna_mao"]);
  });
});

function ep1(): Episodio {
  const r = validarEpisodio(ep1Json());
  if (!r.ok) throw new Error(r.erros.join("\n"));
  return r.episodio;
}

const ctx: ContextoRoteiro = {
  ...CONTEXTO_PADRAO,
  noTemVotacao: true,
  catalogo,
  cronograma: cronogramaPistas(BIBLIA),
  no: nos[0],
  estadoAntes: estadoInicial("estacao-fantasma", BIBLIA),
};
const bloqueios = (ep: Episodio) => falhasBloqueantes(checarRoteiro(ep, ctx)).map((c) => c.id);
const avisos = (ep: Episodio) => checarRoteiro(ep, ctx).filter((c) => !c.ok && c.aviso).map((c) => c.id);

describe("checarRoteiro", () => {
  it("EP1 válido não bloqueia", () => {
    expect(bloqueios(ep1())).toEqual([]);
  });

  it("acusa cenário, pose e prop fora do catálogo, mas aceita o que está em assets_novos", () => {
    const ep = ep1();
    const p = ep.planos[1] as Extract<Episodio["planos"][number], { tipo: "cena" }>;
    p.cenario = "sala_tecnica";
    p.personagens[0].pose = "segurando_porta";
    p.props = [{ id: "vidro_trincado", x: 0.2, y: 0.3 }];
    expect(checarRoteiro(ep, ctx).find((c) => c.id === "catalogo")?.mensagem).toMatch(/sala_tecnica.*segurando_porta.*vidro_trincado/);
    ep.assets_novos = ["sala_tecnica", "segurando_porta", "vidro_trincado"].map((id) => ({ id, tipo: "prop", descricao_visual: "x", estilo: "x", estados_animaveis: [], usado_em: [] }));
    expect(bloqueios(ep)).toEqual([]);
  });

  it("antes do EP5 o vulto só passa por janela: no túnel, sem janela, bloqueia", () => {
    const ep = ep1();
    const p = ep.planos[13] as Extract<Episodio["planos"][number], { tipo: "cena" }>;
    expect(p.personagens[0].id).toBe("criatura_vulto");
    expect(bloqueios(ep)).toEqual([]);
    p.cenario = "tunel";
    p.camera = { mov: "corte_seco", foco: "chao" };
    expect(checarRoteiro(ep, ctx).find((c) => c.id === "vulto_passagem")?.mensagem).toMatch(/tunel não tem janela/);
  });

  it("acusa ação sem pose (vulto apontando), vulto parado, sentado fora de 3/4 e foco inexistente", () => {
    const ep = ep1();
    const p = ep.planos[13] as Extract<Episodio["planos"][number], { tipo: "cena" }>;
    p.personagens[0].acao = { tipo: "apontar" };
    p.personagens.push({ id: "socorro", vista: "frente", pose: "sentado", x: 0.5 });
    p.camera = { mov: "push_in", foco: "porta" };
    expect(bloqueios(ep)).toEqual(["acoes_possiveis", "sentado_3_4", "camera_foco", "vulto_passagem"]);
  });

  it("aceita um personagem do plano como foco", () => {
    const ep = ep1();
    (ep.planos[13] as { camera: unknown }).camera = { mov: "push_in", foco: "criatura_vulto" };
    expect(bloqueios(ep)).toEqual([]);
  });

  it("proíbe pista antes da hora e criatura nítida antes do EP5", () => {
    const ep = ep1();
    ep.estado_final.pistas = ["vulto_janela", "pegadas", "criaturas"];
    (ep.planos[13] as Extract<Episodio["planos"][number], { tipo: "cena" }>).personagens[0].id = "criatura";
    const cs = checarRoteiro(ep, ctx);
    expect(cs.find((c) => c.id === "pistas_cronograma")?.mensagem).toBe("pistas antes da hora: pegadas (EP2), criaturas (EP5)");
    expect(bloqueios(ep)).toEqual(["pistas_cronograma", "so_vulto"]);
  });

  it("no EP5 a criatura nítida pode aparecer", () => {
    const ep = ep1();
    ep.numero = 5;
    (ep.planos[13] as Extract<Episodio["planos"][number], { tipo: "cena" }>).personagens[0].id = "criatura";
    expect(checarRoteiro(ep, ctx).some((c) => c.id === "so_vulto")).toBe(false);
  });

  it("proíbe infográfico no EP1", () => {
    const ep = ep1();
    ep.planos.splice(5, 1, { id: "p06", tipo: "infografico", duracao_s: 5, infografico: { id: "corte_tunel" } } as Episodio["planos"][number]);
    expect(bloqueios(ep)).toEqual(["catalogo", "sem_infografico_ep1"]);
  });

  it("confere o nó e os destinos da votação com o esqueleto", () => {
    const ep = ep1();
    ep.votacao.no_se_b = "ep02_b";
    expect(bloqueios(ep)).toEqual(["votacao_destinos"]);
    ep.no = "ep02_tunel";
    expect(bloqueios(ep)).toContain("no_certo");
  });

  it("luz e pose que exigem item: lanterna_mao no estado libera; sem ela, bloqueia", () => {
    const ep = ep1();
    const p = ep.planos[4] as Extract<Episodio["planos"][number], { tipo: "cena" }>;
    p.lanterna = true;
    p.personagens[0].pose = "segurar_lanterna";
    p.personagens[0].acao = { tipo: "tremer" };
    expect(bloqueios(ep)).toEqual([]);
    const semItens = { ...ctx, estadoAntes: { ...ctx.estadoAntes, itens: [] } };
    const cs = checarRoteiro(ep, semItens);
    expect(cs.find((c) => c.id === "itens_exigidos")?.mensagem).toBe(
      "item ausente do estado (itens: nenhum): p05: lanterna exige lanterna_mao ou lanterna_cabeca, p05: pose segurar_lanterna (caio) exige lanterna_mao",
    );
    // só a lanterna de cabeça: a luz vale, a pose de segurar a de mão não
    const soCabeca = { ...ctx, estadoAntes: { ...ctx.estadoAntes, itens: ["lanterna_cabeca"] } };
    expect(falhasBloqueantes(checarRoteiro(ep, soCabeca)).find((c) => c.id === "itens_exigidos")?.mensagem).toMatch(/p05: pose segurar_lanterna \(caio\) exige lanterna_mao$/);
  });

  it("item ganho no meio do episódio (estado_depois de um plano anterior) vale dali em diante", () => {
    const ep = ep1();
    const p = ep.planos[4] as Extract<Episodio["planos"][number], { tipo: "cena" }>;
    p.lanterna = true;
    const semItens = { ...ctx, estadoAntes: { ...ctx.estadoAntes, itens: [] } };
    expect(falhasBloqueantes(checarRoteiro(ep, semItens)).map((c) => c.id)).toEqual(["itens_exigidos"]);
    (ep.planos[2] as { estado_depois?: Record<string, unknown> }).estado_depois = { itens: ["lanterna_cabeca"] };
    expect(falhasBloqueantes(checarRoteiro(ep, semItens))).toEqual([]);
  });

  it("luz e efeitos fora do catálogo bloqueiam", () => {
    const ep = ep1();
    const p = ep.planos[3] as Extract<Episodio["planos"][number], { tipo: "cena" }>;
    p.efeitos = ["piscar_luz"];
    const semPiscar = { ...ctx, catalogo: { ...catalogo, luzes: catalogo.luzes.filter((l) => l !== "emergencia_vermelha"), efeitos: ["apagao"] } };
    const c = checarRoteiro(ep, semPiscar).find((x) => x.id === "luz_efeitos")!;
    expect(c.ok).toBe(false);
    expect(c.mensagem).toMatch(/p02: luz emergencia_vermelha.*p04: efeito piscar_luz/);
  });

  it("emergencia_vermelha e lanterna em efeitos são recusadas pelo Zod, com a dica de usar luz ambiente ou a camada", () => {
    const j = ep1Json();
    (j.planos as Record<string, unknown>[])[2].efeitos = ["emergencia_vermelha", "lanterna"];
    const r = validarEpisodio(j);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros).toEqual([
      "planos.2.efeitos.0: efeito inválido: use piscar_luz, apagao, luz_emergencia_falha, luz_volta (emergencia_vermelha é luz ambiente; lanterna é `lanterna: true`)",
      "planos.2.efeitos.1: efeito inválido: use piscar_luz, apagao, luz_emergencia_falha, luz_volta (emergencia_vermelha é luz ambiente; lanterna é `lanterna: true`)",
    ]);
  });

  it("luz é estado: trocar a luz sem evento bloqueia; o evento muda a luz dali em diante e precisa ir para o estado final", () => {
    const ep = ep1();
    const cena = (i: number) => ep.planos[i] as Extract<Episodio["planos"][number], { tipo: "cena" }>;
    cena(6).luz = "escuro";
    const msg = () => checarRoteiro(ep, ctx).find((c) => c.id === "luz_continuidade")!;
    expect(msg().ok).toBe(false);
    expect(msg().mensagem).toContain("p07: luz escuro, mas vagao está em emergencia_vermelha");
    // com o evento no plano anterior, o escuro passa a valer
    cena(5).efeitos = ["luz_emergencia_falha"];
    for (let i = 7; i < 14; i++) cena(i).luz = "escuro";
    expect(msg().mensagem).toContain("estado_final.luz_ambiente.vagao = emergencia_vermelha; depois dos eventos é escuro");
    (ep.estado_final.luz_ambiente as Record<string, string>).vagao = "escuro";
    expect(msg()).toMatchObject({ ok: true, mensagem: "luz ambiente contínua (eventos: p01 apagao, p06 luz_emergencia_falha)" });
  });

  it("evento que não combina com a luz vigente bloqueia (luz_volta com a luz normal)", () => {
    const ep = ep1();
    (ep.planos[0] as { efeitos: string[] }).efeitos = ["luz_volta"];
    expect(checarRoteiro(ep, ctx).find((c) => c.id === "luz_continuidade")!.mensagem).toContain("p01: luz_volta com vagao em normal");
  });

  it("bateria que cai sem lanterna acesa é aviso", () => {
    const ep = ep1();
    ep.estado_final.bateria = 90;
    expect(avisos(ep)).toContain("bateria_lanterna");
    (ep.planos[3] as { lanterna: boolean }).lanterna = true;
    expect(avisos(ep)).not.toContain("bateria_lanterna");
  });

  it("avisos de estilo não bloqueiam", () => {
    const ep = ep1();
    ep.planos[0].narracao = { tts: "São 18:04 e o trem do metrô para de repente no meio do túnel escuro debaixo da cidade.", legenda: "O TREM PARA." };
    expect(bloqueios(ep)).toEqual([]);
    expect(avisos(ep)).toEqual(expect.arrayContaining(["tts_por_extenso", "frases_curtas", "fala_cabe", "abre_hora_local", "medidor_muda"]));
  });
});

describe("tempo de fala", () => {
  it("estima pelas sílabas com pausa na pontuação", () => {
    // 2 + 3 sílabas + pausa (1,2) = 6,2 sílabas a 5/s
    expect(tempoDeFala("Meu filho, ninguém")).toBeCloseTo((1 + 2 + 1.2 + 2) / 5, 2);
  });

  it("a voz só estica o plano, nunca encurta", () => {
    const base = { id: "p01", tipo: "cartao", cartao: { texto: "x" } } as const;
    expect(duracaoComVoz({ ...base, duracao_s: 6, narracao: { tts: "Oi.", legenda: "OI." } })).toBe(6);
    expect(duracaoComVoz({ ...base, duracao_s: 1, narracao: { tts: "Uma frase bem comprida que não cabe em um segundo.", legenda: "X" } })).toBeGreaterThan(2);
  });
});
