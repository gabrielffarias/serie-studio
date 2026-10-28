// Renderiza planos de um episódio (padrão: o demo do motor) e mede o tempo.
// Uso: npm run render:plano -- [arquivo.json] [p02 p03…]   (sem ids = episódio inteiro)
// Saída: data/renders/<no>[-<ids>].mp4 e um quadro por plano em data/stills/.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { montarProjeto } from "../engine/compose/projeto";
import { validarEpisodio } from "../src/lib/episodio-schema";

const RAIZ = path.resolve(import.meta.dirname, "..");
const HF = path.join(RAIZ, "node_modules/.bin/hyperframes");
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1" };

function rodar(cmd: string, args: string[], cwd = RAIZ, eco = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let saida = "";
    p.stdout.on("data", (d) => { saida += d; if (eco) process.stdout.write(d); });
    p.stderr.on("data", (d) => { saida += d; if (eco) process.stderr.write(d); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(saida) : reject(new Error(`${path.basename(cmd)} ${args[0]} saiu com código ${code}`))));
  });
}

async function main() {
  const args = process.argv.slice(2);
  const arquivo = args[0]?.endsWith(".json") ? args.shift()! : path.join(RAIZ, "engine/compose/fixtures/demo.json");
  const v = validarEpisodio(JSON.parse(readFileSync(arquivo, "utf8")));
  if (!v.ok) throw new Error(`episódio inválido:\n${v.erros.join("\n")}`);
  const ep = v.episodio;
  const apenas = args.length ? args : undefined;
  const nome = apenas ? `${ep.no}-${apenas.join("-")}` : ep.no;
  const dir = path.join(RAIZ, `data/projetos/${nome}`);
  const saida = path.join(RAIZ, `data/renders/${nome}.mp4`);
  mkdirSync(path.dirname(saida), { recursive: true });
  mkdirSync(path.join(RAIZ, "data/stills"), { recursive: true });
  rmSync(saida, { force: true });

  const proj = montarProjeto(ep, dir, { itens: ["lanterna_cabeca"], apenas });
  console.log(`▶ projeto ${path.relative(RAIZ, dir)}: ${proj.planos.map((p) => `${p.id} ${p.dur}s`).join(", ")} = ${proj.duracao}s`);

  await rodar(HF, ["lint"], dir);
  const t0 = Date.now();
  await rodar(HF, ["render", "--quality", "draft", "--workers", process.env.RENDER_WORKERS ?? "2", "--output", saida], dir);
  const seg = (Date.now() - t0) / 1000;
  if (!existsSync(saida) || statSync(saida).size === 0) throw new Error("MP4 não foi gerado");

  const probe = JSON.parse(await rodar("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate:format=duration", "-of", "json", saida], RAIZ, false));
  const { width, height, r_frame_rate } = probe.streams[0];
  const duracao = Number(probe.format.duration);
  const stills: string[] = [];
  for (const p of proj.planos) {
    const png = path.join(RAIZ, `data/stills/${nome}-${p.id}.png`);
    await rodar("ffmpeg", ["-y", "-v", "error", "-ss", String(p.ini + p.dur * 0.7), "-i", saida, "-frames:v", "1", png], RAIZ, false);
    stills.push(png);
  }
  const checagens = [
    { ok: width === 1080 && height === 1920, msg: `resolução ${width}×${height}` },
    { ok: r_frame_rate === "30/1", msg: `fps ${r_frame_rate}` },
    { ok: Math.abs(duracao - proj.duracao) < 0.1, msg: `duração ${duracao.toFixed(2)}s (planejado ${proj.duracao}s)` },
  ];
  console.log("\n— resultado —");
  for (const c of checagens) console.log(`${c.ok ? "✅" : "❌"} ${c.msg}`);
  console.log(`⏱  render: ${seg.toFixed(1)}s para ${proj.duracao}s de vídeo (${(seg / proj.duracao).toFixed(2)}× tempo real, ${process.env.RENDER_WORKERS ?? "2"} workers)`);
  console.log(`📼 ${path.relative(RAIZ, saida)} (${(statSync(saida).size / 1024).toFixed(0)} KB)`);
  for (const s of stills) console.log(`🖼  ${path.relative(RAIZ, s)}`);
  if (checagens.some((c) => !c.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
