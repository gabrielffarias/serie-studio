// Renderiza planos de um episódio (padrão: o demo do motor) e mede o tempo.
// Uso: npm run render:plano -- [arquivo.json] [p02 p03…]   (sem ids = episódio inteiro)
// RENDER_QUALIDADE=draft|looks|delivery (padrão draft), RENDER_WORKERS (padrão 2).
// Saída: data/renders/<no>[-<ids>].mp4 e um quadro por plano em data/stills/.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { montarProjeto } from "../engine/compose/projeto";
import { QUALIDADE, RAIZ, renderizar, rodar, WORKERS } from "../engine/render";
import { validarEpisodio } from "../src/lib/episodio-schema";
import { lerEstado } from "../src/lib/estado";
import { falantesDe, lerVozes } from "../src/lib/vozes";

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

  // itens do estado antes do episódio (o demo do motor usa a lanterna de cabeça)
  const demo = path.resolve(arquivo) === path.join(RAIZ, "engine/compose/fixtures/demo.json");
  const estado = demo ? undefined : lerEstado(ep.serie);
  const itens = estado?.itens ?? ["lanterna_cabeca"];
  const luzAmbiente = estado?.luz_ambiente ?? { vagao: "emergencia_vermelha", tunel: "escuro", plataforma_1959: "escuro", porta_1959: "escuro" };
  const falantes = falantesDe(lerVozes(ep.serie));
  const proj = montarProjeto(ep, dir, { itens, luzAmbiente, falantes, apenas });
  console.log(`▶ itens do estado: ${itens.join(", ") || "nenhum"}`);
  for (const a of proj.avisos) console.log(`⚠️  ${a}`);
  console.log(`▶ projeto ${path.relative(RAIZ, dir)}: ${proj.planos.map((p) => `${p.id} ${p.dur}s`).join(", ")} = ${proj.duracao}s`);

  const seg = await renderizar(dir, saida);
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
  console.log(`⏱  render: ${seg.toFixed(1)}s para ${proj.duracao}s de vídeo (${(seg / proj.duracao).toFixed(2)}× tempo real, ${WORKERS} workers, qualidade ${QUALIDADE})`);
  console.log(`📼 ${path.relative(RAIZ, saida)} (${(statSync(saida).size / 1024).toFixed(0)} KB)`);
  for (const s of stills) console.log(`🖼  ${path.relative(RAIZ, s)}`);
  if (checagens.some((c) => !c.ok)) process.exit(1);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
