// Fixtures compartilhadas pelos testes do roteiro.
import { readFileSync } from "node:fs";
import path from "node:path";

export const BIBLIA = readFileSync(path.resolve(import.meta.dirname, "../../../series/estacao-fantasma/biblia.md"), "utf8");

/** EP1 mínimo e válido (JSON cru, antes do Zod): 77 s, hora na abertura, vulto na janela, votação no fim. */
export function ep1Json(): Record<string, unknown> {
  const cena = (id: string, extra: Record<string, unknown> = {}) => ({
    id, tipo: "cena", duracao_s: 5, cenario: "vagao", luz: "emergencia_vermelha",
    personagens: [{ id: "caio", vista: "3/4_dir", pose: "em_pe", x: 0.3, acao: { tipo: "apontar", em_s: 1 } }],
    narracao: { tts: "O vagão inteiro prende a respiração.", legenda: "O VAGÃO INTEIRO PRENDE A RESPIRAÇÃO." },
    ...extra,
  });
  return {
    serie: "estacao-fantasma", no: "ep01", numero: 1, titulo: "18:04", duracao_alvo_s: 75,
    hud: { selo: "NOITE 1 · 18:04", medidor: { nome: "BATERIA", valor: 100 } },
    planos: [
      cena("p01", { narracao: { tts: "Dezoito e quatro. Túnel sentido cento e oito Sul.", legenda: "18:04. TÚNEL SENTIDO 108 SUL." } }),
      ...Array.from({ length: 12 }, (_, i) => cena(`p${String(i + 2).padStart(2, "0")}`)),
      cena("p14", {
        personagens: [{ id: "criatura_vulto", vista: "perfil_esq", pose: "andar", x: 0.9, y: 0.47, escala: 0.9, acao: { tipo: "andar", para_x: 0.7 } }],
        camera: { mov: "push_in", foco: "janela_dir" },
      }),
      {
        id: "p15", tipo: "votacao", duracao_s: 7,
        opcao_a: { rotulo: "SAIR PELO TÚNEL", acao_narrada: "eles saiam pelo túnel" },
        opcao_b: { rotulo: "FICAR NO VAGÃO", acao_narrada: "eles fiquem no vagão" },
        narracao: { tts: "Vote A para que saiam. Ou vote B para que fiquem.", legenda: "VOTE A OU B" },
      },
    ],
    palavras_destaque: ["VULTO", "TÚNEL", "VAGÃO"],
    ultima_frase_falada: "vote B para que fiquem",
    votacao: { tem: true, a: "SAIR PELO TÚNEL", b: "FICAR NO VAGÃO", no_se_a: "ep02_tunel", no_se_b: "ep02_vagao" },
    estado_final: { bateria: 100, exposicao: 1, pistas: ["vulto_janela"] },
  };
}
