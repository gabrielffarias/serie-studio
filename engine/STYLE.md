# Guia de estilo do motor (Estação Fantasma)

Derivado de `referencias/cena-exemplo.html` / `.png`. Vale para todo SVG do motor e para todo **asset novo** que o Claude gerar (MODO 4). Se um asset novo não segue isto, é reprovado na conferência visual.

## 1. Quadro

- Canvas **1080 × 1920**, 30 fps. Coordenadas SVG em pixels do quadro (`viewBox="0 0 1080 1920"`).
- **Chão** dos cenários na faixa y ≈ 1420–1500 (personagem em pé tem os pés aí).
- Zonas reservadas (nunca pôr informação importante nelas):
  - **HUD**: x 60–420, y 110–300 (selo + bateria).
  - **Legenda**: y 1360–1560, centralizada.
  - **UI do TikTok**: faixa direita x > 940 entre y 900–1700 (botões) e rodapé y > 1700 (descrição). Personagem pode passar por elas; texto não.
- Área de ação 90% (x 54–1026, y 96–1824); texto dentro de 80% (x 108–972).

## 2. Traço e cor

- **Vetor chapado.** Cor sólida por forma. Gradiente só em **fundo de cenário** (parede, céu, túnel) e em **luz** (overlay de emergência, cone da lanterna). Nunca em personagem ou prop.
- **Contorno** `#2A2420`, 5–7 px, `stroke-linejoin="round"`, `stroke-linecap="round"`, em **cabeça, mãos, orelhas, pés e props**. Partes pequenas 5 px; formas grandes 6–7 px.
- **Roupa e membros são chapados, sem contorno** (como o moletom e as pernas da referência): braço e perna são traços grossos de ponta redonda; a separação vem da cor e de uma dobra mais escura.
- **Exceção:** os de baixo (criaturas) **não têm contorno**. O contraste com os humanos é proposital.
- **Sombra de contato**: elipse `#000` com opacidade .25 sob os pés. Sem outras sombras projetadas.
- Sombreado interno só por **uma** forma chapada mais escura (ex.: dobra do macacão), nunca por gradiente.
- **Proibido em personagens e props**: `filter` (blur, glow, drop-shadow), `mask` complexa, textura, padrão fotográfico. Custa caro no render sem GPU e foge do estilo. `filter` só no HUD (brilho do display) e com parcimônia.

### Paletas fixas (bíblia, seção 4)

| Personagem | Cores |
|---|---|
| Caio | macacão `#E8752A`, faixa refletiva `#C9CDD2`, boné `#1F2A44`, pele `#B98260`, cabelo `#1A1414`, botina `#1A1A1A` |
| Dona Socorro | avental `#7FB3D5`, vestido `#C0504D` com pontos `#F2E6CF`, cabelo `#BFBFBF`, pele `#A8754F`, isopor `#F4F4F0` com alça `#D23A2E` |
| Dr. Valdir | terno `#4A4E57`, gravata `#7A1F2B`, pasta `#7B4A2A`, pele `#E8C9A8`, laterais do cabelo `#9A9A9A`, camisa `#E9EDF2` |
| Os de baixo | corpo `#AEB8C4`, sombra `#6E7A88`; vulto `#0B0C10` opacidade .9 |

### Cores de interface

| Uso | Cor |
|---|---|
| Painel do HUD / cartões | `#0E0F12` a 90–92% |
| Destaque amarelo (VOTE A, palavras-chave) | `#FFC21A` |
| Destaque vermelho (VOTE B, palavra falada, alerta) | `#FF3B2B` |
| Texto secundário do HUD | `#A9ADB4` |
| Contorno da legenda | `#000`, 12 px, `paint-order: stroke` |

## 3. Proporção dos personagens

- **Unidade = cabeça.** Cabeça humana = círculo de **raio 118 px** (236 px de diâmetro) na escala 1.
- Humano adulto ≈ **3,1 cabeças** de altura (≈ 730 px): cabeça grande, tronco curto, pernas grossas e curtas.
- Criatura ≈ **metade** da altura de um adulto (≈ 370 px), curvada.
- Origem do personagem = **ponto entre os pés, no chão**. `x` do roteiro (0–1) posiciona essa origem na largura do quadro; `y` padrão é o chão do cenário.
- Profundidade: `escala` 0,6–1,2. Personagem ao fundo = menor e desenhado antes.

## 4. Rosto (decisão de 2026-10-28)

- **Mínimo.** Olhos = ovais pretos pequenos (rx 9, ry 13). Sem pupila, sem brilho.
- **A sobrancelha carrega a expressão** (traço grosso, 10 px, cor do cabelo ou `#2A2420`).
- **Boca só quando a emoção pede** (medo, surpresa, grito): forma chapada `#2A2420`. Neutro e desconfiado não têm boca.
- Expressões: `neutro`, `medo`, `alivio`, `desconfiado`, `surpresa`, `determinado`. A expressão vem **embutida na pose**.
- Vista de costas: sem rosto. Perfil: um olho e uma sobrancelha, do lado para onde olha.
- Os de baixo: **sem olhos, nunca**.

## 5. Vistas

`frente`, `costas`, `perfil`, `3/4`. Toda vista é desenhada olhando para a **direita** do quadro; `_esq` é o espelho (`scale(-1,1)` na raiz). Mudar de vista é corte seco (troca de desenho), nunca morph.

## 6. Movimento

- **Duro e econômico.** Interpolações curtas (0,08–0,2 s), segura a pose, encaixa. Nada de flutuar.
- Ciclo de andar: 4 poses-chave por passo, cada uma segurada; correr: 4 poses mais rápidas com o tronco inclinado.
- Pose → pose: 0,12 s com `power2.out`, depois segura. Antecipação só em ações grandes (cair, empurrar).
- Respiração/idle: tronco sobe 4 px a cada ~2 s, com encaixe, não seno contínuo.
- Câmera: `push_in`/`pull_out` lineares e lentos; `shake` com semente, curto (≤ 0,6 s); `corte_seco` sem transição.
- Tudo é função do tempo: nada de `Math.random()` sem semente (`engine/core/rng.ts`).

## 7. Tipografia

- **Anton** (legenda, cartões, telas de votação/resultado), maiúsculas.
- **Inter 800/900** (HUD).
- Legenda: 96 px, 2 a 3 palavras por vez, branca; palavra falada `#FF3B2B`; palavras de destaque `#FFC21A`.
- Cartão: faixa `#0E0F12` 90%, texto 56–104 px, palavra-chave amarela ou vermelha, entrada com encaixe seco (escala 0 → 1,08 → 1 em 0,18 s).

## 8. Asset novo (MODO 4): o que o SVG precisa ter

1. Módulo TS que exporta uma função pura que devolve SVG (string), sem dependências.
2. Coordenadas na unidade de cabeça (raio 118) relativas à origem do asset (chão, centro).
3. Ids prefixados pelo id do asset (`vidro_trincado-rachadura`), para não colidir na página.
4. Estados animáveis como grupos com id próprio (`<g id="vidro_trincado-trincado">`), alternados por opacidade.
5. Paleta da bíblia ou neutra; contorno conforme a seção 2.
