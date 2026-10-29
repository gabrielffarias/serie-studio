// Fase 0: prova que o HyperFrames renderiza um MP4 vertical 1080×1920 neste servidor
// e mede o tempo de render. Falha (exit 1) se qualquer checagem falhar.
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { copiarVendor } from "../engine/vendor";

const RAIZ = path.resolve(import.meta.dirname, "..");
const MODELO = path.join(RAIZ, "engine/hello");
const PROJETO = path.join(RAIZ, "data/projetos/hello");
const SAIDA = path.join(RAIZ, "data/renders/hello.mp4");
const STILL = path.join(RAIZ, "data/stills/hello.png");
const HF = path.join(RAIZ, "node_modules/.bin/hyperframes");
const DURACAO = 5;

const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1" };

function rodar(cmd: string, args: string[], cwd = RAIZ): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let saida = "";
    p.stdout.on("data", (d) => { saida += d; process.stdout.write(d); });
    p.stderr.on("data", (d) => { saida += d; process.stderr.write(d); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(saida) : reject(new Error(`${path.basename(cmd)} ${args[0]} saiu com código ${code}`))));
  });
}

async function main() {
  rmSync(PROJETO, { recursive: true, force: true });
  mkdirSync(PROJETO, { recursive: true });
  cpSync(MODELO, PROJETO, { recursive: true });
  copiarVendor(PROJETO);
  mkdirSync(path.dirname(SAIDA), { recursive: true });
  mkdirSync(path.dirname(STILL), { recursive: true });
  rmSync(SAIDA, { force: true });

  console.log("\n▶ hyperframes lint");
  await rodar(HF, ["lint"], PROJETO);

  console.log("\n▶ hyperframes render");
  const t0 = Date.now();
  await rodar(HF, ["render", "--quality", "draft", "--workers", process.env.RENDER_WORKERS ?? "2", "--output", SAIDA], PROJETO);
  const segundos = (Date.now() - t0) / 1000;

  if (!existsSync(SAIDA) || statSync(SAIDA).size === 0) throw new Error("MP4 não foi gerado");

  const probe = JSON.parse(
    await rodar("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", SAIDA]),
  );
  const { width, height, r_frame_rate } = probe.streams[0];
  const duracao = Number(probe.format.duration);

  await rodar("ffmpeg", ["-y", "-v", "error", "-ss", "2.5", "-i", SAIDA, "-frames:v", "1", STILL]);

  const checagens = [
    { ok: width === 1080 && height === 1920, msg: `resolução ${width}×${height}` },
    { ok: r_frame_rate === "30/1", msg: `fps ${r_frame_rate}` },
    { ok: Math.abs(duracao - DURACAO) < 0.1, msg: `duração ${duracao.toFixed(2)}s (esperado ${DURACAO}s)` },
  ];
  console.log("\n— resultado —");
  for (const c of checagens) console.log(`${c.ok ? "✅" : "❌"} ${c.msg}`);
  console.log(`⏱  render: ${segundos.toFixed(1)}s para ${DURACAO}s de vídeo (${(segundos / DURACAO).toFixed(2)}× tempo real)`);
  console.log(`📼 ${path.relative(RAIZ, SAIDA)} (${(statSync(SAIDA).size / 1024).toFixed(0)} KB)`);
  console.log(`🖼  ${path.relative(RAIZ, STILL)}`);
  if (checagens.some((c) => !c.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
