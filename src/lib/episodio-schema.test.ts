import { describe, expect, it } from "vitest";
import { validarEpisodio, type Episodio } from "./episodio-schema";
import { checarEpisodio, duracaoTotal, CONTEXTO_PADRAO } from "./episodio-checagens";

// Exemplo da skill (p01, p02 e p12), que é só formato: 16 s no total.
const exemploSkill = {
  serie: "estacao-fantasma",
  no: "ep02_vagao",
  numero: 2,
  titulo: "O Vidro",
  duracao_alvo_s: 75,
  resultado_anterior: { opcao: "B", pct_a: 38, pct_b: 62, frase: "Vocês decidiram: o mais votado foi B." },
  hud: { selo: "NOITE 1 · 18:21", medidor: { nome: "BATERIA", valor: 85 } },
  planos: [
    {
      id: "p01",
      tipo: "resultado",
      duracao_s: 5,
      narracao: { tts: "Vocês decidiram: o mais votado foi B.", legenda: "VOCÊS DECIDIRAM: O MAIS VOTADO FOI B." },
    },
    {
      id: "p02",
      tipo: "cena",
      duracao_s: 4,
      cenario: "vagao",
      luz: "emergencia_vermelha",
      camera: { mov: "push_in", de: 1.0, para: 1.12, foco: "janela_esq" },
      personagens: [
        { id: "caio", vista: "3/4_dir", pose: "segurando_porta", x: 0.35, acao: { tipo: "tremer", intensidade: 0.3 } },
        { id: "socorro", vista: "frente", pose: "abracando_isopor", x: 0.7 },
      ],
      props: [{ id: "vidro_trincado", x: 0.2, y: 0.35, entra_em_s: 2.5, efeito: "trincar" }],
      efeitos: ["piscar_luz"],
      cartao: null,
      narracao: { tts: "Às dezoito e vinte e um, o primeiro estalo bate no vidro.", legenda: "18:21. O PRIMEIRO ESTALO BATE NO VIDRO." },
      fala: null,
      som: ["estalo_seco", "vidro_trinca"],
      estado_antes: { local_atual: "vagao" },
      estado_depois: { exposicao: 3 },
    },
    {
      id: "p12",
      tipo: "votacao",
      duracao_s: 7,
      opcao_a: { rotulo: "ABRIR A PORTA", acao_narrada: "Caio abra a porta de emergência" },
      opcao_b: { rotulo: "FICAR NO ESCURO", acao_narrada: "eles fiquem em silêncio no escuro" },
      narracao: {
        tts: "Vote A para que Caio abra a porta de emergência. Ou vote B para que eles fiquem em silêncio no escuro.",
        legenda: "VOTE A OU B NOS COMENTÁRIOS",
      },
    },
  ],
  palavras_destaque: ["ESTALO", "VIDRO", "SILÊNCIO"],
  ultima_frase_falada: "fiquem em silêncio no escuro",
  votacao: { tem: true, pergunta: "Abrir ou ficar?", a: "ABRIR A PORTA", b: "FICAR NO ESCURO", no_se_a: "ep03", no_se_b: "ep03" },
  estado_final: { bateria: 85, exposicao: 3 },
  assets_novos: [],
};

/** Exemplo da skill com cenas extras até chegar a 75 s. */
function episodioValido(): Episodio {
  const ep = structuredClone(exemploSkill) as unknown as Episodio;
  const cena = ep.planos[1];
  const extras = Array.from({ length: 12 }, (_, i) => ({ ...structuredClone(cena), id: `p${String(i + 3).padStart(2, "0")}`, duracao_s: 4.9 }));
  ep.planos = [ep.planos[0], cena, ...extras, { ...ep.planos[2], id: "p15" }];
  return ep;
}

const ctxVotacao = { ...CONTEXTO_PADRAO, houveVotacaoAnterior: true, noTemVotacao: true };

describe("validarEpisodio", () => {
  it("aceita o formato do exemplo da skill", () => {
    const r = validarEpisodio(exemploSkill);
    expect(r.ok).toBe(true);
  });

  it("aplica defaults (assets_novos, efeitos, props)", () => {
    const { assets_novos, ...semAssets } = exemploSkill;
    void assets_novos;
    const r = validarEpisodio(semAssets);
    expect(r.ok && r.episodio.assets_novos).toEqual([]);
  });

  it("recusa ação, câmera e vista fora do vocabulário, com caminho do erro", () => {
    const ep = structuredClone(exemploSkill);
    (ep.planos[1] as any).personagens[0].acao.tipo = "voar";
    (ep.planos[1] as any).camera.mov = "drone";
    (ep.planos[1] as any).personagens[1].vista = "lado";
    const r = validarEpisodio(ep);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.some((e) => e.startsWith("planos.1.personagens.0.acao.tipo"))).toBe(true);
      expect(r.erros.some((e) => e.startsWith("planos.1.camera.mov"))).toBe(true);
      expect(r.erros.some((e) => e.startsWith("planos.1.personagens.1.vista"))).toBe(true);
    }
  });

  it("recusa tipo de plano desconhecido e rótulo de voto longo", () => {
    const ep = structuredClone(exemploSkill);
    (ep.planos[0] as any).tipo = "intro";
    (ep.planos[2] as any).opcao_a.rotulo = "ABRIR A PORTA DE EMERGÊNCIA AGORA";
    const r = validarEpisodio(ep);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.length).toBeGreaterThanOrEqual(2);
  });

  it("recusa x fora de 0..1 e nó mal formatado", () => {
    const ep = structuredClone(exemploSkill);
    (ep.planos[1] as any).personagens[0].x = 1.4;
    (ep as any).no = "episodio2";
    expect(validarEpisodio(ep).ok).toBe(false);
  });
});

describe("duracaoTotal", () => {
  it("soma sem erro de ponto flutuante", () => {
    expect(duracaoTotal({ planos: [{ duracao_s: 0.1 }, { duracao_s: 0.2 }] as any })).toBe(0.3);
    expect(duracaoTotal(episodioValido())).toBe(74.8);
  });
});

describe("checarEpisodio", () => {
  const falhas = (ep: Episodio, ctx = ctxVotacao) => checarEpisodio(ep, ctx).filter((c) => !c.ok).map((c) => c.id);

  it("passa tudo num episódio válido de 74.8 s", () => {
    expect(falhas(episodioValido())).toEqual([]);
  });

  it("o exemplo da skill (16 s) falha só na duração", () => {
    const r = validarEpisodio(exemploSkill);
    if (!r.ok) throw new Error("exemplo inválido");
    expect(falhas(r.episodio)).toEqual(["duracao"]);
  });

  it("acusa acima de 90 s e aceita exatamente 65 e 90", () => {
    const ep = episodioValido(); // 74.8 s
    const comTotal = (alvo: number) => {
      ep.planos[2].duracao_s = Math.round((4.9 + alvo - 74.8) * 1000) / 1000;
      return falhas(ep);
    };
    expect(comTotal(90)).toEqual([]);
    expect(comTotal(65)).toEqual([]);
    expect(comTotal(90.1)).toEqual(["duracao"]);
    expect(comTotal(64.9)).toEqual(["duracao"]);
  });

  it("exige a tela de resultado quando houve votação", () => {
    const ep = episodioValido();
    ep.planos = ep.planos.slice(1);
    ep.planos[1].duracao_s += 5;
    expect(falhas(ep)).toEqual(["abre_com_resultado"]);
  });

  it("proíbe resultado sem votação anterior", () => {
    expect(falhas(episodioValido(), { ...ctxVotacao, houveVotacaoAnterior: false })).toEqual(["sem_resultado_indevido"]);
  });

  it("exige votação no fim de nó com votação, com 6 a 8 s", () => {
    const ep = episodioValido();
    ep.planos[ep.planos.length - 1].duracao_s = 9;
    ep.planos[1].duracao_s -= 2;
    expect(falhas(ep)).toEqual(["votacao_duracao"]);
  });

  it("nó sem votação termina com CONTINUA e sem votação", () => {
    const ep = episodioValido();
    const last = ep.planos[ep.planos.length - 1];
    ep.planos[ep.planos.length - 1] = {
      id: last.id,
      tipo: "continua",
      duracao_s: 7,
      narracao: { tts: "E se o silêncio não for vazio?", legenda: "E SE O SILÊNCIO NÃO FOR VAZIO?" },
    };
    ep.votacao = { tem: false };
    ep.ultima_frase_falada = "o silêncio não for vazio";
    expect(falhas(ep, { ...ctxVotacao, noTemVotacao: false })).toEqual([]);
    expect(falhas(ep, ctxVotacao)).toEqual(["termina_com_votacao"]);
  });

  it("acusa cena sem ação visível", () => {
    const ep = episodioValido();
    const cena = ep.planos[3];
    if (cena.tipo !== "cena") throw new Error();
    cena.personagens = cena.personagens.map(({ acao, ...c }) => (void acao, c));
    cena.props = [];
    cena.camera = null;
    expect(falhas(ep)).toEqual(["cenas_com_acao"]);
  });

  it("acusa palavras de destaque fora de 3 a 5", () => {
    const ep = episodioValido();
    ep.palavras_destaque = ["A", "B"];
    expect(falhas(ep)).toEqual(["palavras_destaque"]);
  });

  it("acusa ultima_frase_falada que não fecha a última fala (ignora acento e pontuação)", () => {
    const ep = episodioValido();
    ep.ultima_frase_falada = "Fiquem em SILENCIO no escuro!";
    expect(falhas(ep)).toEqual([]);
    ep.ultima_frase_falada = "abra a porta de emergência";
    expect(falhas(ep)).toEqual(["ultima_frase"]);
  });
});
