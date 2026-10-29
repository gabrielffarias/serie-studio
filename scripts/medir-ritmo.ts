// Mede o ritmo real de cada voz (sílabas por segundo, pausa na pontuação e
// silêncio antes da primeira palavra) nas falas já sintetizadas com tempo por
// palavra (data/voz/<no>/falas.json + cache) e grava em `ritmo` no vozes.json.
// As checagens do roteiro estimam a duração com isso.
// Uso: npm run vozes:ritmo -- <serie>   (rodar de novo depois de trocar uma voz)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { silabas } from "../engine/hud/legenda";
import { DIR_CACHE, type PalavraFalada } from "../engine/voz/provedores";
import { caminhoVozes, lerVozes } from "../src/lib/vozes";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PONTUACAO = /[.,;:!?…]$/;
/** abaixo disso a média de pausa da voz é ruído: usa a de todas as vozes */
const MIN_PAUSAS = 3;

type Registro = { papel: string; tts: string; hash: string; provedor: string; voz: string; ajustes: string };
type Soma = { silabas: number; fala: number; pausas: number[]; inicios: number[]; trechos: number };

const serie = process.argv[2];
if (!serie) throw new Error("uso: npm run vozes:ritmo -- <serie>");
const vozes = lerVozes(serie);
if (!vozes) throw new Error(`series/${serie}/vozes.json não existe`);

const dirVoz = path.join(RAIZ, "data/voz");
const somas: Record<string, Soma> = {};
const vistos = new Set<string>();
for (const no of readdirSync(dirVoz)) {
  const arq = path.join(dirVoz, no, "falas.json");
  if (!existsSync(arq)) continue;
  for (const r of JSON.parse(readFileSync(arq, "utf8")).falas as Registro[]) {
    const cfg = r.papel === "narrador" ? vozes.narrador : vozes.personagens[r.papel];
    // só a voz e os ajustes atuais do edge contam (fala antiga com outra voz fica de fora)
    if (!cfg || r.provedor !== "edge" || r.voz !== cfg.edge.voz || r.ajustes !== `rate ${cfg.edge.rate} pitch ${cfg.edge.pitch}`) continue;
    if (vistos.has(r.hash) || !existsSync(path.join(DIR_CACHE, `${r.hash}.json`))) continue;
    vistos.add(r.hash);
    const ps = (JSON.parse(readFileSync(path.join(DIR_CACHE, `${r.hash}.json`), "utf8")).palavras ?? []) as PalavraFalada[];
    if (!ps.length) continue;
    const toks = r.tts.split(/\s+/).filter(Boolean);
    const s = (somas[r.papel] ??= { silabas: 0, fala: 0, pausas: [], inicios: [], trechos: 0 });
    let pausa = 0;
    for (let i = 0; i < ps.length - 1; i++) {
      if (!PONTUACAO.test(toks[i] ?? ps[i].texto)) continue;
      const g = ps[i + 1].ini - ps[i].fim;
      s.pausas.push(g);
      pausa += g;
    }
    s.silabas += toks.reduce((n, t) => n + silabas(t), 0);
    s.fala += ps.at(-1)!.fim - ps[0].ini - pausa;
    s.inicios.push(ps[0].ini);
    s.trechos++;
  }
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const r2 = (n: number) => Math.round(n * 100) / 100;
const todasPausas = Object.values(somas).flatMap((s) => s.pausas);
const bruto = JSON.parse(readFileSync(caminhoVozes(serie), "utf8"));
for (const papel of ["narrador", ...Object.keys(vozes.personagens)]) {
  const s = somas[papel];
  const alvo = papel === "narrador" ? bruto.narrador : bruto.personagens[papel];
  if (!s) {
    console.log(`⚠️  ${papel}: nenhuma fala com a voz atual; ritmo não medido`);
    continue;
  }
  const pausas = s.pausas.length >= MIN_PAUSAS ? s.pausas : todasPausas;
  alvo.ritmo = { silabas_por_s: r2(s.silabas / s.fala), pausa_s: r2(media(pausas)), inicio_s: r2(media(s.inicios)), trechos: s.trechos };
  console.log(`${papel.padEnd(9)} ${alvo.ritmo.silabas_por_s} sílabas/s · pausa ${alvo.ritmo.pausa_s} s${pausas === todasPausas ? " (média geral)" : ""} · início ${alvo.ritmo.inicio_s} s · ${s.trechos} trechos`);
}
bruto.nota_ritmo =
  "ritmo: medido por scripts/medir-ritmo.ts nas falas sintetizadas (edge, voz e ajustes atuais). silabas_por_s conta só o tempo falando; pausa_s é o silêncio depois de vírgula/ponto dentro do trecho; inicio_s, o silêncio antes da primeira palavra. As checagens do roteiro estimam a duração com isso.";
writeFileSync(caminhoVozes(serie), JSON.stringify(bruto, null, 2) + "\n");
console.log(`📝 ${path.relative(RAIZ, caminhoVozes(serie))}`);
