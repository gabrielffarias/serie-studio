cortes_tiktok — como tudo funciona
Sistema que pega um vídeo longo do YouTube (podcast, palestra, vlog de desenvolvimento pessoal), encontra os trechos com mais potencial viral usando IA, edita cada trecho como vídeo vertical 9:16 com legenda animada e enquadramento no rosto, e publica no TikTok sozinho, respeitando um intervalo mínimo entre posts.

Este documento descreve o pipeline de ponta a ponta, as decisões de arquitetura e as lições aprendidas. Foi escrito para servir de referência a outro projeto.

1. Visão geral
 URL do YouTube
      │
      ▼
 ┌──────────────┐   yt-dlp (só áudio) + Whisper (transcrição palavra a palavra)
 │ 1. EXTRAÇÃO  │──────────────────────────────────────────► data/transcripts/<id>.json
 └──────┬───────┘
        ▼
 ┌──────────────┐   Claude CLI lê a transcrição → lista de cortes com nota,
 │ 2. ANÁLISE   │   gancho, palavras de destaque, layout, produto do CTA
 └──────┬───────┘   + 2ª chamada: título e legenda únicos para cada corte
        ▼
 ┌──────────────┐   humano aprova/rejeita na interface
 │ 3. REVISÃO   │   (ou "Piloto Automático": aprova tudo com nota ≥ 65)
 └──────┬───────┘
        ▼
 ┌──────────────┐   yt-dlp baixa SÓ o trecho em 1080p → rastreamento de rosto
 │ 4. RENDER    │   → Remotion monta o vídeo 9:16 (legenda, gancho, CTA, efeitos)
 └──────┬───────┘
        ▼
 ┌──────────────┐   1 post a cada 6h no máximo, via API GraphQL do Buffer
 │ 5. PUBLICAÇÃO│   → apaga os arquivos locais do corte publicado
 └──────┬───────┘
        ▼
 ┌──────────────┐   puxa views/curtidas do Buffer e usa os melhores e piores
 │ 6. FEEDBACK  │   cortes como exemplos no prompt da próxima análise
 └──────────────┘
Cada etapa pesada roda num worker separado (processo Node independente) que consome uma fila no Postgres. O site (Next.js) só cria registros e mostra o progresso. Nenhum trabalho longo fica preso numa requisição HTTP.

2. Stack
Camada	Tecnologia
Interface + API	Next.js 16 (App Router, rotas em src/app/api/*), React 19, Tailwind 4
Banco	PostgreSQL via Prisma (prisma/schema.prisma)
Workers	Scripts TypeScript rodados com tsx (scripts/*-worker.ts)
Download	yt-dlp (com cookies do YouTube e --js-runtimes node)
Transcrição	OpenAI Whisper CLI local, só CPU, modelo base, --word_timestamps True
IA (cortes e copy)	Claude Code CLI local (claude -p "<prompt>" --allowedTools Read), sem chamada direta de API
Edição de vídeo	Remotion 4 (React → vídeo, renderizado com Chrome headless)
Rastreamento de rosto	@vladmandic/face-api (TinyFaceDetector) no backend WASM do TensorFlow.js + ffmpeg
Publicação	API GraphQL do Buffer, conectado à conta do TikTok
Exposição pública	Cloudflare Tunnel, para o Buffer conseguir baixar o vídeo renderizado
Supervisão	cron a cada minuto rodando scripts/servidor.sh
3. Modelo de dados e máquinas de estado
Tabelas principais (prisma/schema.prisma):

Video: um por vídeo do YouTube (youtubeId único). Guarda status, progresso e log da extração e da análise.
Clip: um por corte sugerido. Guarda tempos de início e fim, nota, título, gancho, palavras de destaque, layout, produto do CTA, copy do post, status, progresso e log do render, tentativas e id do post no Buffer.
ClipMetrics: números reais do TikTok de um corte publicado. Fica em tabela separada de propósito, veja a seção 9.
SystemSettings: linha única (id = "singleton") com o toggle do Piloto Automático.
Status do Video
PENDING_EXTRACTION → EXTRACTING → EXTRACTED ──(clicar "Analisar")──► PENDING_ANALYSIS → ANALYZING → ANALYZED
                         └──► EXTRACTION_FAILED                                              └──► ANALYSIS_FAILED
Com o Piloto Automático ligado, a extração termina direto em PENDING_ANALYSIS.

Status do Clip
PENDING ──aprovar──► PENDING_RENDER → RENDERING → RENDERED ──publicar──► POSTED
   │                                     └──► RENDER_FAILED (volta para a fila enquanto retryCount < 3)
   └──rejeitar──► REJECTED
O status no banco é a fila. Os workers procuram o registro mais antigo no status de entrada, mudam para o status "em andamento" e, no fim, gravam o status final.

4. Etapa por etapa
4.1 Extração (baixar + transcrever)
Entrada: POST /api/extract { url } (src/app/api/extract/route.ts)

Extrai o ID de 11 caracteres de qualquer formato de URL (watch?v=, youtu.be, shorts, embed, live).
Cache: se data/transcripts/<id>.json já existe, responde na hora, sem passar pela fila. Nunca rebaixa um vídeo já analisado.
Se o vídeo já está na fila ou em processamento, não reinicia.
Confere se yt-dlp, ffmpeg e whisper existem no sistema.
Cria ou atualiza o Video como PENDING_EXTRACTION e responde 202. O navegador acompanha com polling em GET /api/extract/[jobId].
Worker: scripts/extraction-worker.ts → src/lib/extract-video.ts

Pega o próximo vídeo de forma atômica:
UPDATE "Video" SET status='EXTRACTING' ...
WHERE id = (SELECT id FROM "Video" WHERE status='PENDING_EXTRACTION'
            ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED)
RETURNING id, "youtubeId"
FOR UPDATE SKIP LOCKED garante que dois workers nunca peguem o mesmo vídeo. O Whisper ocupa a CPU inteira, então é um vídeo por vez.
yt-dlp baixa só o áudio em mp3 (bestaudio). O progresso sai das linhas [download] 42.7% e vale de 0 a 50% da barra.
whisper <mp3> --model base --language pt --threads 4 --output_format json --word_timestamps True --verbose True.
--verbose True imprime uma linha [mm:ss --> mm:ss] texto por segmento. Comparando com a duração total (via ffprobe), sai o progresso real, de 50 a 100%.
--word_timestamps True gera o tempo de cada palavra, que é a base da legenda sincronizada.
--language pt pula a etapa de detecção de idioma, que é lenta e às vezes erra.
Apaga o mp3, porque o render baixa o vídeo de novo depois. Marca EXTRACTED, ou PENDING_ANALYSIS se o Piloto Automático estiver ligado.
Saída: data/transcripts/<youtubeId>.json (JSON do Whisper: segments[].words[] = {word, start, end}).

4.2 Análise (IA escolhe os cortes)
Entrada: POST /api/analyze { jobId } muda o vídeo para PENDING_ANALYSIS.

Worker: scripts/analysis-worker.ts → src/lib/analyze-video.ts

Sincroniza métricas reais do TikTok via Buffer (src/lib/post-metrics.ts). Se falhar, segue em frente.
Monta exemplos (few-shot):
Se há pelo menos 6 cortes publicados com 100 views ou mais e mais de 24h de vida, ordena por taxa de curtidas e coloca no prompt os 3 melhores ("procure trechos parecidos") e os 3 piores ("evite temas e ganchos parecidos").
Senão, usa os 3 últimos cortes aprovados como "exemplos do que o usuário gosta".
Chama o Claude CLI com um prompt grande em português. O Claude lê o arquivo da transcrição sozinho, e por isso a chamada usa --allowedTools Read. Regras principais do prompt:
ignorar introduções e cumprimentos; começar sempre com um gancho forte;
começo, meio e fim; nunca cortar no meio de uma frase ou de um raciocínio;
duração de 65 a 120 s (o mínimo vem da monetização do TikTok);
nota em 4 critérios de 0 a 25: score_gancho (prende nos 3 primeiros segundos?), score_soco (verdade crua ou conselho contraintuitivo?), score_autossuficiencia (faz sentido sozinho?), score_publico (aplicável à vida de quem assiste?). O virality_score é a soma. O prompt pede rigor ("mediano = 55–75, acima de 85 só se postaria com total confiança");
ortografia corrigida em todos os textos gerados;
ultima_frase_falada: as últimas 5 palavras do corte, como prova de que ele termina numa ideia completa. Isso vai para o log;
layout_type: split_screen (aula, gameplay, react, em que a pessoa aparece numa webcam pequena) ou fullscreen_face (podcast, vlog);
gancho_na_tela: frase de até 8 palavras que aparece grande no início do vídeo;
palavras_destaque: 3 a 5 palavras faladas que a legenda pinta de outra cor;
produto_cta: qual produto do link da bio combina com o tema (src/lib/products.ts);
títulos e ganchos todos diferentes entre si;
"retorne ESTRITAMENTE um JSON com o array clips".
Interpreta a resposta: extractJsonPayload (src/lib/claude-cli.ts) pega do primeiro [/{ até o último ]/} e ignora qualquer texto em volta. A nota é recalculada somando os 4 critérios, porque a conta do modelo não é confiável. Tempos mm:ss viram segundos.
Salva numa transação: apaga os cortes antigos daquele vídeo (reanalisar substitui em vez de duplicar) e cria os novos como PENDING. Também grava uma cópia em data/clips/<id>.json para debug.
Copy do post (src/lib/ai-copywriter.ts): uma segunda chamada ao Claude gera título e legenda para todos os cortes de uma vez, para o modelo enxergar todos e variar entre eles. Cada legenda tem uma pergunta que divide opiniões (para gerar comentários), um CTA que cita o produto pelo nome e de 3 a 5 hashtags. Se falhar, os cortes continuam salvos.
Piloto Automático (se ligado): cortes com nota de 65 ou mais vão direto para PENDING_RENDER. Os outros são apagados, com arquivos e registro (discardClips).
Timeouts: 12 min para a análise e 8 min para a copy. Uma análise real chegou a levar 4min32s.

4.3 Revisão (humano)
Interface com 4 abas (src/app/page.tsx + src/components/tabs/*):

Nova Extração: cola a URL e acompanha o progresso e o log ao vivo (polling). Tem o histórico de vídeos e o botão "Analisar".
Revisão de Cortes: cards com nota (e o detalhe por critério), duração, explicação, layout e produto. O botão de preview chama POST /api/prepare-preview/[clipId], que baixa o trecho em 480p e monta as palavras da legenda, e o vídeo toca no @remotion/player com a mesma composição do render final. Aprovar faz PATCH /api/clip/[id] {status:"PENDING_RENDER"}.
Central de Renderização: fila, progresso e log de cada render.
Agendamento: cortes RENDERED esperando publicação. Dá para editar título e legenda (PATCH /api/rendered-clips/[id]) ou clicar "Postar Agora" (POST /api/publish/[id]). Mostra quando sai o próximo post.
As abas ficam sempre montadas (só a visibilidade muda), para não perder o polling ao trocar de aba.

4.4 Render (edição do vídeo)
Worker: scripts/render-worker.ts → src/lib/render-clip.ts. Pega PENDING_RENDER, ou RENDER_FAILED com menos de 3 tentativas.

Download do trecho em alta (src/lib/clip-media.ts):
yt-dlp <url> -f "bestvideo[height<=1080]+bestaudio/best[height<=1080]"
  --download-sections "*<início>-<fim>" --force-keyframes-at-cuts --merge-output-format mp4
Baixa só a janela do corte, não o vídeo inteiro. --force-keyframes-at-cuts faz o vídeo começar exatamente no frame 0. Vai para data/videos/<clipId>-highres.mp4. Se já existe, pula.
Legenda: filtra as palavras da transcrição completa para a janela do corte e desloca os tempos para que o corte comece em 0.
Rastreamento de rosto (src/lib/face-tracking.ts), que é a parte mais elaborada. Ver a seção 5.
Remotion: bundle() uma vez, servido por um servidor HTTP local (src/lib/remotion-server.ts) que também expõe data/videos e data/renders lidos direto do disco, sem precisar refazer o bundle a cada vídeo novo. Depois selectComposition + renderMedia (h264, 1080×1920, 30fps) para data/renders/<clipId>.mp4.
Divisão da barra de progresso: download de 0 a 25%, rosto de 25 a 35%, Remotion de 35 a 100%.
Composição (src/remotion/TikTokClip.tsx), em camadas:

Vídeo, em um de três layouts:
fullscreen_face: object-fit: cover com object-position animado para manter o rosto no centro (ver seção 5);
split_screen: metade de cima com zoom forte no rosto (webcam), metade de baixo com o conteúdo da tela;
quadro inteiro: o vídeo original inteiro sobre uma cópia dele mesmo desfocada e escurecida (B-roll, gráficos, painel com muitas pessoas).
Zoom em "cortes de câmera": alterna entre 1.0 e 1.1 com corte seco, nas pausas da fala (pausa de 0,3s ou mais, ou fim de frase), segurando cada zoom entre 3,5 e 8s. Imita um editor alternando entre duas câmeras.
Correção de cor leve (contraste, brilho, saturação), grão de filme estático e brilho/reflexo ocasional, em momentos sorteados com semente fixa.
Legenda (Captions.tsx): 3 palavras por vez no terço inferior. A palavra sendo falada "pula" em amarelo; as palavras de destaque ficam verdes e maiores. Contorno preto grosso.
Gancho na tela (HookTitle.tsx): caixa branca com texto preto nos primeiros 3,5s, para segurar quem assiste sem som.
Selo de CTA (CtaBadge.tsx): "link na bio" com o nome do produto nos últimos 4s. É discreto de propósito, para não dar motivo de passar o vídeo antes do fim (a taxa de conclusão pesa na distribuição).
Regra do Remotion: os frames são renderizados fora de ordem e em paralelo, então todo efeito precisa ser uma função pura do número do frame. Nada de Math.random() ou de estado entre frames. Para aleatoriedade, usar random(seed) do Remotion.

4.5 Publicação
Worker: scripts/publisher-worker.ts. É baseado em tempo, não em fila: a cada 1 min confere se o último post (updatedAt do clip POSTED mais recente) foi há mais de 6h. Se sim, publica o RENDERED mais antigo.

src/lib/publish-clip.ts (caminho único, usado pelo worker e pelo botão "Postar Agora"):

Só aceita clip RENDERED com o arquivo existente. Isso trava publicação dupla.
Legenda: o que foi editado na interface → copyCaption → explicação → título.
src/lib/tiktok-publisher.ts → mutation createPost na API GraphQL do Buffer (mode: "shareNow"), passando a URL pública do vídeo, e não o arquivo. A API do Buffer não aceita upload, só busca o vídeo por URL. Por isso a rota GET /api/media/<clipId>.mp4 serve o render (com suporte a Range, sem autenticação, com nome de arquivo validado por regex), exposta na internet pelo Cloudflare Tunnel (PUBLIC_BASE_URL).
Marca POSTED, grava o bufferPostId e a copy realmente usada.
Limpeza (src/lib/cleanup-tasks.ts): apaga o preview, o vídeo em alta e o render daquele corte. Só depois de confirmar POSTED, nunca por tempo.
O publicador só sobe se existir o arquivo data/publicacao-ligada. É um interruptor simples para pausar as postagens.

4.6 Feedback
src/lib/post-metrics.ts busca os posts enviados no Buffer (paginado, até 300), liga cada um ao clip pelo bufferPostId (ou pelo texto exato da legenda, no caso de posts antigos) e grava views, curtidas, comentários, compartilhamentos e tempo médio assistido em ClipMetrics. A análise seguinte usa esses números (seção 4.2, passo 2). É um ciclo de aprendizado sem treinar modelo nenhum.

5. Rastreamento de rosto em detalhe (src/lib/face-tracking.ts)
A saída é uma "trajetória de câmera" {time, x, y}[] (centro do rosto, normalizado de 0 a 1 no quadro original), com 1 ponto a cada 0,1s, mais fitIntervals (trechos para mostrar em quadro inteiro).

Uma única decodificação com ffmpeg: o vídeo é lido a 30fps em 480px de largura como RGB cru, via pipe. Cada frame alimenta três análises:
Detecção de corte de cena (todo frame): miniatura 32×18; diferença média entre frames consecutivos. Um corte é um pico de um frame só, de pelo menos 8 e pelo menos 3,5× a mediana dos 16 frames vizinhos. Diferenças zero são ignoradas, porque vêm de frames duplicados de fontes 24/25fps convertidas para 30. Um limite global fixo falhava: corte seco com câmera parada muda pouco a imagem, enquanto câmera na mão muda muito, mas ao longo de vários frames.
Movimento (a cada 3 frames): grade de células de 8px com a diferença absoluta média, usada para detectar quem está falando.
Detecção de rosto (a cada 15 frames = 2/s, mais uma extra logo depois de um provável corte): detectAllFaces no tensor do frame. Rostos com menos de 50% da altura do maior rosto do frame são considerados fundo e descartados.
Para cada trecho entre cortes de cena:
Agrupa rostos por posição horizontal em "pessoas". Grupos próximos (menos de 1,2 largura de rosto) são unidos como a mesma pessoa se movendo, exceto quando aparecem no mesmo frame: aí são duas pessoas.
Sem rosto confiável e com 1,5s ou mais → quadro inteiro. Trechos curtos ficam com corte central.
3 ou mais pessoas que não cabem juntas no 9:16 → quadro inteiro.
Pessoas que cabem juntas no corte → enquadra o grupo.
2 pessoas afastadas → segue quem fala: compara o movimento na região da boca (metade de baixo do rosto) com média de 1s. Troca com corte seco se a outra pessoa se mexe 1,4× mais por 0,7s seguidos e a atual já está na tela há 2s ou mais. Só considera alguém ausente depois de 0,6s sem detecção. Como tudo é offline, o corte é antecipado para o momento em que a outra pessoa começou a falar.
Suavização dentro de cada segmento: preenche falhas de detecção → filtro de mediana de 3 → zona morta (a câmera só anda quando o rosto sai de 5% da largura visível) → mola criticamente amortecida (SmoothDamp, 0,9s, velocidade máxima de 0,4 quadro/s, sem passar do alvo) → média móvel. Entre segmentos o corte é seco, com dois pontos separados por 1ms.
No Remotion: object-position não significa "centralize este ponto". Ele alinha o ponto p% da imagem com o ponto p% da caixa. Por isso o centro do rosto é convertido assim: p = (centro − visível/2) / (1 − visível), onde visível é a fração do quadro original que o cover mostra. A proporção do vídeo original vai como prop.
Tempo: cerca de 25 a 40s de análise para um corte de 60 a 100s, em CPU.

6. Workers: o padrão usado em todos
async function loop() {
  await requeueInterrupted();         // o que ficou "em andamento" volta para a fila
  while (true) {
    const job = await claimNext();    // findFirst do status de entrada (ou UPDATE ... SKIP LOCKED)
    if (!job) { await sleep(5000); continue; }
    await process(job);               // sempre com await: um trabalho por vez
  }
}
Função de trabalho "pura" (extractVideoToTranscript, analyzeVideo, renderClipToFile): não mexe no status, só recebe os callbacks onLog e onProgress. O worker é que grava o status. Assim a mesma função serve para worker, script ou teste.
createProgressReporter (src/lib/progress-reporter.ts): acumula o log e grava {progress, logs} no banco no máximo 1× por segundo, com escritas em série. Parece ao vivo na interface sem sobrecarregar o Postgres.
Recolocar na fila ao iniciar: se o processo morreu no meio (container reiniciou), o registro preso em RENDERING, ANALYZING ou EXTRACTING volta para a fila. Isso só é seguro porque existe uma instância de cada worker.
Tentativas: o render tenta de novo até 3 vezes (retryCount).
Supervisão (scripts/servidor.sh, pelo cron a cada minuto)
flock impede duas execuções simultâneas.
Para cada processo (site, extração, análise, render e publicação), se o pgrep não encontra, sobe com setsid nohup. O filho não herda o lock (9>&-).
Se o container foi recriado e perdeu as dependências de sistema (ffmpeg, whisper, yt-dlp, libs do Chrome), roda scripts/instalar-dependencias.sh antes de subir os workers, para não gastar as tentativas de render em falhas certas.
O cron precisa de HOME e PATH explícitos (login do Claude CLI e node do nvm).
7. Arquivos em disco (data/)
Caminho	Conteúdo	Ciclo de vida
transcripts/<youtubeId>.json	Transcrição do Whisper com tempo por palavra	Permanente (é o cache)
audio/<youtubeId>.mp3	Áudio para o Whisper	Apagado após a transcrição
clips/<youtubeId>.json	Resposta crua da IA	Debug
videos/<clipId>-preview.mp4	Trecho em 480p para o preview	Apagado ao publicar
videos/<clipId>-highres.mp4	Trecho em 1080p para o render	Apagado ao publicar
renders/<clipId>.mp4	Vídeo final 9:16	Apagado ao publicar
face-models/	Pesos do TinyFaceDetector (~190KB, baixados uma vez)	Permanente
youtube-cookies.txt	Cookies para o yt-dlp não ser bloqueado	Manual
publicacao-ligada	Interruptor do publicador	Manual
Variáveis de ambiente: DATABASE_URL, BUFFER_ACCESS_TOKEN, BUFFER_PROFILE_ID, PUBLIC_BASE_URL. Opcionais: YT_DLP_PATH, WHISPER_PATH, WHISPER_MODEL, WHISPER_LANGUAGE, WHISPER_THREADS, FFMPEG_PATH, FFPROBE_PATH, CLAUDE_PATH, CLAUDE_ANALYZE_TIMEOUT_MS, CLAUDE_COPYWRITER_TIMEOUT_MS.

8. Mapa de arquivos
src/app/api/
  extract/route.ts               POST cria o job de extração; [jobId] GET = status e progresso
  analyze/route.ts               POST coloca na fila de análise
  clips/[jobId]/route.ts         GET cortes de um vídeo
  clip/[clipId]/route.ts         PATCH aprovar / rejeitar / desfazer
  prepare-preview/[clipId]/      POST baixa 480p + palavras; GET entrega o vídeo
  render-queue/route.ts          GET fila de render
  rendered-clips/                GET fila de publicação + próximo horário; PATCH editar copy
  publish/[clipId]/route.ts      POST postar agora
  media/[filename]/route.ts      GET público do render (para o Buffer)
  settings/route.ts              Piloto Automático
src/lib/
  extract-video.ts               yt-dlp áudio + Whisper
  analyze-video.ts               prompt de cortes + gravação + Piloto Automático
  ai-copywriter.ts               prompt de título e legenda por corte
  claude-cli.ts                  aspas para shell + extração do JSON da resposta
  clip-media.ts                  download do trecho + palavras da legenda
  face-tracking.ts               cortes de cena, quem fala, quadro inteiro, suavização
  render-clip.ts                 orquestra o render
  remotion-server.ts             bundle + servidor local de assets
  publish-schedule.ts            regra das 6h
  publish-clip.ts                caminho único de publicação
  tiktok-publisher.ts            mutation do Buffer
  post-metrics.ts                métricas do TikTok via Buffer
  cleanup-tasks.ts               limpeza só depois de POSTED; descarte de rejeitados
  progress-reporter.ts           gravação de progresso limitada
  products.ts                    produtos do link da bio (CTA)
src/remotion/
  TikTokClip.tsx                 composição principal (layouts, zoom, enquadramento)
  Captions.tsx  HookTitle.tsx  CtaBadge.tsx  NoiseOverlay.tsx  ShineOverlay.tsx
scripts/
  extraction-worker.ts  analysis-worker.ts  render-worker.ts  publisher-worker.ts
  servidor.sh                    supervisor via cron
  instalar-dependencias.sh       reinstala apt/pip após recriar o container
  regenerate-copy.ts             correção pontual: reescreve copies repetidas
9. Decisões e lições aprendidas (o que vale copiar)
Trabalho pesado fora da requisição HTTP. No começo a análise rodava dentro da requisição e o celular dava "failed to fetch" quando a tela bloqueava. Solução: a rota só muda o status; um worker processa; a interface faz polling. Funciona em qualquer aparelho e sobrevive a fechar a aba.
O banco como fila (status + FOR UPDATE SKIP LOCKED) dispensa Redis ou RabbitMQ num projeto de uma máquina só.
Recolocar na fila ao iniciar + supervisor via cron = o sistema se recupera sozinho de reinícios.
Anti-spam do TikTok: postar a cada 2h e com a mesma legenda em vários cortes do mesmo vídeo fez a conta ser marcada (cerca de 0 views em tudo). Correções: intervalo de 6h (no máximo 4 posts por dia) e copy gerada em lote, para o modelo ver todas e variar ganchos, frases e CTAs.
Nota com critérios explícitos e somados no código. Quando o modelo dava uma nota única, ele punha 85–95 em tudo. Com 4 critérios de 0 a 25, régua honesta e soma recalculada, a nota passou a separar os cortes. O limite do Piloto Automático foi recalibrado de 88 para 65.
Prova de que o corte termina na hora certa: pedir as "últimas 5 palavras faladas" obriga o modelo a conferir o fim do corte e deixa isso visível no log.
Ciclo de feedback com dados reais: os melhores e piores posts entram no prompt como exemplos. Barato e eficaz.
Claude CLI em vez de API: claude -p '<prompt>' --allowedTools Read < /dev/null. O modelo lê o arquivo da transcrição sozinho (Read), sem estourar o tamanho do prompt. O < /dev/null evita a espera por entrada. A saída passa por um extrator de JSON tolerante.
Baixar só o necessário: extração = só áudio; render = só a janela do corte (--download-sections). Os arquivos são apagados depois de publicar.
Publicação via URL pública: o Buffer não aceita upload. O app serve o render numa rota pública com nome impossível de adivinhar e o Cloudflare Tunnel a expõe.
Remotion determinístico: todo efeito é função do frame. A aleatoriedade usa sementes fixas.
Enquadramento: zona morta + mola dão um movimento de câmera natural. Corte de cena reinicia o enquadramento. Detectar cortes por "pico local" e não por limite global. Com várias pessoas, cortar para quem fala ou mostrar o quadro inteiro, nunca cortar alguém pela metade.