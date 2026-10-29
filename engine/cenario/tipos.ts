// Cenário: SVG 1080×1920 em duas camadas (fundo atrás dos personagens, frente
// por cima) e âncoras com nome para a câmera (`foco`) e para posicionar coisas.

export type Ponto = { x: number; y: number };
export type Retangulo = { x: number; y: number; w: number; h: number; rx?: number };

export type Cenario = {
  id: string;
  descricao: string;
  /** y do chão onde ficam os pés (px do quadro) */
  chaoY: number;
  ancoras: Record<string, Ponto>;
  /** estados alternáveis por opacidade (ex.: porta fechada/aberta) */
  estados?: string[];
  fundo(px: string): string;
  /** recorte do "lado de fora" (janelas): vultos lá fora só aparecem através dele */
  recorteExterno?: string;
  /** janelas (vidro) por onde o vulto passa */
  janelas?: Retangulo[];
  /** assentos: quem está na pose `sentado` fica com o quadril dentro da faixa, com os pés em y */
  assentos?: { x0: number; x1: number; y: number }[];
  frente?(px: string): string;
};
