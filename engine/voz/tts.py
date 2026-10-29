#!/usr/bin/env python3
"""Sintetiza uma fala e devolve os tempos das palavras (chamado por engine/voz/provedores.ts).

Uso: tts.py edge   <saida.wav> <texto> <voz> <rate> <pitch>
     tts.py kokoro <saida.wav> <texto> <voz> <speed> <dir_modelo>
Saída (stdout, JSON): {"duracao": s, "palavras": [{"texto", "ini", "fim"}] | null}
O WAV sai em 48 kHz mono. Erro: código != 0 e a mensagem no stderr.
"""
import asyncio
import json
import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.pydeps"))


def para_wav(origem, saida):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", origem, "-ac", "1", "-ar", "48000", saida], check=True)
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", saida]))


async def edge(saida, texto, voz, rate, pitch):
    import edge_tts

    palavras, audio = [], bytearray()
    com = edge_tts.Communicate(texto, voz, rate=rate, pitch=pitch, boundary="WordBoundary")
    async for m in com.stream():
        if m["type"] == "audio":
            audio += m["data"]
        elif m["type"] == "WordBoundary":
            ini = m["offset"] / 1e7  # unidades de 100 ns
            palavras.append({"texto": m["text"], "ini": round(ini, 3), "fim": round(ini + m["duration"] / 1e7, 3)})
    if not audio:
        raise RuntimeError("edge-tts não devolveu áudio")
    with tempfile.NamedTemporaryFile(suffix=".mp3") as f:
        f.write(audio)
        f.flush()
        duracao = para_wav(f.name, saida)
    return {"duracao": round(duracao, 3), "palavras": palavras or None}


def kokoro(saida, texto, voz, speed, modelo):
    import soundfile as sf
    from kokoro_onnx import Kokoro

    k = Kokoro(os.path.join(modelo, "kokoro-v1.0.onnx"), os.path.join(modelo, "voices-v1.0.bin"))
    amostras, sr = k.create(texto, voice=voz, speed=float(speed), lang="pt-br")
    with tempfile.NamedTemporaryFile(suffix=".wav") as f:
        sf.write(f.name, amostras, sr)
        duracao = para_wav(f.name, saida)
    # o Kokoro não dá tempo por palavra: quem chama estima pelas sílabas
    return {"duracao": round(duracao, 3), "palavras": None}


def main():
    prov, saida, texto, *resto = sys.argv[1:]
    if prov == "edge":
        r = asyncio.run(edge(saida, texto, *resto))
    elif prov == "kokoro":
        r = kokoro(saida, texto, *resto)
    else:
        raise SystemExit(f"provedor desconhecido: {prov}")
    print(json.dumps(r, ensure_ascii=False))


if __name__ == "__main__":
    main()
