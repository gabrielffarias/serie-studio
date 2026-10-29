# Licenças de áudio e voz

Regra do projeto: o canal é monetizado, então só entra **CC0 (domínio público) ou obra nossa**. Nada de CC-BY, CC-BY-NC nem "uso livre" sem licença escrita. Toda entrada nova traz fonte, autor, licença e a data em que a licença foi conferida.

## Efeitos (`sfx/`)

| Arquivo | Origem | Autor | Licença | Conferido |
|---|---|---|---|---|
| `zumbido_corta.ogg` | Sintetizado no projeto (`scripts/sintetizar-sons.sh`) | serie-studio | CC0 (obra nossa) | 2026-10-29 |
| `vidro_quebra.ogg` | [Glass Break](https://opengameart.org/content/glass-break) (`glass_breaking.wav`, convertido para ogg) | Till Behrend (enviado por TinyWorlds) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-10-29 |
| `vidro_quebra_curto.ogg` | [75 CC0 breaking / falling / hit sfx](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx) (`bfh1_glass_breaking_06.ogg`) | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-10-29 |
| `estalo_seco_1.ogg` | idem (`bfh1_wood_hit_01.ogg`) | rubberduck | CC0 1.0 | 2026-10-29 |
| `estalo_seco_2.ogg` | idem (`bfh1_hit_09.ogg`) | rubberduck | CC0 1.0 | 2026-10-29 |
| `estalo_seco_3.ogg` | [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx) (`wooden_01.ogg`) | rubberduck | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-10-29 |
| `passos_pedra.ogg` | [Fantozzi's Footsteps (Grass/Sand & Stone)](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone) (`Fantozzi-StoneL1/R1/L2/R2.ogg`, montados em sequência de 4 pisadas) | Fantozzi (enviado por qubodup) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-10-29 |
| `freio_metal.ogg`, `rangido_trilho.ogg`, `clique_rele.ogg`, `clique_lanterna.ogg`, `chiado_radio.ogg`, `sopro_rapido.ogg` | Sintetizados no projeto (`scripts/sintetizar-sons.sh`, só ffmpeg) | serie-studio | CC0 (obra nossa) | 2026-10-29 |
| `murmurio_vagao.ogg` | Sintetizado no projeto (`scripts/sintetizar-sons.sh`): 8 frases do Kokoro-82M (`pm_alex`, `pm_santa`, `pf_dora`) sobrepostas, abafadas e com eco | serie-studio, vozes Kokoro-82M | CC0 (obra nossa); as vozes saem do Kokoro, [Apache-2.0](https://huggingface.co/hexgrad/Kokoro-82M) (ver Vozes) | 2026-10-29 |
| `coracao_batendo.ogg` | [Heartbeat sounds](https://opengameart.org/content/heartbeat-sounds) (`heartbeat_fast_0.wav`, repetido 4 vezes, +12 dB, fade no fim) | bart | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-10-29 |
| `gritos_abafados.ogg` | [Crowd Shouting/Speaking Ambience](https://opengameart.org/content/crowd-shoutingspeaking-ambience) (`crowd_shouting.ogg`, trecho de 3 a 7 s, passa-baixa em 700 Hz e eco, como se viesse de outro vagão) | StarNinjas | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (o autor pede crédito, sem obrigação) | 2026-10-29 |

Os pacotes do OpenGameArt não trazem arquivo de licença dentro; vale a licença declarada na página de cada um (links acima).

## Música (`musica/`)

| Arquivo | Origem | Autor | Licença | Conferido |
|---|---|---|---|---|
| `drone_suspense.ogg` | Sintetizado no projeto (`scripts/sintetizar-sons.sh`), 60 s em loop | serie-studio | CC0 (obra nossa) | 2026-10-29 |

## Vozes (TTS)

| Provedor | Uso | Situação para uso comercial | Conferido |
|---|---|---|---|
| **Azure Speech** (API oficial, vozes neurais) | Produção, quando a chave existir | Serviço pago com uso comercial previsto; conferir os termos ao contratar | pendente (conta ainda não criada) |
| **edge-tts** (`pt-BR-AntonioNeural`, `pt-BR-FranciscaNeural`, `pt-BR-ThalitaMultilingualNeural` e Multilingual) | Testes e provisório | **Não é API oficial**: usa o serviço de leitura em voz alta do navegador Edge, sem licença para uso comercial. Trocar por Azure (mesmas vozes) antes de monetizar | 2026-10-29 |
| **Kokoro-82M** (`pm_alex`, `pm_santa`, `pf_dora`) | Fallback local | **Permitido.** Pesos [Apache-2.0](https://huggingface.co/hexgrad/Kokoro-82M); segundo o model card, treinado com áudio permissivo (domínio público, Apache/MIT e alguns conjuntos CC-BY); a licença do que ele gera é a dos pesos. Roda com `kokoro-onnx` (MIT) | 2026-10-29 |
| **Piper** `pt_BR-faber-medium` (e `cadu`, `jeff`) | Descartado | **Não usar.** O [model card](https://huggingface.co/rhasspy/piper-voices/blob/main/pt/pt_BR/faber/medium/MODEL_CARD) diz dataset CC0, mas a voz é *finetuned* da `en_US-lessac`, cujo dataset (Blizzard 2013, Lessac Technologies) tem [licença só para pesquisa](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html). O modelo herda o risco | 2026-10-29 |
| **Piper** `pt_BR-edresson-low` | Descartado | Dataset CC-BY 4.0 (exige atribuição; fora da regra) e base `en_US-ryan`; qualidade baixa (16 kHz) | 2026-10-29 |
