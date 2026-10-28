// Tipos do rig de personagem.
//
// Convenções (engine/STYLE.md):
// - Origem do personagem = chão, entre os pés. y negativo = para cima.
// - Toda vista é desenhada olhando para a DIREITA; _esq é o espelho na raiz.
// - Membro em ângulo 0 = pendurado/esticado para baixo. Ângulo negativo = para a
//   frente (sentido anti-horário, na direção em que o personagem olha).
// - Lado _d = direito do personagem. Em perfil e 3/4 (olhando à direita) o lado
//   direito é o mais próximo da câmera; de frente ele fica à esquerda do quadro.

export const VISTAS_BASE = ["frente", "costas", "perfil", "3/4"] as const;
export type VistaBase = (typeof VISTAS_BASE)[number];

export const EXPRESSOES = ["neutro", "medo", "alivio", "desconfiado", "surpresa", "determinado"] as const;
export type Expressao = (typeof EXPRESSOES)[number];

export const JUNTAS = [
  "tronco", "cabeca",
  "braco_e", "antebraco_e", "mao_e",
  "braco_d", "antebraco_d", "mao_d",
  "coxa_e", "canela_e", "pe_e",
  "coxa_d", "canela_d", "pe_d",
] as const;
export type Junta = (typeof JUNTAS)[number];

export type Angulos = Partial<Record<Junta, number>>;

export type PoseDef = {
  expressao?: Expressao;
  angulos?: Angulos;
  /** deslocamento vertical do corpo (px na escala 1; positivo = desce) */
  corpo_y?: number;
  /** escala vertical por junta (encurtar coxa vista de frente ao sentar) */
  escalas?: Partial<Record<Junta, number>>;
  /** acessórios ligados/desligados nesta pose (ex.: isopor_mao: false) */
  acessorios?: Record<string, boolean>;
  /** cabeça espelhada: o corpo vai para um lado e o rosto olha para trás */
  cabeca_virada?: boolean;
  /** sobrescreve tudo acima numa vista específica */
  por_vista?: Partial<Record<VistaBase, Omit<PoseDef, "por_vista">>>;
};

/** Pose já resolvida para uma vista: ângulos de tela prontos para o GSAP. */
export type PoseResolvida = {
  expressao: Expressao;
  angulos: Record<Junta, number>;
  corpo_y: number;
  escalas: Record<Junta, number>;
  acessorios: Record<string, boolean>;
  cabeca_virada: boolean;
};

export type Proporcoes = {
  /** altura do quadril acima do chão (positivo) */
  quadril: number;
  /** meia distância entre as pernas, de frente */
  quadrilX: number;
  coxa: number;
  canela: number;
  /** altura dos ombros acima do quadril */
  ombro: number;
  /** meia largura dos ombros, de frente */
  ombroX: number;
  braco: number;
  antebraco: number;
  /** centro da cabeça acima do quadril */
  cabeca: number;
  cabecaR: number;
  larguraPerna: number;
  larguraBraco: number;
};

export type Lado = "e" | "d";

/** O que cada personagem desenha por cima do esqueleto genérico. */
export type Figurino = {
  id: string;
  nome: string;
  prop: Proporcoes;
  /** criaturas: sem olhos/sobrancelhas e sem contorno (bíblia, regra 1) */
  semRosto?: boolean;
  semContorno?: boolean;
  /** raio da mão (padrão 27) */
  maoR?: number;
  /** mão própria (dedos da criatura); origem no punho */
  mao?(v: VistaBase, lado: Lado): string;
  /** alarga/encolhe tronco e saia sem redesenhar (silhueta: Socorro larga, Valdir encorpado) */
  escalaTronco?: { x: number; y: number };
  cores: {
    pele: string;
    manga: string;
    /** cor do antebraço (manga curta = pele) */
    antebraco?: string;
    perna: string;
    /** cor da canela (vestido = pele) */
    canela?: string;
    pe: string;
    sobrancelha: string;
  };
  /** tronco (e pescoço), coordenadas a partir do quadril */
  tronco(v: VistaBase, px: string): string;
  /** saia/aba presa ao quadril, por cima das pernas e por baixo do tronco */
  saia?(v: VistaBase, px: string): string;
  /** cabeça: `base` vai por baixo do rosto, `topo` por cima (boné, óculos) */
  cabeca(v: VistaBase, acessorios: Record<string, boolean>): { base: string; topo: string };
  /** detalhes extra por segmento de membro (faixa refletiva na canela etc.) */
  detalheMembro?(v: VistaBase, junta: Junta): string;
  pe?(v: VistaBase, lado: Lado): string;
  /** acessórios presos a juntas (isopor na mão, pasta…) */
  acessorios?: Record<string, {
    junta: Junta | "corpo";
    padrao: boolean;
    desenhar(v: VistaBase): string;
    atras?: boolean;
    /** pendurado pela alça: fica sempre na vertical, apesar do braço */
    pendurado?: boolean;
  }>;
};
