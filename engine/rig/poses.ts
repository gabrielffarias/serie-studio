// Poses em JSON de ângulos → ângulos de tela por vista.
//
// Os ângulos das poses são escritos "de perfil" (negativo = para a frente).
// De frente e de costas, o movimento para a frente vira abertura lateral
// reduzida, porque não dá para desenhar profundidade num vetor chapado; quando
// isso não lê bem, a pose traz `por_vista` com os ângulos de tela exatos.
import { JUNTAS, type Junta, type PoseDef, type PoseResolvida, type VistaBase } from "./tipos";

/** Fator de abertura lateral por junta, de frente/costas. */
const FATOR_FRONTAL: Partial<Record<Junta, number>> = {
  braco_e: 0.6, antebraco_e: 0.5, braco_d: 0.6, antebraco_d: 0.5,
  coxa_e: 0.15, canela_e: 0.1, coxa_d: 0.15, canela_d: 0.1,
  tronco: 0, cabeca: 0.3, mao_e: 0, mao_d: 0, pe_e: 0, pe_d: 0,
};

/** Lado que fica à esquerda do quadro em cada vista frontal. */
const LADO_ESQUERDO_DA_TELA: Record<"frente" | "costas", "d" | "e"> = { frente: "d", costas: "e" };

export function resolverPose(pose: PoseDef, v: VistaBase, acessoriosPadrao: Record<string, boolean> = {}): PoseResolvida {
  const angulos = Object.fromEntries(JUNTAS.map((j) => [j, 0])) as Record<Junta, number>;
  const escalas = Object.fromEntries(JUNTAS.map((j) => [j, 1])) as Record<Junta, number>;

  for (const j of JUNTAS) {
    const a = pose.angulos?.[j] ?? 0;
    if (v === "frente" || v === "costas") {
      const lado = j.endsWith("_d") ? "d" : j.endsWith("_e") ? "e" : null;
      const k = FATOR_FRONTAL[j] ?? 0;
      // membro à esquerda da tela abre girando no sentido horário (positivo)
      const sinal = lado === null ? 1 : lado === LADO_ESQUERDO_DA_TELA[v] ? -1 : 1;
      angulos[j] = a * k * sinal;
    } else {
      angulos[j] = a;
    }
  }
  for (const [j, s] of Object.entries(pose.escalas ?? {})) escalas[j as Junta] = s!;

  const especifica = pose.por_vista?.[v];
  if (especifica) {
    for (const [j, a] of Object.entries(especifica.angulos ?? {})) angulos[j as Junta] = a!;
    for (const [j, s] of Object.entries(especifica.escalas ?? {})) escalas[j as Junta] = s!;
  }

  // arredonda: -0 vira 0 e evita 12.000000001 no HTML
  for (const j of JUNTAS) angulos[j] = Math.round(angulos[j] * 100) / 100 + 0;

  return {
    expressao: especifica?.expressao ?? pose.expressao ?? "neutro",
    angulos,
    corpo_y: especifica?.corpo_y ?? pose.corpo_y ?? 0,
    escalas,
    acessorios: { ...acessoriosPadrao, ...pose.acessorios, ...especifica?.acessorios },
    cabeca_virada: (v === "perfil" || v === "3/4") && (especifica?.cabeca_virada ?? pose.cabeca_virada ?? false),
  };
}

/** Junta poses base com as do personagem (as do personagem ganham). */
export function poseDoPersonagem(nome: string, base: Record<string, PoseDef>, proprias: Record<string, PoseDef>): PoseDef {
  const p = proprias[nome] ?? base[nome];
  if (!p) throw new Error(`pose desconhecida: ${nome}`);
  return p;
}
