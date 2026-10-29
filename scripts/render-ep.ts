// Episódio completo com voz: TTS (com fallback e cache) → tempos (planos
// esticam para a voz caber; legenda com o tempo real das palavras) → render
// do vídeo → mixagem (voz, efeitos, drone com ducking, -14 LUFS) → MP4 → QA.
// Com "falas": "tela" no vozes.json (narrador único), a fala do personagem não
// tem voz: aparece só na legenda, com a etiqueta do nome, no tempo de leitura.
// Uso: npm run render:ep -- series/<serie>/episodios/epNN.json [--narrador <voz edge>[,<voz kokoro>] --sufixo B]
//   --narrador troca a voz da narradora só neste render, sem ajuste de rate/pitch (versões para comparar)
// Saídas: data/renders/<no><sufixo>.mp4, data/renders/<no><sufixo>-qa.json, data/voz/<no><sufixo>/falas.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { lerSons, mixar, planejarSfx, DIR_AUDIO } from "../engine/audio/mix";
import { montarProjeto } from "../engine/compose/projeto";
import type { TempoPalavra } from "../engine/hud/legenda";
import { avaliarQa, medirAudioVideo, ouvir } from "../engine/qa/qa";
import { QUALIDADE, RAIZ, renderizar, rodar, WORKERS } from "../engine/render";
import { provedores, sintetizarComFallback, type PalavraFalada } from "../engine/voz/provedores";
import { alinharLegenda, deslocar, estimarPalavras, falaNaTela, fimFalado, posicionarFalas, type FalasDoPlano } from "../engine/voz/tempos";
import { validarEpisodio, type Episodio } from "../src/lib/episodio-schema";
import { lerEstado } from "../src/lib/estado";
import { percorrerLuz } from "../src/lib/luz";
import { falantesDe, falasComVoz, lerVozes, type Vozes } from "../src/lib/vozes";

type Trecho = { plano: string; tipo: "narracao" | "fala"; papel: string; tts: string; legenda: string };
type RegistroFala = Trecho & {
  provedor: string;
  voz: string;
  ajustes: string;
  hash: string;
  cache: boolean;
  duracao: number;
  tempos_palavras: "provedor" | "estimados";
  falhas: string[];
  em?: number;
};

const seg = (t0: number) => ((Date.now() - t0) / 1000).toFixed(1);

const opcao = (nome: string) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

/** --narrador <edge>[,<kokoro>]: outra voz para a narradora, sem ajuste de rate/pitch */
function trocarNarrador(v: Vozes, spec: string): Vozes {
  const [edge, kokoro] = spec.split(",");
  return {
    ...v,
    narrador: {
      ...v.narrador,
      edge: { voz: edge, rate: "+0%", pitch: "+0Hz" },
      kokoro: kokoro ? { voz: kokoro, speed: v.narrador.kokoro?.speed ?? 1 } : v.narrador.kokoro,
      ritmo: undefined,
    },
  };
}

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) throw new Error("uso: npm run render:ep -- series/<serie>/episodios/epNN.json [--narrador <voz edge>[,<voz kokoro>] --sufixo B]");
  const v = validarEpisodio(JSON.parse(readFileSync(arquivo, "utf8")));
  if (!v.ok) throw new Error(`episódio inválido:\n${v.erros.join("\n")}`);
  const ep = v.episodio;
  const lidas = lerVozes(ep.serie);
  if (!lidas) throw new Error(`series/${ep.serie}/vozes.json não existe`);
  const narrador = opcao("narrador");
  const vozes = narrador ? trocarNarrador(lidas, narrador) : lidas;
  const tag = `${ep.no}${opcao("sufixo") ?? ""}`;
  const comVoz = falasComVoz(vozes);
  console.log(`🎙  narradora: ${vozes.narrador.edge.voz} (rate ${vozes.narrador.edge.rate}, pitch ${vozes.narrador.edge.pitch}); falas de personagem: ${comVoz ? "com voz" : "só na tela"}`);
  const estado = lerEstado(ep.serie);
  const tInicio = Date.now();

  // 1. voz
  const dirVoz = path.join(RAIZ, `data/voz/${tag}`);
  rmSync(dirVoz, { recursive: true, force: true });
  mkdirSync(dirVoz, { recursive: true });
  const lista = provedores(vozes);
  const primeiro = lista.find((p) => p.disponivel())?.id;
  const trechos: Trecho[] = ep.planos.flatMap((p) => [
    ...(p.narracao ? [{ plano: p.id, tipo: "narracao" as const, papel: "narrador", tts: p.narracao.tts, legenda: p.narracao.legenda }] : []),
    ...(p.fala && comVoz ? [{ plano: p.id, tipo: "fala" as const, papel: p.fala.personagem, tts: p.fala.tts, legenda: p.fala.legenda }] : []),
  ]);
  const t0 = Date.now();
  const registros: RegistroFala[] = [];
  const palavras: Record<string, PalavraFalada[]> = {};
  const falas: Record<string, FalasDoPlano> = {};
  for (const t of trechos) {
    const s = await sintetizarComFallback({ texto: t.tts, papel: t.papel }, lista, path.join(dirVoz, `${t.plano}-${t.tipo}.wav`));
    const ps = s.palavras ?? estimarPalavras(t.tts, s.duracao);
    palavras[`${t.plano}-${t.tipo}`] = ps;
    (falas[t.plano] ??= {})[t.tipo] = { duracao: s.duracao, palavras: ps };
    registros.push({ ...t, provedor: s.provedor, voz: s.voz, ajustes: s.ajustes, hash: s.hash, cache: s.cache, duracao: s.duracao, tempos_palavras: s.palavras ? "provedor" : "estimados", falhas: s.falhas });
    console.log(`🎙  ${t.plano} ${t.tipo.padEnd(8)} ${s.provedor}${s.cache ? " (cache)" : ""} ${s.duracao.toFixed(2)}s  ${t.tts}`);
  }
  if (!comVoz)
    for (const p of ep.planos)
      if (p.fala) {
        const a = falaNaTela(p.fala.tts);
        palavras[`${p.id}-fala`] = a.palavras;
        (falas[p.id] ??= {}).fala = a;
        console.log(`💬 ${p.id} na tela   ${a.duracao.toFixed(2)}s  ${p.fala.personagem}: ${p.fala.legenda}`);
      }
  console.log(`⏱  voz: ${seg(t0)}s`);

  // 2. tempos
  const planosVoz = posicionarFalas(ep.planos, falas);
  const epVoz: Episodio = { ...ep, planos: ep.planos.map((p, i) => ({ ...p, duracao_s: planosVoz[i].dur })) as Episodio["planos"] };
  const legenda: Record<string, TempoPalavra[]> = {};
  const faladas: PalavraFalada[] = [];
  for (const pv of planosVoz) {
    const p = ep.planos.find((x) => x.id === pv.id)!;
    const out: TempoPalavra[] = [];
    if (p.narracao && pv.narracaoEm !== undefined) {
      const ws = deslocar(palavras[`${p.id}-narracao`], pv.narracaoEm);
      faladas.push(...ws);
      out.push(...alinharLegenda(p.narracao.legenda, ws));
      registros.find((r) => r.plano === p.id && r.tipo === "narracao")!.em = pv.narracaoEm;
    }
    if (p.fala && pv.falaEm !== undefined) {
      const ws = deslocar(palavras[`${p.id}-fala`], pv.falaEm);
      out.push(...alinharLegenda(p.fala.legenda, ws, p.fala.personagem));
      // só na tela: não entra no sync (o Whisper não ouve) nem na mixagem
      if (comVoz) {
        faladas.push(...ws);
        registros.find((r) => r.plano === p.id && r.tipo === "fala")!.em = pv.falaEm;
      }
    }
    if (out.length) legenda[p.id] = out;
  }
  const duracao = Math.round(planosVoz.reduce((s, p) => s + p.dur, 0) * 1000) / 1000;
  const esticados = planosVoz.filter((p) => p.esticou).map((p) => `${p.id} ${ep.planos.find((x) => x.id === p.id)!.duracao_s}→${p.dur}s`);
  console.log(`▶ duração com voz ${duracao}s${esticados.length ? `; esticaram: ${esticados.join(", ")}` : ""}`);
  writeFileSync(path.join(dirVoz, "falas.json"), JSON.stringify({ episodio: ep.no, narrador: vozes.narrador.edge, falas_personagem: comVoz ? "voz" : "tela", ordem: lista.map((p) => p.id), gerado_em: new Date().toISOString(), falas: registros }, null, 2));

  // 3. vídeo (sem som)
  const dirProj = path.join(RAIZ, `data/projetos/${tag}`);
  const video = path.join(RAIZ, `data/renders/${tag}-video.mp4`);
  const final = path.join(RAIZ, `data/renders/${tag}.mp4`);
  mkdirSync(path.dirname(final), { recursive: true });
  rmSync(video, { force: true });
  const proj = montarProjeto(epVoz, dirProj, { itens: estado.itens, luzAmbiente: estado.luz_ambiente, falantes: falantesDe(vozes), palavras: legenda });
  for (const a of proj.avisos) console.log(`⚠️  ${a}`);
  const tRender = await renderizar(dirProj, video);
  if (!existsSync(video) || statSync(video).size === 0) throw new Error("MP4 do vídeo não foi gerado");

  // 4. mixagem
  const t1 = Date.now();
  const sons = lerSons();
  const durArquivo = (a: string) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(DIR_AUDIO, a)]).toString());
  const luzes = Object.fromEntries(percorrerLuz(ep.planos, estado.luz_ambiente).planos.map((l) => [l.id, l]));
  const { colocados, silencios, semArquivo } = planejarSfx(
    planosVoz.map((pv) => {
      const p = ep.planos.find((x) => x.id === pv.id)!;
      return { id: pv.id, ini: pv.ini, dur: pv.dur, som: p.tipo === "cena" ? (p.som ?? []) : [], eventoLuz: !!luzes[pv.id]?.evento };
    }),
    sons,
    durArquivo,
  );
  const wav = path.join(dirVoz, "master.wav");
  const musica = Object.values(sons.musica)[0]?.arquivo;
  await mixar({ duracao, vozes: registros.map((r) => ({
        wav: path.join(dirVoz, `${r.plano}-${r.tipo}.wav`),
        t: r.em!,
        fim: r.em! + fimFalado({ duracao: r.duracao, palavras: palavras[`${r.plano}-${r.tipo}`] }),
      })), sfx: colocados, musica, silencios }, wav);
  rmSync(final, { force: true });
  await rodar("ffmpeg", ["-v", "error", "-y", "-i", video, "-i", wav, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", String(duracao), final], RAIZ, false);
  console.log(`⏱  mixagem: ${seg(t1)}s (${colocados.length} efeitos${musica ? `, música ${musica}` : ""}${silencios.length ? `, silêncio em ${silencios.map((x) => `${x.ini}–${x.fim}s`).join(", ")}` : ""})`);

  // 5. QA
  const t2 = Date.now();
  const medidas = { ...(await medirAudioVideo(final)), ouvidas: await ouvir(final) };
  const fallback = registros.filter((r) => r.provedor !== primeiro).map((r) => `${r.plano} ${r.tipo} (${r.provedor})`);
  // apagão: o corte para quase preto é planejado (até LIMITES.escuroApagaoMaxS)
  const planosApagao = planosVoz.filter((pv) => luzes[pv.id]?.evento === "apagao").map((pv) => ({ id: pv.id, ini: pv.ini, fim: pv.ini + pv.dur }));
  const qa = avaliarQa(medidas, { faladas, ultimaFrase: ep.ultima_frase_falada, fallback, sonsSemArquivo: semArquivo, planosApagao });
  console.log(`⏱  QA: ${seg(t2)}s`);
  writeFileSync(
    path.join(RAIZ, `data/renders/${tag}-qa.json`),
    JSON.stringify({ episodio: ep.no, narrador: vozes.narrador.edge, falas_personagem: comVoz ? "voz" : "tela", mp4: path.relative(RAIZ, final), duracao, checagens: qa, medidas: { ...medidas, ouvidas: undefined }, ouvidas: medidas.ouvidas }, null, 2),
  );

  console.log("\n— QA —");
  for (const c of qa) console.log(`${c.ok ? "✅" : c.aviso ? "⚠️ " : "❌"} ${c.id}: ${c.mensagem}`);
  console.log(`⏱  render do vídeo: ${tRender.toFixed(1)}s para ${duracao}s (${(tRender / duracao).toFixed(2)}×, ${WORKERS} workers, ${QUALIDADE}); total ${seg(tInicio)}s`);
  console.log(`📼 ${path.relative(RAIZ, final)} (${(statSync(final).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`📝 data/renders/${tag}-qa.json · data/voz/${tag}/falas.json`);
  if (qa.some((c) => !c.ok && !c.aviso)) process.exit(1);
}

main().catch((e) => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
