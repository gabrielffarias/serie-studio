// Gera assets/catalogo.json a partir dos registros do motor: personagens e
// poses, cenários e âncoras, ações, câmera, luzes e a biblioteca de áudio.
// É o que o roteirista (skill serie-interativa) lê para saber o que existe.
import { readdirSync } from "node:fs";
import path from "node:path";
import { POSES_DA_ACAO } from "./acoes/acoes";
import { CENARIOS } from "./cenario/cenarios";
import { LUZES } from "./luz/luz";
import { PERSONAGENS } from "./rig/personagens";
import { GESTOS_MAO } from "./rig/humano";
import { ACOES, EFEITOS_LUZ, MOVIMENTOS_CAMERA, VISTAS } from "../src/lib/episodio-schema";
import type { Catalogo, ItemAcao } from "../src/lib/catalogo";

const RAIZ = path.resolve(import.meta.dirname, "..");

const DESCRICAO_ACAO: Record<(typeof ACOES)[number], [string, string[]]> = {
  entrar: ["entra pelo lado de trás do olhar e para em `para_x` (ou no x do plano); intensidade > 0,7 entra correndo", ["para_x", "em_s", "intensidade"]],
  sair: ["sai do quadro na direção do olhar (ou até `para_x`); intensidade > 0,7 sai correndo", ["para_x", "em_s", "intensidade"]],
  andar: ["anda até `para_x` (sem destino: 30% do quadro na direção do olhar)", ["para_x", "em_s"]],
  correr: ["corre até `para_x` (sem destino: 30% do quadro na direção do olhar)", ["para_x", "em_s"]],
  apontar: ["aponta com a mão livre em `em_s`", ["em_s"]],
  empurrar: ["recua e empurra (com antecipação) em `em_s`", ["em_s"]],
  agachar: ["agacha em `em_s`", ["em_s"]],
  virar: ["corte seco para outra vista em `em_s` (`vista`: frente, costas, perfil_dir…)", ["vista", "em_s"]],
  tremer: ["tremor do corpo inteiro a partir de `em_s`; intensidade 0–1", ["intensidade", "em_s"]],
  respirar: ["respiração ofegante (o tronco sobe e encaixa a cada 2 s)", ["em_s"]],
  olhar: ["olha para trás em `em_s` (ou para a pose dada em `pose`)", ["em_s", "pose"]],
  cair: ["susto e queda em `em_s`", ["em_s"]],
  levantar: ["agacha e levanta em `em_s`", ["em_s"]],
  pegar: ["estende o braço, segura e volta à pose do plano", ["em_s", "pose"]],
  soltar: ["estende o braço, solta e volta à pose do plano", ["em_s", "pose"]],
};

const VISTAS_MOVIMENTO = ["perfil_esq", "perfil_dir", "3/4_esq", "3/4_dir"];

const DESCRICAO_CAMERA: Record<(typeof MOVIMENTOS_CAMERA)[number], string> = {
  fixo: "câmera parada",
  push_in: "aproxima devagar até `para` (padrão 1,25) no `foco`",
  pull_out: "afasta devagar de `de` (padrão 1,25) para 1",
  pan_esq: "desliza para a esquerda (zoom 1,18)",
  pan_dir: "desliza para a direita (zoom 1,18)",
  tilt_cima: "sobe (zoom 1,18)",
  tilt_baixo: "desce (zoom 1,18)",
  shake: "tremor curto (até 0,6 s) com zoom 1,05; `intensidade` 0–1",
  corte_seco: "corte seco para este plano, câmera parada",
};

/** Luz, pose ou prop que o motor só desenha com um destes itens no estado (basta um). */
export const EXIGE_ITEM: Catalogo["exige_item"] = {
  luz: { lanterna: ["lanterna_mao", "lanterna_cabeca"] },
  poses: { segurar_lanterna: ["lanterna_mao"] },
  props: {},
};

/** Notas de uso por cenário que o motor não deduz sozinho. */
const NOTAS_CENARIO: Record<string, string[]> = {
  vagao: [
    "vulto lá fora: `criatura_vulto` com y entre 0,40 e 0,55 e escala ~0,9 aparece só através das janelas",
    "sentado no banco: pose `sentado`, vista 3/4, y ~0,71, escala ~0,9",
  ],
  tunel: ["use luz `lanterna` (escuro em volta do feixe; quem está fora dele vira silhueta com contorno)"],
};

const NOTAS_PERSONAGEM: Record<string, string[]> = {
  caio: [
    "começa com `lanterna_mao` (item do estado): com luz `lanterna` e pose `segurar_lanterna`, o feixe sai da mão, na direção do braço",
    "`lanterna_cabeca` (no boné) só aparece quando o item está no estado; com ela, o feixe sai da cabeça em qualquer pose",
    "luz `lanterna` sem ninguém segurando a lanterna no plano: o feixe vem de baixo, do ponto de vista de quem a segura fora do quadro",
  ],
  socorro: ["o isopor fica sempre numa mão; os gestos usam a outra", "`abracando_isopor` e `assustado` seguram o isopor no peito"],
  valdir: ["a pasta fica sempre numa mão; os gestos usam a outra", "`ajustar_oculos` antes de mentir (bordão)"],
  criatura_vulto: ["silhueta escura; a única forma dos de baixo antes do EP5"],
};

function arquivosAudio(pasta: string): string[] {
  try {
    return readdirSync(path.join(RAIZ, "assets/audio", pasta))
      .filter((f) => /\.(mp3|wav|ogg)$/i.test(f))
      .map((f) => f.replace(/\.[^.]+$/, ""))
      .sort();
  } catch {
    return [];
  }
}

export function gerarCatalogo(): Catalogo {
  const personagens = Object.entries(PERSONAGENS).map(([id, p]) => {
    const poses = Object.keys(p.poses).sort();
    const criatura = !p.d.temRosto;
    // gestos de mão são internos das poses, não acessórios que o roteiro liga
    const acessorios = Object.keys(p.d.acessoriosPadrao()).filter((a) => !(a in GESTOS_MAO)).sort();
    const acoes = ACOES.filter((a) => POSES_DA_ACAO[a].every((n) => poses.includes(n)));
    return {
      id,
      nome: p.d.nome,
      tipo: (criatura ? "criatura" : "humano") as "humano" | "criatura",
      vistas: [...VISTAS],
      poses,
      acessorios,
      acoes,
      notas: NOTAS_PERSONAGEM[id] ?? [],
    };
  });

  const cenarios = Object.values(CENARIOS).map((c) => ({
    id: c.id,
    descricao: c.descricao,
    ancoras: Object.keys(c.ancoras),
    estados: c.estados ?? [],
    notas: NOTAS_CENARIO[c.id] ?? [],
  }));

  const acoes: ItemAcao[] = ACOES.map((tipo) => ({
    tipo,
    descricao: DESCRICAO_ACAO[tipo][0],
    campos: DESCRICAO_ACAO[tipo][1],
    vistas_recomendadas: ["entrar", "sair", "andar", "correr"].includes(tipo) ? VISTAS_MOVIMENTO : [...VISTAS],
  }));

  return {
    versao: 1,
    personagens,
    cenarios,
    props: [],
    infograficos: [],
    acoes,
    camera: MOVIMENTOS_CAMERA.map((mov) => ({ mov, descricao: DESCRICAO_CAMERA[mov] })),
    luzes: [...LUZES],
    efeitos: [...EFEITOS_LUZ],
    sons: arquivosAudio("sfx"),
    musicas: arquivosAudio("musica"),
    itens_visiveis: { lanterna_mao: "caio", lanterna_cabeca: "caio" },
    exige_item: EXIGE_ITEM,
    regras: [
      "x: 0–1 na largura do quadro; y omitido = pés no chão do cenário; escala 1 = adulto em primeiro plano (0,85–0,95 = um passo atrás)",
      "ações de movimento (entrar, sair, andar, correr) leem melhor em perfil ou 3/4; de frente ou de costas o passo não aparece",
      "a pose `sentado` só existe em 3/4",
      "`luz` é a iluminação do plano; `efeitos` é o que acontece com ela durante o plano (emergencia_vermelha e lanterna são luz, nunca efeito)",
      "luz, pose ou prop listados em `exige_item` só valem com o item em estado.itens",
      "uma ação só vale para quem tem as poses dela (veja `acoes` em cada personagem)",
      "camera.foco: uma âncora do cenário ou o id de um personagem do plano",
      "os de baixo: antes do EP5, só `criatura_vulto` (silhueta, sombra); `criatura`, `criatura_clara` e `criatura_escura` só do EP5 em diante",
      "props: nenhum aprovado ainda; o que o roteiro precisar vai em `assets_novos`",
      "infográficos: nenhum implementado ainda (e proibidos no EP1)",
      "sons: chaves livres em `som` (snake_case); a biblioteca de áudio entra na Fase 2",
    ],
  };
}
