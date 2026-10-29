# serie-studio

Produz e publica séries animadas 2D interativas (o público vota A ou B nos comentários).
Especificação completa: `PROMPT_CLAUDE_CODE.md`.

## Rodar

```bash
cp .env.example .env              # preencha DATABASE_URL (Postgres de 192.168.0.2)
npm ci
npx prisma migrate deploy
./scripts/instalar-dependencias.sh   # ffmpeg, whisper, edge-tts, Chrome do HyperFrames
npm test                          # schema e checagens do episódio
npm run render:hello              # prova de render: data/renders/hello.mp4 (1080×1920)
```

- HyperFrames fixo em `0.8.212` (devDependency); telemetria desligada com `HYPERFRAMES_NO_TELEMETRY=1`.
- GSAP e fontes (Anton, Inter 800/900) são copiados para cada projeto por `engine/vendor.ts`: o render não busca nada na rede.
- `docker-compose.yml` é opcional (máquinas com Docker). O servidor atual não tem Docker.
