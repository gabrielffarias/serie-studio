#!/usr/bin/env bash
# Reinstala as dependências de sistema do serie-studio (mesmo esquema do
# cortes_tiktok). Tudo que vem de apt/pip mora na camada do container e some
# quando o container do code-server é recriado (só /config e /workspace
# persistem).
#
# Chamado pelo scripts/servidor.sh quando falta alguma coisa (Fase 3);
# pode rodar na mão também. Idempotente.
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive
export HOME=/config
export HYPERFRAMES_NO_TELEMETRY=1

DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-/config/.nvm/versions/node/v24.20.0/bin}"
export PATH="$DIR/node_modules/.bin:$NODE_BIN:$PATH"

echo "$(date -Is) instalando dependências de sistema"

# ffmpeg + libs do Chrome headless (render do HyperFrames)
apt-get update
apt-get install -y --no-install-recommends \
  ffmpeg python3 python3-pip \
  libnss3 libnspr4 libdbus-1-3 libatk1.0-0t64 libatk-bridge2.0-0t64 libgbm1 libasound2t64 \
  libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 \
  libcups2t64 fonts-liberation fonts-noto-color-emoji

# Node 22+ (o HyperFrames exige)
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node $NODE_MAJOR encontrado; o HyperFrames precisa de 22+ (instale via nvm)" >&2
  exit 1
fi

# Whisper (verificação da voz e tempo por palavra, Fase 2). Torch só de CPU.
if ! command -v whisper >/dev/null; then
  pip install --break-system-packages --index-url https://download.pytorch.org/whl/cpu torch
  pip install --break-system-packages -U openai-whisper
fi

# edge-tts (voz padrão, Fase 2)
if ! command -v edge-tts >/dev/null; then
  pip install --break-system-packages -U edge-tts
fi

# HyperFrames fixo no package.json + o Chrome Headless Shell dele
cd "$DIR"
[ -x node_modules/.bin/hyperframes ] || npm ci
hyperframes browser ensure

echo "$(date -Is) dependências instaladas"
