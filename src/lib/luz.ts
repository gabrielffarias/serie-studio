// Luz é estado, não escolha do plano (bíblia, seção 7): cada local tem uma luz
// ambiente em estado.luz_ambiente, e ela só muda com um evento de luz em
// `efeitos`. A lanterna é uma camada por cima do ambiente (`lanterna: true`),
// nunca uma luz ambiente.

export const LUZES_AMBIENTE = ["normal", "emergencia_vermelha", "escuro"] as const;
export type LuzAmbiente = (typeof LUZES_AMBIENTE)[number];

/** Eventos que mudam a luz ambiente do local do plano (no meio do plano). */
export const TRANSICOES_LUZ = {
  apagao: { de: ["normal"], para: "emergencia_vermelha", descricao: "a luz principal cai; a de emergência vermelha acende" },
  luz_emergencia_falha: { de: ["emergencia_vermelha"], para: "escuro", descricao: "a luz de emergência falha; fica escuro" },
  luz_volta: { de: ["emergencia_vermelha", "escuro"], para: "normal", descricao: "a luz principal volta" },
} as const satisfies Record<string, { de: readonly LuzAmbiente[]; para: LuzAmbiente; descricao: string }>;

export type EventoLuz = keyof typeof TRANSICOES_LUZ;
export const EVENTOS_LUZ = Object.keys(TRANSICOES_LUZ) as EventoLuz[];

/** Efeitos que não mudam a luz ambiente (só piscam). */
export const EFEITOS_PASSAGEIROS = ["piscar_luz"] as const;
export const EFEITOS = [...EFEITOS_PASSAGEIROS, ...EVENTOS_LUZ] as const;

export const ehEventoLuz = (e: string): e is EventoLuz => e in TRANSICOES_LUZ;

export type PlanoComLuz = { id: string; tipo: string; cenario?: string; luz?: string | null; efeitos?: string[] };

export type LuzDoPlano = {
  id: string;
  local: string;
  /** luz ambiente no início do plano (vinda do estado) */
  inicio: LuzAmbiente;
  /** luz no fim do plano, depois dos eventos */
  fim: LuzAmbiente;
  /** evento de luz do plano, se houver */
  evento?: EventoLuz;
};

/**
 * Percorre os planos de cena a partir da luz ambiente do estado e devolve a
 * luz de cada plano, a luz final por local e os problemas de continuidade.
 */
export function percorrerLuz(
  planos: PlanoComLuz[],
  inicial: Record<string, string>,
): { planos: LuzDoPlano[]; final: Record<string, string>; problemas: string[] } {
  const atual: Record<string, string> = { ...inicial };
  const out: LuzDoPlano[] = [];
  const problemas: string[] = [];
  for (const p of planos) {
    if (p.tipo !== "cena" || !p.cenario) continue;
    const local = p.cenario;
    // local novo (cenário em assets_novos): entra no estado com a luz do primeiro plano
    if (!atual[local] && p.luz) atual[local] = p.luz;
    const vigente = atual[local] as LuzAmbiente | undefined;
    if (!vigente) {
      problemas.push(`${p.id}: o local ${local} não tem luz_ambiente no estado (local novo: declare a luz no primeiro plano)`);
      continue;
    }
    if (p.luz && p.luz !== vigente) problemas.push(`${p.id}: luz ${p.luz}, mas ${local} está em ${vigente} (só um evento de luz no plano pode mudar, e vale a partir dele)`);
    let fim: LuzAmbiente = vigente;
    let evento: EventoLuz | undefined;
    for (const e of p.efeitos ?? []) {
      if (!ehEventoLuz(e)) continue;
      const t = TRANSICOES_LUZ[e];
      if (evento) problemas.push(`${p.id}: dois eventos de luz no mesmo plano (${evento}, ${e})`);
      if (!(t.de as readonly string[]).includes(fim)) problemas.push(`${p.id}: ${e} com ${local} em ${fim} (precisa estar em ${t.de.join(" ou ")})`);
      fim = t.para;
      evento = e;
    }
    atual[local] = fim;
    out.push({ id: p.id, local, inicio: vigente, fim, evento });
  }
  return { planos: out, final: atual, problemas };
}
