#!/usr/bin/env bash
# Sons sintetizados no projeto (obra nossa, CC0; ver assets/audio/LICENCAS.md).
# Só ffmpeg, sem sample de fora. Rodar de novo regera os mesmos arquivos.
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

echo "ok: $SFX/zumbido_corta.ogg, $MUS/drone_suspense.ogg"
