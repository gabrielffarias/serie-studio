// Chamada ao Claude Code CLI local (padrão do cortes_tiktok): `claude -p
// "<prompt>" --allowedTools Read`, stdin fechado, cwd na raiz do repo para a
// skill serie-interativa carregar. Sem API externa.
import { spawn } from "node:child_process";
import path from "node:path";

export const CLAUDE_BIN = process.env.CLAUDE_PATH || "claude";
export const RAIZ_REPO = path.resolve(import.meta.dirname, "../..");

export type OpcoesClaude = {
  cwd?: string;
  timeoutMs?: number;
  allowedTools?: string[];
  onLog?: (linha: string) => void;
};

/**
 * Roda o CLI e devolve o stdout. Os argumentos vão como lista (sem shell),
 * então o prompt não precisa de aspas. No timeout, mata só o processo que
 * este código iniciou.
 */
export function chamarClaude(prompt: string, op: OpcoesClaude = {}): Promise<string> {
  const timeoutMs = op.timeoutMs ?? 12 * 60 * 1000;
  const args = ["-p", prompt, "--allowedTools", ...(op.allowedTools ?? ["Read"])];
  if (process.env.CLAUDE_MODEL) args.push("--model", process.env.CLAUDE_MODEL);
  // dentro de uma sessão do Claude Code (desenvolvimento), o CLI filho não deve se achar aninhado
  const env = { ...process.env };
  delete env.CLAUDECODE;
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const p = spawn(CLAUDE_BIN, args, { cwd: op.cwd ?? RAIZ_REPO, env, stdio: ["ignore", "pipe", "pipe"] });
    let saida = "";
    let erro = "";
    const timer = setTimeout(() => {
      op.onLog?.(`claude: timeout de ${Math.round(timeoutMs / 1000)}s, encerrando o processo ${p.pid}`);
      p.kill("SIGTERM");
    }, timeoutMs);
    p.stdout.on("data", (d) => (saida += d));
    p.stderr.on("data", (d) => (erro += d));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`não consegui rodar ${CLAUDE_BIN}: ${e.message}`));
    });
    p.on("close", (code, sinal) => {
      clearTimeout(timer);
      const seg = ((Date.now() - inicio) / 1000).toFixed(0);
      if (code === 0) {
        op.onLog?.(`claude: respondeu em ${seg}s (${saida.length} caracteres)`);
        resolve(saida);
      } else {
        reject(new Error(`claude saiu com ${sinal ?? `código ${code}`} em ${seg}s: ${erro.trim().slice(-500) || saida.trim().slice(-500)}`));
      }
    });
  });
}

/**
 * O `-p` pode trazer texto em volta do JSON. Tenta, nesta ordem: a resposta
 * inteira, um bloco ```json```, e do primeiro `{`/`[` ao último `}`/`]`.
 */
export function extrairJson(bruto: string): unknown {
  const s = bruto.trim();
  const tentativas: string[] = [s];
  const cerca = s.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (cerca) tentativas.push(cerca[1]);
  const ini = s.search(/[[{]/);
  const fim = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (ini >= 0 && fim > ini) tentativas.push(s.slice(ini, fim + 1));
  for (const t of tentativas) {
    try {
      return JSON.parse(t);
    } catch {
      // próxima
    }
  }
  throw new Error(ini < 0 ? "nenhum JSON na resposta do Claude" : "JSON malformado na resposta do Claude");
}
