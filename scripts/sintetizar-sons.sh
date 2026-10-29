#!/usr/bin/env bash
# Sons sintetizados no projeto (obra nossa, CC0; ver assets/audio/LICENCAS.md).
# Só ffmpeg (e o Kokoro no murmúrio), sem sample de fora. Rodar de novo regera os mesmos arquivos.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SFX="$RAIZ/assets/audio/sfx"
MUS="$RAIZ/assets/audio/musica"
mkdir -p "$SFX" "$MUS"

# Zumbido elétrico morrendo (apagão), 2,6 s: hum de 60 Hz com harmônicos
# ímpares (som de reator), a frequência cai pela metade e o volume some; o
# chiado de faísca aparece em rajadas curtas no meio.
T=2.6
ffmpeg -v error -y -filter_complex "
aevalsrc='
  0.55*sin(2*PI*60*(t-0.25*t*t/$T)) +
  0.30*sin(2*PI*180*(t-0.25*t*t/$T)) +
  0.18*sin(2*PI*300*(t-0.25*t*t/$T)) +
  0.10*sin(2*PI*420*(t-0.25*t*t/$T))
':s=48000:d=$T,
volume='pow(max(0,1-t/$T),1.6)*(0.75+0.25*sin(2*PI*7*t))':eval=frame[hum];
anoisesrc=color=white:a=0.5:d=$T:r=48000:seed=7,highpass=f=2500,
volume='0.35*gt(sin(2*PI*5.3*t)*sin(2*PI*1.7*t),0.55)*max(0,1-t/$T)':eval=frame[faisca];
[hum][faisca]amix=inputs=2:normalize=0,
afade=t=in:d=0.02,afade=t=out:st=$(awk "BEGIN{print $T-0.3}"):d=0.3,
alimiter=limit=0.89
" -ac 2 -c:a libvorbis -q:a 6 "$SFX/zumbido_corta.ogg"

# Drone grave de suspense, 60 s em loop: mi grave (41,2 Hz) com uma cópia
# desafinada (batimento lento), a quinta acima bem baixa e ruído marrom
# filtrado; as pontas casam (fade cruzado) para emendar sem clique.
D=60
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ffmpeg -v error -y -filter_complex "
aevalsrc='
  0.45*sin(2*PI*41.2*t) + 0.40*sin(2*PI*41.5*t) +
  0.12*sin(2*PI*61.7*t)*(0.6+0.4*sin(2*PI*t/15)) +
  0.08*sin(2*PI*82.4*t)*(0.5+0.5*sin(2*PI*t/20+1))
':s=48000:d=$((D+4))[tons];
anoisesrc=color=brown:a=0.6:d=$((D+4)):r=48000:seed=3,lowpass=f=180,lowpass=f=180,
volume='0.5*(0.7+0.3*sin(2*PI*t/12))':eval=frame[ar];
[tons][ar]amix=inputs=2:normalize=0,alimiter=limit=0.7
" -ac 2 "$TMP/bruto.wav"
# cauda (D..D+4) entra cruzando no começo do corpo (0..D): o fim do arquivo
# (tempo D) emenda no começo (também tempo D)
ffmpeg -v error -y -ss $D -i "$TMP/bruto.wav" -t $D -i "$TMP/bruto.wav" \
  -filter_complex "[0][1]acrossfade=d=4:c1=tri:c2=tri" -c:a libvorbis -q:a 6 "$MUS/drone_suspense.ogg"

# ── sons recorrentes do metrô ────────────────────────────────────────────────

# Freio de metal, 3,2 s: guincho agudo de roda no trilho (dois parciais
# desafinados que tremem e descem um pouco), banda de ruído metálico e o
# ronco grave do trem perdendo velocidade.
T=3.2
ffmpeg -v error -y -filter_complex "
aevalsrc='
  0.30*sin(2*PI*(2650*t - 60*t*t/$T + 18*sin(2*PI*9*t)/(2*PI*9))) +
  0.22*sin(2*PI*(3480*t - 90*t*t/$T + 25*sin(2*PI*13*t)/(2*PI*13))) +
  0.10*sin(2*PI*(5300*t - 120*t*t/$T))
':s=48000:d=$T,
volume='min(1,t/0.25)*(0.65+0.35*sin(2*PI*3.1*t)*sin(2*PI*0.7*t+1))*pow(max(0,1-t/$T),0.8)':eval=frame[guincho];
anoisesrc=color=white:a=0.5:d=$T:r=48000:seed=11,bandpass=f=3000:width_type=q:w=6,
volume='0.5*min(1,t/0.2)*pow(max(0,1-t/$T),1.2)':eval=frame[atrito];
anoisesrc=color=brown:a=0.8:d=$T:r=48000:seed=5,lowpass=f=120,
volume='0.9*pow(max(0,1-t/$T),0.6)':eval=frame[ronco];
[guincho][atrito][ronco]amix=inputs=3:normalize=0,
afade=t=out:st=$(awk "BEGIN{print $T-0.5}"):d=0.5,alimiter=limit=0.89
" -ac 2 -c:a libvorbis -q:a 6 "$SFX/freio_metal.ogg"

# Rangido de trilho, 2,4 s: atrito lento metal com metal, um trem de pulsos
# grave (o "agarra-solta") passando por ressonâncias de chapa.
T=2.4
ffmpeg -v error -y -filter_complex "
aevalsrc='0.9*pow(abs(sin(PI*(38*t+6*sin(2*PI*0.6*t)))),40)':s=48000:d=$T,
asplit=3[a][b][c];
[a]bandpass=f=620:width_type=q:w=12,volume=6[r1];
[b]bandpass=f=1180:width_type=q:w=14,volume=4[r2];
[c]bandpass=f=2310:width_type=q:w=18,volume=2[r3];
[r1][r2][r3]amix=inputs=3:normalize=0,
volume='sin(PI*t/$T)':eval=frame,
afade=t=in:d=0.1,afade=t=out:st=$(awk "BEGIN{print $T-0.3}"):d=0.3,volume=16dB,alimiter=limit=0.89
" -ac 2 -c:a libvorbis -q:a 6 "$SFX/rangido_trilho.ogg"

# Clique de relé, 0,35 s: dois estalos secos (bobina puxa e solta) com um
# zumbido metálico curtinho entre eles.
ffmpeg -v error -y -filter_complex "
anoisesrc=color=white:a=1:d=0.35:r=48000:seed=2,highpass=f=1500,
volume='0.9*(exp(-(t-0.0)*400)*gte(t,0)+0.7*exp(-(t-0.16)*500)*gte(t,0.16))':eval=frame[cliques];
aevalsrc='0.25*sin(2*PI*1900*t)*exp(-t*25)':s=48000:d=0.35[chapa];
[cliques][chapa]amix=inputs=2:normalize=0,alimiter=limit=0.89
" -ac 2 -c:a libvorbis -q:a 6 "$SFX/clique_rele.ogg"

# Clique da lanterna, 0,2 s: botão de plástico (estalo agudo e um eco grave
# do corpo da lanterna).
ffmpeg -v error -y -filter_complex "
anoisesrc=color=white:a=1:d=0.2:r=48000:seed=4,bandpass=f=3200:width_type=q:w=2,
volume='exp(-t*300)':eval=frame[estalo];
aevalsrc='0.35*sin(2*PI*420*t)*exp(-t*60)':s=48000:d=0.2[corpo];
[estalo][corpo]amix=inputs=2:normalize=0,alimiter=limit=0.89
" -ac 2 -c:a libvorbis -q:a 6 "$SFX/clique_lanterna.ogg"

# Chiado de rádio, 2,8 s: estática na banda de voz (300–3000 Hz) que
# "procura estação" (o volume e o filtro oscilam) e estalos aleatórios.
T=2.8
ffmpeg -v error -y -filter_complex "
anoisesrc=color=white:a=0.7:d=$T:r=48000:seed=9,highpass=f=300,lowpass=f=3000,
volume='0.55+0.45*sin(2*PI*1.3*t)*sin(2*PI*0.37*t+0.5)':eval=frame[estatica];
anoisesrc=color=white:a=1:d=$T:r=48000:seed=21,highpass=f=800,
volume='0.8*gt(sin(2*PI*17*t)*sin(2*PI*5.1*t)*sin(2*PI*2.3*t),0.8)':eval=frame[estalos];
aevalsrc='0.08*sin(2*PI*(900+400*sin(2*PI*0.4*t))*t)':s=48000:d=$T[assobio];
[estatica][estalos][assobio]amix=inputs=3:normalize=0,
afade=t=in:d=0.08,afade=t=out:st=$(awk "BEGIN{print $T-0.4}"):d=0.4,alimiter=limit=0.89
" -ac 2 -c:a libvorbis -q:a 6 "$SFX/chiado_radio.ogg"

# Sopro rápido, 0,9 s: algo passa rente (ruído com filtro que sobe e desce e
# atravessa da esquerda para a direita).
T=0.9
ffmpeg -v error -y -filter_complex "
anoisesrc=color=pink:a=0.9:d=$T:r=48000:seed=13,lowpass=f=1800,highpass=f=150,
volume='pow(sin(PI*t/$T),3)':eval=frame,
asplit=2[e][d];
[e]volume='1-t/$T':eval=frame[esq];
[d]volume='t/$T':eval=frame[dir];
[esq][dir]join=inputs=2:channel_layout=stereo,volume=11dB,alimiter=limit=0.89
" -c:a libvorbis -q:a 6 "$SFX/sopro_rapido.ogg"

# Murmúrio do vagão, 8 s em loop: várias vozes do Kokoro (Apache-2.0, ver
# LICENCAS.md) falando frases soltas, defasadas, abafadas e com eco de vagão;
# ninguém se entende. Precisa do Kokoro instalado (instalar-dependencias.sh).
FRASES=("o que aconteceu com o trem" "alguém tem sinal aí" "calma, já vai voltar" "eu vou perder o ônibus" "liga pra sua mãe" "ninguém avisou nada" "tá muito escuro aqui" "é a terceira vez essa semana")
VOZES=(pm_alex pf_dora pm_santa pf_dora pm_alex pm_santa pf_dora pm_alex)
ENTRADAS=(); MIXF=""
for i in "${!FRASES[@]}"; do
  python3 "$RAIZ/engine/voz/tts.py" kokoro "$TMP/m$i.wav" "${FRASES[$i]}" "${VOZES[$i]}" "$(awk "BEGIN{print 0.85+($i%3)*0.1}")" "$RAIZ/data/modelos/kokoro" > /dev/null
  ENTRADAS+=(-i "$TMP/m$i.wav")
  MIXF+="[$i:a]adelay=$(( (i*970) % 6000 )):all=1,volume=$(awk "BEGIN{print 0.5+($i%4)*0.12}")[m$i];"
done
N=${#FRASES[@]}
ffmpeg -v error -y "${ENTRADAS[@]}" -filter_complex "
${MIXF}$(for i in $(seq 0 $((N-1))); do echo -n "[m$i]"; done)amix=inputs=$N:normalize=0:duration=longest,
apad=whole_dur=10,atrim=0:10,lowpass=f=900,lowpass=f=900,highpass=f=120,
aecho=0.8:0.6:45|90:0.35|0.2,asplit=2[x][y];
[x]atrim=0:8[corpo];[y]atrim=8:10,asetpts=PTS-STARTPTS[cauda];
[cauda][corpo]amix=inputs=2:normalize=0:duration=longest,atrim=0:8,
afade=t=in:d=0.6,volume=6dB,alimiter=limit=0.7
" -ac 2 -c:a libvorbis -q:a 6 "$SFX/murmurio_vagao.ogg"

echo "ok: sons sintetizados em $SFX e $MUS"
