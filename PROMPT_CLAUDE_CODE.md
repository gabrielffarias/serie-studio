# Prompt para o Claude Code: construir o `serie-studio`

> Cole tudo abaixo da linha no Claude Code, numa pasta nova (`serie-studio`) no servidor.
> Antes, copie para a pasta:
> - `series/estacao-fantasma/biblia.md`
> - `.claude/skills/serie-interativa/SKILL.md`
> - `referencias/cena-exemplo.html` e `referencias/cena-exemplo.png`
> - `referencias/cortes_tiktok-como-funciona.md` (o documento do seu app de cortes)

---

## Contexto

Vou construir o **serie-studio**: um sistema que produz e publica sozinho **séries animadas 2D interativas** para TikTok (com Reels e Shorts como espelho). O público vota **A ou B nos comentários**, e o mais votado decide o próximo episódio. A primeira série é **Estação Fantasma** (bíblia em `series/estacao-fantasma/biblia.md`).

Já tenho um sistema parecido em produção, o **cortes_tiktok** (`referencias/cortes_tiktok-como-funciona.md`). **Copie os padrões de arquitetura dele**: banco como fila com `FOR UPDATE SKIP LOCKED`, workers Node independentes, função de trabalho pura com `onLog`/`onProgress`, `createProgressReporter`, requeue ao iniciar, supervisor via cron com `flock`, Claude CLI (`claude -p … --allowedTools Read < /dev/null`) com extrator de JSON tolerante, publicação no Buffer por URL pública via Cloudflare Tunnel, regra de intervalo mínimo entre posts, interruptor `data/publicacao-ligada`, limpeza só depois de `POSTED`, e o ciclo de métricas que realimenta o prompt. A diferença é que aqui o vídeo **não existe**: o sistema **cria** roteiro, voz, imagem e animação.

**Leia antes de escrever qualquer código:**
1. `referencias/cortes_tiktok-como-funciona.md`
2. `series/estacao-fantasma/biblia.md`
3. `.claude/skills/serie-interativa/SKILL.md` (o contrato do JSON de episódio está lá)
4. `referencias/cena-exemplo.html` + `.png` (referência de estilo visual: SVG puro, chapado, legenda grossa, HUD)
5. A documentação atual do **HyperFrames**: rode `npx hyperframes skills update` e leia a skill `/hyperframes` e a referência de CLI. **Não chute a API do HyperFrames**; ela muda rápido. Confira no que foi instalado.

## Objetivo final (o que significa "pronto")

Eu clico em "Gerar próximo episódio" (ou o piloto automático faz isso) e o sistema:
1. escreve o roteiro em JSON seguindo bíblia + estado + resultado da votação;
2. desenha os assets novos que faltarem (com conferência visual);
3. gera a voz e os tempos de cada palavra;
4. monta a composição HyperFrames e renderiza um MP4 1080×1920 de **65 a 90 s**;
5. me mostra para aprovar (roteiro e vídeo);
6. publica no TikTok via Buffer;
7. abre a votação, recolhe os comentários depois de 24 h, apura A/B, registra no mapa da temporada e dispara o próximo episódio pelo galho vencedor.

## Princípios (não negocie)

- **Código fixo, IA gera dados.** O Claude escreve JSON e Markdown. Quem desenha e anima é o motor, a partir de componentes e assets versionados. A única exceção é o **asset novo**: aí o Claude gera SVG, que passa por conferência visual e aprovação antes de entrar no catálogo.
- **Consistência visual é lei.** Personagens vêm de um rig SVG reaproveitado, nunca redesenhados por episódio.
- **Determinismo.** Mesma entrada, mesmo vídeo. Nada de `Math.random()` sem semente; animação é timeline GSAP pausada (contrato do HyperFrames).
- **Nada de trabalho pesado em requisição HTTP.** Rota muda status, worker processa, UI faz polling.
- **Tudo que pode falhar tem retry com limite e log visível na UI.**
- **Valide todo JSON vindo do Claude com Zod.** Se for inválido, faça uma segunda chamada mandando o erro de validação. Se falhar de novo, status `*_FAILED` com o log.

## Stack

| Camada | Tecnologia |
|---|---|
| UI + API | Next.js (App Router), React, Tailwind. Mesmo padrão do cortes |
| Banco | PostgreSQL + Prisma |
| Workers | TypeScript com `tsx`, um processo por etapa |
| Roteiro e copy | Claude Code CLI local, rodando **na raiz do repo** para carregar a skill `serie-interativa` |
| Voz | Interface `TtsProvider`. Padrão: **edge-tts** (`pt-BR-AntonioNeural` para o narrador; vozes por personagem configuráveis). Depois: VoiceStudio via API HTTP local e Kokoro via HyperFrames |
| Verificação de voz e timestamps | Whisper (`whisper` CLI ou `faster-whisper`), `--language pt`, tempo por palavra |
| Composição e render | **HyperFrames** (HTML + SVG + GSAP → MP4), telemetria desligada (`HYPERFRAMES_NO_TELEMETRY=1`) |
| Prévia na UI | `<hyperframes-player>` |
| Mapa da temporada | React Flow |
| Publicação e comentários | API GraphQL do Buffer (mesma do cortes) + Cloudflare Tunnel |
| Áudio de apoio | Pasta local `assets/audio/{sfx,musica}` com arquivos livres (CC0), referenciados por chave |

## Estrutura de pastas

```
serie-studio/
  .claude/skills/serie-interativa/SKILL.md
  series/<slug>/biblia.md
  series/<slug>/estado.json              # espelho do estado atual (fonte da verdade = banco)
  series/<slug>/episodios/<no>.json      # roteiros aprovados (espelho)
  assets/
    catalogo.json                        # gerado do banco: o que existe e está aprovado
    personagens/<id>/{rig.svg.ts, vistas/*.ts, poses.json, preview/*.png}
    cenarios/<id>/{cenario.svg.ts, preview.png}
    props/<id>/...
    infograficos/<id>/...
    audio/{sfx,musica}/*.mp3
  engine/
    hud/                                 # selo, medidor, cartões, legenda, tela de resultado, tela de votação
    rig/                                 # esqueleto, pivôs, poses → transform, ciclos (andar, correr)
    acoes/                               # ação JSON → tween GSAP
    camera/                              # push_in, pan, shake…
    compose/                             # episodio.json + áudio + palavras → projeto HyperFrames
  src/app/…                              # UI e API
  src/lib/…                              # funções puras de cada etapa
  scripts/*-worker.ts, servidor.sh, instalar-dependencias.sh
  data/{voz,renders,stills,previews,comentarios}/
```

## Modelo de dados (Prisma), ponto de partida

- **Series**: `slug`, `titulo`, `bibliaPath`, `vozNarrador`, `config` (JSON: duração mínima e máxima, janela de votação, mínimo de votos).
- **Character**, **Location**, **Prop**, **Infographic**: espelho do catálogo; `assetId`, `status` (`DRAFT|PREVIEW|APPROVED|REJECTED`), `spec` (JSON do MODO 4 da skill), `previewPath`, `versao`.
- **StoryNode**: o esqueleto planejado. `serieId`, `no` (ex.: `ep02_b`), `numero`, `resumo`, `temVotacao`, `opcaoA`, `opcaoB`, `noSeA`, `noSeB`, `efeitosA`, `efeitosB` (JSON), `convergencia` (bool), `status` (`PLANNED|ACTIVE|PRODUCED|SKIPPED`). Popular **a partir da tabela "Esqueleto da temporada" da bíblia** (parser de Markdown, ou peça ao Claude para extrair em JSON e valide).
- **Episode**: o episódio realizado. `storyNodeId`, `roteiro` (JSON validado), `estadoAntes`, `estadoDepois`, `status`, `progress`, `logs`, `retryCount`, `renderPath`, `duracaoReal`, `copyTitulo`, `copyLegenda`, `bufferPostId`, `postadoEm`.
- **Shot**: um por plano, com `audioPath`, `palavras` (JSON de timestamps) e `duracaoFinal`.
- **Vote**: `episodeId`, `abreEm`, `fechaEm`, `status` (`OPEN|CLOSED|APPLIED`), `votosA`, `votosB`, `nulos`, `total`, `vencedora`, `criterio` (`maioria|empate_padrao|poucos_votos_padrao|manual`).
- **Comment**: `voteId`, `autorId`, `texto`, `criadoEm`, `voto` (`A|B|NULO|AMBIGUO`), `origem` (`regex|claude|manual`). Único por (`voteId`, `autorId`), vale o último.
- **StoryState**: snapshot por episódio (histórico completo para o mapa e para depuração).
- **EpisodeMetrics**: views, curtidas, comentários, compartilhamentos, tempo médio assistido (tabela separada, como no cortes).
- **SystemSettings**: singleton com `pilotoAutomatico` e `serieAtiva`.

## Máquina de estados do episódio

```
PLANNED → PENDING_SCRIPT → SCRIPTING → SCRIPT_REVIEW
  ──aprovar──► PENDING_ASSETS → ASSETS → (asset novo? → ASSET_REVIEW) → PENDING_VOICE
  → VOICING → PENDING_RENDER → RENDERING → RENDER_REVIEW
  ──aprovar──► READY → POSTED → VOTING → VOTE_CLOSED → DONE
falhas: SCRIPT_FAILED | ASSETS_FAILED | VOICE_FAILED | RENDER_FAILED (retry até 3)
rejeitar roteiro → volta a PENDING_SCRIPT com o meu comentário anexado ao prompt
```
Com o **piloto automático** ligado, `SCRIPT_REVIEW` e `RENDER_REVIEW` são aprovados sozinhos **se** todas as checagens automáticas passarem; senão, param e me notificam.

## Etapas (workers)

### 1. Roteiro (`script-worker`)
- Monta o contexto: bíblia, `estado.json`, catálogo, os 2 últimos roteiros, o nó a escrever, o resultado da votação e, a partir de 6 episódios publicados, os **melhores e piores** por retenção/curtidas (few-shot, como no cortes).
- Chama `claude -p "<instrução MODO 2 da skill serie-interativa para o nó X>" --allowedTools Read`, **com cwd na raiz do repo**.
- Valida com Zod (schema espelhando o JSON da skill). Checa no código: soma das durações entre 65 e 90 s, todo `cenario/pose/prop` existe no catálogo ou está em `assets_novos`, plano `resultado` presente se houve votação anterior, plano `votacao` presente se o nó tem votação, e nenhuma pista usada antes do episódio permitido (cronograma extraído da bíblia).
- Segunda chamada para **copy** (título, legenda com a pergunta A/B, 3 a 5 hashtags), variando em relação às últimas copies postadas (lição anti-spam do cortes).

### 2. Assets (`asset-worker`)
- Para cada item em `assets_novos`: o Claude gera um módulo SVG seguindo o guia de estilo do motor (`engine/STYLE.md`, que você vai escrever na Fase 1 a partir da `cena-exemplo`).
- Renderiza uma prévia PNG (HyperFrames still ou Playwright), e o Claude **lê a imagem** e aprova ou corrige (até 3 rodadas). Depois, `ASSET_REVIEW` para mim na UI.
- Só `APPROVED` entra no `catalogo.json`.

### 3. Voz (`voice-worker`)
- Para cada plano: TTS do campo `narracao.tts` (e `fala`, com a voz do personagem se houver).
- Whisper em cada arquivo: compara com o texto (normalizado) e regenera até 3 vezes se divergir. Guarda o **tempo de cada palavra**.
- Ajusta: `duracaoFinal = max(duracao_s planejada, fim_da_fala + 0,35 s)`. Recalcula o total; se sair de 65–90 s, volta para `SCRIPT_REVIEW` com o aviso.
- Normaliza o loudness da voz e comprime antes da mixagem.

### 4. Composição e render (`render-worker`)
- `engine/compose` transforma `episodio.json` + áudios + palavras em um **projeto HyperFrames**: uma composição raiz 1080×1920 a 30 fps, um clip por plano, a timeline GSAP gerada a partir de `acao`, `camera`, `efeitos` e da legenda palavra por palavra, mais o HUD.
- Componentes obrigatórios do motor (Fase 1):
  - **HUD**: selo `NOITE N · HH:MM` e medidor de tensão (bateria, com cores por faixa).
  - **Legenda**: 2 a 3 palavras por vez, a palavra atual em vermelho, as palavras de destaque em amarelo, contorno preto grosso, no terço inferior.
  - **Cartão de título**: faixa preta, palavra-chave colorida, entrada com encaixe seco.
  - **Tela de resultado**: placar em barras A×B, a vencedora cresce, carimbo "O MAIS VOTADO FOI X". Primeiros 4–6 s.
  - **Tela VOTE A / VOTE B**: último quadro congelado e escurecido, dois cartões gigantes (A amarelo, B vermelho) com a ação, faixa "COMENTA A OU B 👇 · O MAIS VOTADO DECIDE O PRÓXIMO EPISÓDIO", pulso leve. Últimos 6–8 s.
  - **Rig de personagem**: partes com pivôs (cabeça, tronco, braço e antebraço E/D, mão, coxa e canela E/D, pé), 4 vistas (frente, costas, perfil, 3/4), poses em JSON de ângulos, ciclos de andar e correr. O movimento é propositalmente **duro e econômico**: interpolações curtas, segura, encaixa.
  - **Câmera**: `push_in`, `pull_out`, `pan_*`, `tilt_*`, `shake`, `corte_seco`.
  - **Efeitos de luz**: `emergencia_vermelha`, `lanterna` (cone de luz com máscara), `piscar_luz`, `apagao`.
  - **Infográficos**: `corte_tunel`, `ondas_som`, `mapa_linha`, `placar_votacao`.
- Mixagem: voz, SFX por chave e música de fundo com ducking sob a voz.
- `hyperframes lint` antes de renderizar. Depois do render: **contact sheet** (1 quadro por plano), `ffmpeg ebur128` (loudness), `blackdetect`, duração final e Whisper no MP4 final, conferindo que a última frase está completa. Tudo vai para o log e para a tela de revisão.

### 5. Publicação (`publisher-worker`)
- Igual ao cortes: Buffer, URL pública via Cloudflare Tunnel, intervalo mínimo configurável, interruptor de arquivo e limpeza só após `POSTED`.
- Ao publicar um episódio com votação: cria o **Vote** com `fechaEm = postadoEm + janela` (padrão: 24 h).

### 6. Votação (`vote-worker`)
- **Primeiro passo da Fase 4: descubra o que a API do Buffer realmente devolve sobre comentários** (introspecção do schema GraphQL). Implemente a interface `CommentsProvider` com:
  - `BufferCommentsProvider`, se der para ler o texto dos comentários;
  - `ManualCommentsProvider`, sempre disponível: eu colo os comentários ou digito a contagem A/B na UI.
  - Se o Buffer não servir, documente o que encontrou e proponha a alternativa antes de seguir.
- Ao fechar: busca os comentários, deduplica por autor (vale o último dentro da janela), classifica por **regex** (A, B, "letra a", "vote b", emojis 🅰️/🅱️) e manda **só os ambíguos** para o Claude (MODO 3 da skill). Recalcula o placar **no código**.
- Regras: empate → opção marcada como padrão no nó (ou A); menos votos que o mínimo configurado (padrão 15) → opção padrão, com `criterio = poucos_votos_padrao`. Eu posso sobrescrever manualmente na UI antes de aplicar.
- Aplica: grava o vencedor, aplica `efeitosA/B` ao estado, ativa o próximo nó (`noSeA`/`noSeB`), marca o outro galho como `SKIPPED` e cria o próximo Episode em `PENDING_SCRIPT` com o resultado (`pct_a`, `pct_b`, `frase`) anexado.

### 7. Métricas
- Igual ao cortes: puxa do Buffer e liga ao episódio. Retenção e curtidas alimentam o few-shot do roteiro.

## UI (abas sempre montadas, polling)

1. **Série**: escolher a série ativa, ver a bíblia renderizada, ver o estado atual (variáveis + medidor).
2. **Mapa da temporada** (React Flow): os nós do esqueleto, o caminho percorrido destacado, o galho escolhido com o placar (A 38% × B 62%), os galhos pulados em cinza e os nós futuros tracejados. Clicar num nó abre o episódio.
3. **Roteiro**: o JSON exibido como **storyboard** (cartão por plano: cenário, personagens, ação, narração, duração), checagens automáticas com ✅/❌, e os botões aprovar, rejeitar com comentário e regenerar.
4. **Assets**: catálogo com prévias, fila de assets novos para aprovar e prévia de cada pose dos personagens.
5. **Render**: fila, progresso, log, `<hyperframes-player>` do resultado, contact sheet, métricas de QA e o botão aprovar.
6. **Publicação e votação**: próximo horário de post, editar copy, "Postar agora", votações abertas com contagem regressiva, apuração com a lista de comentários classificados e o botão "aplicar resultado" (ou sobrescrever).

## Operação
- `scripts/servidor.sh` via cron a cada minuto, como no cortes, subindo: site, `script-worker`, `asset-worker`, `voice-worker`, `render-worker`, `publisher-worker`, `vote-worker`.
- `scripts/instalar-dependencias.sh`: ffmpeg, whisper, edge-tts, Chrome/Chromium, Node 22+ e o HyperFrames.
- Variáveis: `DATABASE_URL`, `BUFFER_ACCESS_TOKEN`, `BUFFER_PROFILE_ID`, `PUBLIC_BASE_URL`, `HYPERFRAMES_NO_TELEMETRY=1`, `TTS_PROVIDER`, `TTS_VOICE_NARRADOR`, `VOICESTUDIO_URL` (opcional), `CLAUDE_PATH`, timeouts.
- O servidor é um mini PC **sem GPU**: um render por vez, e meça o tempo de render na Fase 1.

## Fases (entregue e valide uma de cada vez; me mostre o resultado antes de passar para a próxima)

**Fase 0: base.** Repo, Prisma + Postgres (docker compose), HyperFrames instalado e funcionando (renderize um "olá" vertical), telemetria desligada, estrutura de pastas, Zod do episódio.
✅ Aceite: `npm run render:hello` gera um MP4 1080×1920.

**Fase 1: motor visual + biblioteca da Estação Fantasma.** Escreva `engine/STYLE.md` a partir da `cena-exemplo`. Construa HUD, legenda, cartão, tela de resultado, tela de votação, rig com as 4 vistas e umas 12 poses para **Caio, Dona Socorro e Dr. Valdir**, a criatura (com variações de escala e cor para multidão), os cenários `vagao`, `tunel`, `plataforma_1959` e `porta_1959`, os efeitos de luz e a câmera. Depois, gere o **EP1** com a skill (MODO 2, nó `ep01`) e renderize **sem voz** (narração só na legenda, duração planejada).
✅ Aceite: contact sheet do EP1 com personagens idênticos entre planos; as telas de votação e de resultado legíveis no celular; tempo de render medido.

**Fase 2: voz + tempos + QA.** `TtsProvider` (edge-tts), verificação Whisper, ajuste de duração, mixagem com SFX e música, checagens pós-render.
✅ Aceite: EP1 completo, com voz sincronizada à legenda, entre 65 e 90 s, e um relatório de QA verde.

**Fase 3: fila, workers e UI de revisão.** Modelo de dados completo, todos os workers com o padrão do cortes, abas Série, Roteiro, Assets e Render, e o asset novo com conferência visual.
✅ Aceite: do botão "Gerar próximo episódio" até `RENDER_REVIEW` sem eu tocar em nada, sobrevivendo a um `docker restart` no meio.

**Fase 4: publicação + votação + mapa.** Buffer, investigação de comentários, `CommentsProvider`, apuração, aplicação no esqueleto e no estado, mapa React Flow.
✅ Aceite: simular uma votação com `ManualCommentsProvider` e ver o EP2 certo (`ep02_a` ou `ep02_b`) nascer com a tela "O MAIS VOTADO FOI…".

**Fase 5: métricas + piloto automático.** Ciclo de métricas no prompt e piloto automático com as regras de aprovação automática.
✅ Aceite: um ciclo completo de episódio sem intervenção, com notificação se alguma checagem falhar.

## Como trabalhar
- Comece pela **Fase 0**. Antes de cada fase, me mostre um plano curto (arquivos e decisões) e espere meu ok.
- Testes para o que é lógica pura: apuração (regex, dedupe, empate, mínimo de votos), aplicação de efeitos no estado, validação do roteiro e cálculo de duração.
- Commits pequenos por item da fase.
- Se algo da bíblia ou da skill parecer contraditório com o que o motor consegue fazer, **pergunte**; não mude a bíblia por conta própria.
- Nunca diga que gerou um vídeo sem o arquivo existir e passar nas checagens.

## Depois de pronto: como eu uso no dia a dia
- **Próximo episódio** acontece sozinho após a votação (ou pelo botão).
- **Série nova ou temporada nova:** no Claude Code, na raiz do repo, peço "use a skill serie-interativa, modo nova série: [ideia]". Ela gera `series/<slug>/biblia.md` + `assets-necessarios.md`, eu aprovo, e o sistema importa o esqueleto e produz os assets que faltam.
