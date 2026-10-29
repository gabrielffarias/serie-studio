// Execução de processos e render HyperFrames compartilhados pelos scripts de render.
import { spawn } from "node:child_process";
import path from "node:path";

export const RAIZ = path.resolve(import.meta.dirname, "..");
export const HF = path.join(RAIZ, "node_modules/.bin/hyperframes");
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", HYPERFRAMES_SKIP_SKILLS: "1" };
export const QUALIDADE = process.env.RENDER_QUALIDADE ?? "draft";
export const WORKERS = process.env.RENDER_WORKERS ?? "2";

export function rodar(cmd: string, args: string[], cwd = RAIZ, eco = true): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let saida = "";
    p.stdout.on("data", (d) => { saida += d; if (eco) process.stdout.write(d); });
    p.stderr.on("data", (d) => { saida += d; if (eco) process.stderr.write(d); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(saida) : reject(new Error(`${path.basename(cmd)} ${args[0]} saiu com código ${code}`))));
  });
}

/** lint + render do projeto HyperFrames; devolve os segundos gastos no render */
export async function renderizar(dir: string, saida: string): Promise<number> {
  await rodar(HF, ["lint"], dir);
  const t0 = Date.now();
  await rodar(HF, ["render", "--quality", QUALIDADE, "--workers", WORKERS, "--output", saida], dir);
  return (Date.now() - t0) / 1000;
}
