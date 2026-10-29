// Contrato do JSON de episódio (MODO 2 da skill serie-interativa).
// Todo roteiro vindo do Claude passa por aqui antes de entrar no banco.
import { z } from "zod";
import { EFEITOS, LUZES_AMBIENTE } from "./luz";

export const VISTAS = ["frente", "costas", "perfil_esq", "perfil_dir", "3/4_esq", "3/4_dir"] as const;

export const ACOES = [
  "entrar", "sair", "andar", "correr", "apontar", "empurrar", "agachar", "virar",
  "tremer", "respirar", "olhar", "cair", "levantar", "pegar", "soltar",
] as const;

export const MOVIMENTOS_CAMERA = [
  "fixo", "push_in", "pull_out", "pan_esq", "pan_dir", "tilt_cima", "tilt_baixo", "shake", "corte_seco",
] as const;

// Luz ambiente (estado do local) e efeitos/eventos de luz: src/lib/luz.ts.
// A lanterna é uma camada por cima do ambiente (`lanterna: true`), não uma luz.
export const LUZES = LUZES_AMBIENTE;
export const EFEITOS_LUZ = EFEITOS;
export const INFOGRAFICOS = ["corte_tunel", "ondas_som", "mapa_linha", "placar_votacao"] as const;

const fracao = z.number().min(0).max(1);
const pct = z.number().min(0).max(100);

export const narracaoSchema = z.object({
  tts: z.string().trim().min(1),
  legenda: z.string().trim().min(1),
});

// Fala de personagem (SKILL.md, MODO 2): personagem é o id do catálogo.
const falaSchema = z.object({
  personagem: z.string().regex(/^[a-z0-9_]+$/, "id do personagem no catálogo"),
  tts: z.string().trim().min(1),
  legenda: z.string().trim().min(1),
});

const acaoSchema = z
  .object({
    tipo: z.enum(ACOES),
    intensidade: fracao.optional(),
    // destino horizontal para entrar/sair/andar/correr
    para_x: fracao.optional(),
    em_s: z.number().min(0).optional(),
  })
  .loose();

const personagemEmCenaSchema = z.object({
  id: z.string().min(1),
  vista: z.enum(VISTAS),
  pose: z.string().min(1),
  x: fracao,
  y: fracao.optional(),
  escala: z.number().positive().max(3).optional(),
  acao: acaoSchema.optional(),
});

const propEmCenaSchema = z.object({
  id: z.string().min(1),
  x: fracao,
  y: fracao,
  entra_em_s: z.number().min(0).optional(),
  efeito: z.string().optional(),
});

const cameraSchema = z.object({
  mov: z.enum(MOVIMENTOS_CAMERA),
  de: z.number().positive().optional(),
  para: z.number().positive().optional(),
  foco: z.string().optional(),
  intensidade: fracao.optional(),
});

const cartaoSchema = z.object({
  texto: z.string().trim().min(1),
  // trechos do texto pintados de amarelo/vermelho
  destaque: z.array(z.string()).optional(),
  cor: z.enum(["amarelo", "vermelho"]).optional(),
});

const estadoParcial = z.record(z.string(), z.unknown());

const planoBase = {
  id: z.string().regex(/^p\d{2,}$/, "id do plano no formato p01, p02…"),
  duracao_s: z.number().min(1).max(15),
  narracao: narracaoSchema.nullish(),
  fala: falaSchema.nullish(),
  som: z.array(z.string()).optional(),
};

const opcaoVotoSchema = z.object({
  rotulo: z
    .string()
    .trim()
    .min(1)
    .refine((s) => s.split(/\s+/).length <= 4, "rótulo com no máximo 4 palavras"),
  acao_narrada: z.string().trim().min(1),
});

export const planoSchema = z.discriminatedUnion("tipo", [
  z.object({ ...planoBase, tipo: z.literal("resultado") }),
  z.object({
    ...planoBase,
    tipo: z.literal("cena"),
    cenario: z.string().min(1),
    // luz ambiente do local no início do plano: vem do estado (omitida = a do estado)
    luz: z.enum(LUZES, { error: `luz ambiente inválida: use ${LUZES.join(", ")} (lanterna é a camada \`lanterna: true\`)` }).nullish(),
    // camada de lanterna acesa por cima do ambiente (exige lanterna_mao ou lanterna_cabeca)
    lanterna: z.boolean().default(false),
    camera: cameraSchema.nullish(),
    personagens: z.array(personagemEmCenaSchema).default([]),
    props: z.array(propEmCenaSchema).default([]),
    efeitos: z
      .array(z.enum(EFEITOS_LUZ, { error: `efeito inválido: use ${EFEITOS_LUZ.join(", ")} (emergencia_vermelha é luz ambiente; lanterna é \`lanterna: true\`)` }))
      .default([]),
    cartao: cartaoSchema.nullish(),
    estado_antes: estadoParcial.optional(),
    estado_depois: estadoParcial.optional(),
  }),
  z.object({ ...planoBase, tipo: z.literal("cartao"), cartao: cartaoSchema }),
  z.object({
    ...planoBase,
    tipo: z.literal("infografico"),
    infografico: z.object({ id: z.enum(INFOGRAFICOS) }).loose(),
  }),
  z.object({ ...planoBase, tipo: z.literal("votacao"), opcao_a: opcaoVotoSchema, opcao_b: opcaoVotoSchema }),
  z.object({ ...planoBase, tipo: z.literal("continua") }),
]);

export const assetNovoSchema = z.object({
  id: z.string().regex(/^[a-z0-9_]+$/, "id em snake_case"),
  tipo: z.enum(["prop", "cenario", "pose", "personagem", "infografico", "som"]),
  descricao_visual: z.string().min(1),
  estilo: z.string().min(1),
  estados_animaveis: z.array(z.string()).default([]),
  usado_em: z.array(z.string()).default([]),
});

export const episodioSchema = z.object({
  serie: z.string().min(1),
  no: z.string().regex(/^ep\d{2}(_[a-z0-9]+)?$/, "nó no formato ep01, ep02_tunel…"),
  numero: z.number().int().min(1),
  titulo: z.string().trim().min(1),
  duracao_alvo_s: z.number().min(1),
  resultado_anterior: z
    .object({
      opcao: z.enum(["A", "B"]),
      pct_a: pct,
      pct_b: pct,
      frase: z.string().trim().min(1),
    })
    .nullish(),
  hud: z.object({
    selo: z.string().trim().min(1),
    medidor: z.object({ nome: z.string().min(1), valor: pct }),
  }),
  planos: z.array(planoSchema).min(1),
  infograficos_disponiveis: z.array(z.string()).optional(),
  palavras_destaque: z.array(z.string().trim().min(1)),
  ultima_frase_falada: z.string().trim().min(1),
  votacao: z.object({
    tem: z.boolean(),
    pergunta: z.string().optional(),
    a: z.string().optional(),
    b: z.string().optional(),
    no_se_a: z.string().optional(),
    no_se_b: z.string().optional(),
  }),
  estado_final: estadoParcial,
  assets_novos: z.array(assetNovoSchema).default([]),
  notas_para_revisao: z.string().optional(),
});

export type Episodio = z.infer<typeof episodioSchema>;
export type Plano = z.infer<typeof planoSchema>;
export type AssetNovo = z.infer<typeof assetNovoSchema>;

/** Valida e devolve o episódio, ou a lista de erros legível para mandar de volta ao Claude. */
export function validarEpisodio(json: unknown):
  | { ok: true; episodio: Episodio }
  | { ok: false; erros: string[] } {
  const r = episodioSchema.safeParse(json);
  if (r.success) return { ok: true, episodio: r.data };
  return {
    ok: false,
    erros: r.error.issues.map((i) => `${i.path.join(".") || "(raiz)"}: ${i.message}`),
  };
}
