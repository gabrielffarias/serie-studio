# ESTAÇÃO FANTASMA: bíblia da série

> Documento-fonte da série. O roteirista (Claude CLI, via skill `serie-interativa`) lê este arquivo **antes de qualquer episódio**.
> A seção **VERDADE SECRETA** é só para quem escreve: nada dela aparece na tela antes do episódio marcado no **Cronograma de revelação**.

---

## 1. Ficha técnica

| Campo | Valor |
|---|---|
| Título | **Estação Fantasma** |
| Formato | Animação 2D vetorial (SVG), vertical 1080×1920, 30 fps |
| Duração por episódio | **65 a 90 s** (mínimo de 65 s por causa da monetização do TikTok) |
| Temporada 1 | 12 episódios, 6 votações |
| Plataforma principal | TikTok (Reels e Shorts como espelho) |
| Narração | Voz masculina grave, calma, tensa, em pt-BR. Narrador em 3ª pessoa, no presente |
| Tom | Suspense e mistério com respiros de humor (Dona Socorro). Sem violência gráfica e sem sangue explícito |
| Gancho de público | "O público decide": toda votação muda o rumo e deixa marcas no estado da história |

## 2. Premissa (duas frases)

Às 18h, no pico do rush, um trem do metrô para no túnel debaixo da Asa Sul, a energia morre, os celulares perdem o sinal e alguma coisa passa rente à janela do vagão. Três estranhos se refugiam numa estação que nunca foi inaugurada e descobrem que Brasília foi construída em cima de algo que estava dormindo.

## 3. Ambientação e regras de mundo

- **Brasília real, estação inventada.** O metrô lembra o de Brasília (azulejos, plataforma, a Rodoviária lá em cima, o Eixo), mas **sem logo, marca ou nome oficial do Metrô-DF**. A estação fantasma é **fictícia**: a "Estação 1959", que aparece nos mapas antigos como "em obras".
- O apagão é **total**: celular sem sinal, rádio só com chiado, relógios digitais parados em 18:04. Só funcionam relógio de ponteiro e equipamento a pilha.
- **Isto é ficção.** Nada do que os personagens fazem deve ser apresentado como instrução real de sobrevivência.
- Toques locais (com moderação, sem caricatura): pão de queijo da Rodoviária, "Eixão", calor seco, cerrado, servidor público, candango, quadras e números ("a 108 Sul fica pra lá").

## 4. Personagens

> Especificação visual é **lei**: o motor de animação desenha a partir daqui. Mudanças só por motivo narrativo (ex.: ferimento), sempre registradas no estado.

### Caio (protagonista)
- 24 anos, técnico terceirizado de manutenção do metrô. Conhece os túneis, os quadros de energia e as passagens de serviço.
- **Quer:** voltar pra casa em Ceilândia, onde a irmã mais nova está sozinha.
- **Defeito:** age antes de pensar. Tem medo de ficar no escuro desde criança e esconde isso.
- **Visual:** cabeça redonda grande (o estilo da série), pele morena média, cabelo preto curto, **boné azul-marinho**, **macacão laranja de manutenção com faixa refletiva cinza na altura do peito e das canelas**, botina preta e cinto com chave de fenda. Começa com uma **lanterna de mão** de técnico de manutenção (item `lanterna_mao`; na pose `segurar_lanterna` o feixe sai da mão). A **lanterna de cabeça** (`lanterna_cabeca`, presa no boné) só aparece se ele ganhar o item (opção A do EP1).
- **Paleta:** laranja `#E8752A`, faixa `#C9CDD2`, boné `#1F2A44`, pele `#B98260`.

### Dona Socorro
- 63 anos, vende pão de queijo e café na Rodoviária há 30 anos. Tem fé, é teimosa e engraçada sem querer. Trata todo mundo de "meu filho".
- **Quer:** que ninguém fique com fome, e voltar pro neto.
- **Recurso:** o **isopor branco** (pão de queijo, garrafa térmica de café, guardanapos) vira o estoque inicial de comida.
- **Visual:** pele parda, cabelo grisalho em coque, **avental azul-claro com bolso frontal**, vestido estampado de florzinhas miúdas, sandália, **isopor branco com alça vermelha**.
- **Paleta:** avental `#7FB3D5`, vestido `#C0504D` com pontos `#F2E6CF`, cabelo `#BFBFBF`, pele `#A8754F`.

### Dr. Valdir
- 50 e poucos anos, servidor público de terno. Calmo demais para a situação. Carrega uma **pasta de couro com uma chave antiga** e diz que trabalha "num órgão de patrimônio".
- **Verdade:** é da fictícia **Comissão de Obras Especiais (COE)**, criada em 1959. Sabe o que existe embaixo da cidade. Não é vilão: está com medo e preso a um juramento.
- **Visual:** pele clara, careca com laterais grisalhas, **óculos de aro fino**, **terno cinza-chumbo**, **gravata vinho**, sapato social e **pasta de couro marrom**.
- **Paleta:** terno `#4A4E57`, gravata `#7A1F2B`, pasta `#7B4A2A`, pele `#E8C9A8`.

### Os de Baixo (criaturas)
- Pequenos (cerca de 1 m, metade da altura de um adulto), magros, **pálidos cinza-azulados**, **sem olhos**, com **orelhas/membranas grandes** nas laterais da cabeça. Andam curvados e se movem rápido, em espasmos (o movimento "robótico" ajuda).
- **Caçam pelo som.** **Luz forte e branca** os desorienta por alguns segundos (não mata).
- Nunca mostrar dentes ou violência explícita. O medo vem da silhueta, do som e da quantidade.
- **Paleta:** corpo `#AEB8C4`, sombra `#6E7A88`, sem contorno preto (contraste com os humanos).

## 5. Locais (biblioteca de cenários, por ordem de entrada)

| Chave | Local | Entra no |
|---|---|---|
| `vagao` | Interior do vagão: bancos azuis, barras amarelas, janelas pretas. Luz normal até o apagão do EP1; depois, emergência vermelha constante | EP1 |
| `tunel` | Túnel: trilho, cabos na parede, poças. Escuro; só a lanterna soma luz | EP1–2 |
| `plataforma_1959` | Plataforma da estação fantasma: azulejos creme e verde-água inacabados, andaimes, sacos de cimento, letreiro "1959" pintado à mão | EP2 |
| `sala_tecnica` | Sala técnica: quadro de energia, armário de ferramentas, rádio antigo, mapa amarelado da obra | EP3 |
| `tunel_antigo` | Galeria de pedra mais antiga que o concreto, com **símbolos geométricos** riscados (círculos concêntricos e linhas em cruz, lembrando o Plano Piloto visto de cima) | EP4 |
| `porta_1959` | Porta de aço redonda, selada, com placa "COMISSÃO DE OBRAS ESPECIAIS · ACESSO PROIBIDO · 1959" | EP2 (vista), EP8 (aberta) |
| `poco_ventilacao` | Poço de ventilação vertical com escada marinheiro e grade lá em cima, onde se vê o céu | EP5 |
| `camara` | A Câmara: caverna enorme abaixo de tudo. No centro, a **Semente** (ver Verdade Secreta) | EP8–9 |
| `superficie` | Eixo à noite, Rodoviária apagada, céu estrelado do cerrado, cidade inteira parada | EP10–12 |

## 6. Interface fixa da série (HUD)

- **Selo superior esquerdo:** `● NOITE 1 · 18:47` (o horário avança na história; a "noite" só muda se passar de 6h da manhã).
- **Medidor de BATERIA da lanterna** (substitui o cronômetro da referência): ícone de pilha + `82%`. Fica amarelo abaixo de 50% e vermelho abaixo de 20%. É a principal barra de tensão.
- **Cartões de título:** fundo preto 90% de opacidade, fonte condensada, palavra-chave em amarelo `#FFC21A` ou vermelho `#FF3B2B`.
- **Legenda falada:** palavra por palavra, contorno preto grosso, palavra atual em vermelho.
- **Abertura com resultado (todo episódio depois de uma votação), primeiros 4–6 s:**
  - Tela cheia escura com o placar em barras: **A 38%** × **B 62%**, com a barra vencedora crescendo e acendendo.
  - Carimbo grande: **"O MAIS VOTADO FOI B"**.
  - Narração: "Vocês decidiram: o mais votado foi B. Então ele vai [consequência em uma frase]." Em seguida, corte seco para a história.
  - Isso conta como gancho: os primeiros 2 s já mostram o placar.
- **Tela de votação (fim de todo episódio com votação), últimos 6–8 s:**
  - Imagem congelada do cliffhanger, escurecida, ao fundo.
  - Dois cartões **gigantes** empilhados, ocupando cerca de 60% da tela:
    - **VOTE A**, em amarelo `#FFC21A`, com a ação em uma linha curta ("ABRIR A PORTA").
    - **VOTE B**, em vermelho `#FF3B2B` ("FICAR ESCONDIDO").
  - Faixa embaixo: **"COMENTA A OU B 👇 · O MAIS VOTADO DECIDE O PRÓXIMO EPISÓDIO"**.
  - Narração lendo as duas opções: "Vote A para que ele… ou vote B para que ele…".
  - Os cartões entram com encaixe seco (escala 0 → 1,08 → 1) e pulsam levemente.

## 7. Estado da história (variáveis rastreadas)

| Variável | Tipo | Início | Significado |
|---|---|---|---|
| `bateria` | 0–100 | 100 | Bateria da lanterna de mão do Caio (`lanterna_mao`). Cai de 8 a 15 por episódio. Pilhas extras recarregam |
| `comida_dias` | número | 1 | Estoque (isopor + achados) |
| `agua_litros` | número | 1.5 | |
| `ferimentos` | lista | [] | Ex.: `{quem:"caio", onde:"tornozelo", gravidade:1}` |
| `confianca_valdir` | -2..+2 | 0 | Sobe ou desce conforme votações e atitudes |
| `exposicao` | 0–10 | 0 | Quanto barulho e rastro o grupo já deixou. Alta = criaturas mais perto |
| `pistas` | lista | [] | Chaves de pista já vistas (ver Cronograma) |
| `grupo` | lista | [caio, socorro, valdir] | Quem ainda está junto |
| `itens` | lista | [lanterna_mao] | Caio começa com a `lanterna_mao`. Outros: `lanterna_cabeca` (opção A do EP1), `chave_1959`, `radio`, `pilhas` |
| `local_atual` | chave | `vagao` | |
| `luz_ambiente` | mapa local → luz | {vagao: normal, tunel: escuro, plataforma_1959: escuro, porta_1959: escuro} | Luz de cada local: `normal`, `emergencia_vermelha` ou `escuro`. Só muda com evento de luz (ver abaixo) |
| `noite` / `hora` | | 1 / 18:04 | |

**Luz é estado, não escolha do plano.** Cada local tem a sua luz ambiente em `luz_ambiente`, e todo plano naquele local usa essa luz. Ela só muda com um evento de luz no plano, que atualiza o estado:
- `apagao`: a luz principal cai e a de emergência vermelha acende (`normal` → `emergencia_vermelha`). É o que acontece no vagão no EP1; depois disso, o vagão fica em emergência vermelha constante.
- `luz_emergencia_falha`: a emergência falha (`emergencia_vermelha` → `escuro`).
- `luz_volta`: a luz principal volta (→ `normal`).

Túnel e estação 1959 são escuros. A **lanterna** é uma camada que soma luz ao ambiente quando o Caio aponta para algo; nunca substitui a luz do local. A bateria só cai nos planos com a lanterna acesa. Locais novos entram em `luz_ambiente` quando o cenário for aprovado.

## 8. VERDADE SECRETA (só para quem escreve)

**Camada 1 (revelar no EP5): os de baixo.**
Debaixo do Planalto Central existe uma rede de galerias muito antigas habitada pelos de baixo. Eles dormem em ciclos longos. As obras de expansão do túnel (fictícias) romperam uma galeria, e o apagão os acordou. São atraídos por som e vibração. O rush das 18h foi o pior momento possível.

**Camada 2 (revelar no EP9): de onde vieram.**
Há milhares de anos, algo caiu do céu no cerrado: a **Semente**, um objeto escuro, liso e enorme, que pulsa em ondas. Os de baixo **não são alienígenas**. São o que a Semente fez com uma espécie que vivia ali: **guardiões** dela. O pulso da Semente é o que derruba a energia; ela "acordou" quando o túnel chegou perto.
Em 1957–1959, durante a construção de Brasília, operários encontraram a câmara. O governo criou a **Comissão de Obras Especiais** e selou a porta. A escolha do lugar da capital **não foi acaso** (aceno à profecia de Dom Bosco sobre a "terra prometida" entre os paralelos 15 e 20, tratada como lenda e mito da série, nunca como fato).
Valdir é o último membro ativo da COE. A chave na pasta abre a `porta_1959`.

**Regras que nunca quebram:**
1. Os de baixo nunca falam e nunca têm olhos.
2. A Semente nunca é mostrada inteira antes do EP9 (só reflexo, pulso ou silhueta).
3. A primeira vez que uma criatura aparece **inteira e nítida** é no EP5. Antes disso, só vulto, silhueta, som, rastro ou sombra.
4. Nenhum personagem principal morre antes do EP10.

## 9. Cronograma de revelação e pistas

| EP | Pista ou revelação permitida | Chave da pista |
|---|---|---|
| 1 | Vulto rápido passando na janela; som de "estalo seco" em sequência | `vulto_janela` |
| 2 | Pegadas pequenas na poeira do túnel, de pés com 3 dedos | `pegadas` |
| 2 | Porta 1959 vista de longe; Valdir reage a ela | `porta_vista` |
| 3 | Rádio antigo capta um pulso rítmico (não é voz) | `pulso_radio` |
| 4 | Símbolos na galeria antiga; o mapa da obra mostra uma área riscada "NÃO ESCAVAR" | `simbolos`, `mapa_riscado` |
| 5 | **Revelação 1**: os de baixo aparecem nítidos; regra do som | `criaturas` |
| 6 | Regra da luz; o pulso coincide com cada apagão | `regra_luz`, `pulso_apagao` |
| 7 | Valdir mostra a chave e admite que "sabia que tinha algo" | `chave_1959` |
| 8 | Atrás da porta: documentos da COE, fotos de operários de 1958, escada para a Câmara | `arquivos_coe` |
| 9 | **Revelação 2**: a Semente | `semente` |
| 10–12 | Consequências e final | — |

## 10. Esqueleto da temporada (ramificar e reconvergir)

> Votação = o episódio termina com a tela "VOTE A / VOTE B".
> Convergência = episódio que todos os galhos alcançam, com consequências diferentes no estado.

| EP | Nó | Resumo planejado | Votação | Efeitos no estado |
|---|---|---|---|---|
| 1 | `ep01` | 18:04. Trem para, apagão, pânico. Caio acalma o vagão. Socorro divide pão de queijo. Valdir olha o túnel como quem já sabia. Vulto na janela. Estalos se aproximando. | **A: sair pelo túnel com Caio** / **B: ficar trancados no vagão** | A → `exposicao+2`, ganha `lanterna_cabeca` da cabine. B → `exposicao+0`, mas algo bate no vagão e o vidro trinca |
| 2A | `ep02_tunel` | No túnel: pegadas. Caio torce o tornozelo fugindo de estalos. Chegam à plataforma 1959. | — (convergência no fim) | `ferimentos+caio.tornozelo`, `bateria-15`, pistas `pegadas`, `porta_vista` |
| 2B | `ep02_vagao` | O vagão é "cercado" por estalos; o vidro cede. Fuga às pressas pela porta de emergência até a 1959. Socorro perde metade do isopor. | — (convergência no fim) | `comida_dias-0.5`, `exposicao+2`, pistas `pegadas`, `porta_vista` |
| 3 | `ep03` | Base na 1959: inventário, barricada com sacos de cimento, rádio velho com pulso. | **A: arrombar a sala técnica** / **B: bloquear a passagem e esperar** | A → ganha `radio`, `pilhas` (bateria +30), `exposicao+2`, pista `pulso_radio`. B → `exposicao-1`, `bateria-10`, a comida rende menos |
| 4 | `ep04` | Explorando por ar ou água, acham a galeria antiga com símbolos e o mapa "NÃO ESCAVAR". Valdir fica pálido. Algo se mexe no escuro. | — | pistas `simbolos`, `mapa_riscado` |
| 5 | `ep05` | **REVELAÇÃO 1.** Dezenas de vultos. Uma criatura nítida a 2 m de Socorro. Silêncio absoluto: ela "ouve" e passa. | **A: fugir pelo poço de ventilação** / **B: ficar imóveis em silêncio** | A → descobrem que a grade está soldada, voltam com `exposicao+3` e `bateria-15`. B → criatura derruba a pasta de Valdir, a chave cai à vista de Caio, `confianca_valdir-1` |
| 6 | `ep06` | Aprendem a regra da luz e que o pulso derruba a energia. Racionamento. Tensão Caio × Valdir. | — | pistas `regra_luz`, `pulso_apagao` |
| 7 | `ep07` | Valdir mostra a chave e confessa parte da verdade. | **A: confiar em Valdir e abrir a porta 1959** / **B: tomar a chave e decidir sem ele** | A → `confianca_valdir+2`. B → `confianca_valdir-2`, Valdir some por um episódio |
| 8 | `ep08` | Atrás da porta: arquivos da COE, fotos de 1958, a escada que desce. (Se `confianca_valdir<0`, Valdir reaparece já lá dentro.) | — | pista `arquivos_coe`, itens `documentos_coe` |
| 9 | `ep09` | **REVELAÇÃO 2.** A Câmara e a Semente pulsando. Os de baixo cercam a Semente como guardiões. | **A: subir pra superfície e avisar todo mundo** / **B: descer e tentar desligar a Semente** | A → rota `superficie`. B → rota `camara_fundo` |
| 10 | `ep10` | Consequências. Rota A: sobem e encontram Brasília inteira parada no escuro. Rota B: descem até o pé da Semente. Alguém se fere ou fica para trás se `exposicao>=7`. | — | Primeira perda possível, decidida pelo estado |
| 11 | `ep11` | Clímax. O pulso cresce e os de baixo sobem. | **A: sacrifício (alguém fica pra segurar)** / **B: todos juntos, arriscando tudo** | Define o final junto com o estado |
| 12 | `ep12` | **Final** (ver regras abaixo) e gancho para a temporada 2 | — | — |

### Regras de final (EP12)
- **Final "Sobrevivem"**: `grupo` com 3, `confianca_valdir>=1`, `bateria>=20`, escolha B no EP11. Saem ao amanhecer. A energia volta. Valdir entrega os documentos da COE ao público (para a temporada 2).
- **Final "Agridoce"**: um personagem fica para trás (sacrifício no EP11 **ou** `exposicao>=7`). A Semente volta a dormir. Quem sobreviveu sobe sabendo que ninguém vai acreditar.
- **Final "Trágico"**: `bateria<20` **e** `exposicao>=8` **ou** `confianca_valdir<=-2` com escolha B no EP9. Os de baixo chegam à superfície. Última imagem: a Rodoviária, e dezenas de vultos subindo a escada rolante parada.
- **Gancho da T2 (qualquer final)**: o rádio capta o pulso de novo, agora vindo de **outra** cidade.

## 11. Bordões e assinaturas
- Socorro: "Meu filho, ninguém pensa direito com fome." (sempre oferecendo pão de queijo na pior hora)
- Caio conta mentalmente quando está com medo: "um… dois… três…" (vira recurso de legenda).
- Valdir sempre ajusta os óculos antes de mentir. (O público vai perceber, e isso é bom.)
- Primeira frase de todo episódio: hora + local ("18:47. Túnel sentido 108 Sul.").
