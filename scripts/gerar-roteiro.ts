// Gera o roteiro de um nó pelo Claude CLI (MODO 2) e mostra as checagens.
// Uso: npm run roteiro -- ep01 [--comentario "o que corrigir"]
// Saída: data/roteiros/<no>-<data>.json (rascunho); as respostas cruas ficam ao lado.
// O roteiro só vai para series/<slug>/episodios/ depois de aprovado.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gerarCatalogo } from "../engine/catalogo";
import { cronogramaPistas, esqueleto } from "../src/lib/biblia";
import { CAMINHO_CATALOGO } from "../src/lib/catalogo";
import { chamarClaude, RAIZ_REPO } from "../src/lib/claude-cli";
import { lerEstado } from "../src/lib/estado";
import { lerVozes } from "../src/lib/vozes";
import { gerarRoteiro } from "../src/lib/gerar-roteiro";

const SERIE = process.env.SERIE ?? "estacao-fantasma";

async function main() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--comentario");
  const comentario = i >= 0 ? args.splice(i, 2)[1] : undefined;
  const biblia = readFileSync(path.join(RAIZ_REPO, `series/${SERIE}/biblia.md`), "utf8");
  const estado = lerEstado(SERIE);
  const alvo = args[0] ?? estado.proximo_no;
  const no = esqueleto(biblia).find((n) => n.no === alvo);
  if (!no) throw new Error(`nó ${alvo} não está no esqueleto da bíblia`);

  // catálogo sempre fresco (na Fase 3 ele vem do banco)
  const catalogo = gerarCatalogo();
  writeFileSync(CAMINHO_CATALOGO, JSON.stringify(catalogo, null, 2) + "\n");

  const dirEps = path.join(RAIZ_REPO, `series/${SERIE}/episodios`);
  const anteriores = readdirSync(dirEps).filter((f) => f.endsWith(".json")).sort().slice(-2).map((f) => `series/${SERIE}/episodios/${f}`);

  const carimbo = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const base = `data/roteiros/${no.no}-${carimbo}`;
  mkdirSync(path.join(RAIZ_REPO, "data/roteiros"), { recursive: true });
  const log = (l: string) => console.log(`[${new Date().toLocaleTimeString("pt-BR")}] ${l}`);

  const t0 = Date.now();
  const r = await gerarRoteiro(
    { serie: SERIE, no, estado, catalogo, vozes: lerVozes(SERIE), cronograma: cronogramaPistas(biblia), anteriores, comentario },
    {
      chamar: (p) => chamarClaude(p, { timeoutMs: Number(process.env.CLAUDE_ROTEIRO_TIMEOUT_MS) || 12 * 60 * 1000, onLog: log }),
      salvarTentativa: (n, bruto) => {
        const rel = `${base}-t${n}.txt`;
        writeFileSync(path.join(RAIZ_REPO, rel), bruto);
        return rel;
      },
      onLog: log,
    },
  );
  log(`total ${((Date.now() - t0) / 1000).toFixed(0)}s, ${r.tentativas} chamada(s)`);
  if (!r.ok) {
    console.error(`\n❌ roteiro inválido:\n${r.erros.map((e) => `  - ${e}`).join("\n")}`);
    process.exit(1);
  }
  writeFileSync(path.join(RAIZ_REPO, `${base}.json`), JSON.stringify(r.episodio, null, 2) + "\n");
  const total = r.episodio.planos.reduce((s, p) => s + p.duracao_s, 0);
  console.log(`\n📝 ${base}.json: "${r.episodio.titulo}", ${r.episodio.planos.length} planos, ${Math.round(total * 10) / 10}s`);
  for (const c of r.checagens) console.log(`${c.ok ? "✅" : c.aviso ? "⚠️ " : "❌"} ${c.id}: ${c.mensagem}`);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
