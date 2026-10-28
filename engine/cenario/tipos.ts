// Cenário: SVG 1080×1920 em duas camadas (fundo atrás dos personagens, frente
// por cima) e âncoras com nome para a câmera (`foco`) e para posicionar coisas.

export type Ponto = { x: number; y: number };

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
  frente?(px: string): string;
};
