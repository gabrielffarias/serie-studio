import { describe, expect, it } from "vitest";
import { avaliarQa, desviosSync, ultimaFraseCompleta, type Esperado, type Medidas } from "./qa";

const w = (texto: string, ini: number) => ({ texto, ini, fim: ini + 0.3 });
const faladas = "Ou vote B para que fiquem trancados no vagão".split(" ").map((t, i) => w(t, 70 + i * 0.4));
const medidas: Medidas = { duracao: 80.2, lufs: -14.2, picoDbtp: -1.4, pretos: [], ouvidas: faladas.map((x) => ({ ...x, ini: x.ini + 0.05 })) };
const esperado: Esperado = { faladas, ultimaFrase: "Ou vote B para que fiquem trancados no vagão.", fallback: [], sonsSemArquivo: [] };
const falhas = (m: Medidas, e = esperado) => avaliarQa(m, e).filter((c) => !c.ok && !c.aviso).map((c) => c.id);

describe("QA", () => {
  it("tudo dentro: verde", () => {
    expect(falhas(medidas)).toEqual([]);
  });

  it("duração, loudness, pico e tela preta fora do limite bloqueiam", () => {
    expect(falhas({ ...medidas, duracao: 91 })).toEqual(["duracao"]);
    expect(falhas({ ...medidas, lufs: -16.2 })).toEqual(["loudness"]);
    expect(falhas({ ...medidas, picoDbtp: -0.6 })).toEqual(["pico"]);
    expect(falhas({ ...medidas, pretos: [{ ini: 3, fim: 3.2 }] })).toEqual([]);
    expect(falhas({ ...medidas, pretos: [{ ini: 3, fim: 3.5 }] })).toEqual(["telas_pretas"]);
    // o corte do apagão é escuro de propósito
    expect(falhas({ ...medidas, pretos: [{ ini: 3, fim: 3.5 }] }, { ...esperado, pretosEsperados: [{ ini: 2.9, fim: 3.7, motivo: "apagao p02" }] })).toEqual([]);
  });

  it("última frase cortada bloqueia (Whisper escreve vote-b, a comparação ignora pontuação)", () => {
    const ouvidas = ["ou", "vote-b", "para", "que", "fiquem", "trancados", "no", "vagão."].map((t, i) => w(t, i));
    expect(ultimaFraseCompleta(esperado.ultimaFrase, ouvidas)).toBe(1); // "vote-b" vira "vote b"
    expect(ultimaFraseCompleta(esperado.ultimaFrase, ouvidas.slice(0, -2))).toBeLessThan(0.9);
    expect(falhas({ ...medidas, ouvidas: medidas.ouvidas.slice(0, -3) })).toContain("ultima_frase");
  });

  it("sync: maior desvio por palavra acima de 150 ms bloqueia", () => {
    const ouvidas = medidas.ouvidas.map((x, i) => (i === 4 ? { ...x, ini: x.ini + 0.2 } : x));
    expect(desviosSync(faladas, ouvidas)[4].desvio).toBeCloseTo(0.25);
    const c = avaliarQa({ ...medidas, ouvidas }, esperado).find((x) => x.id === "sync_legenda")!;
    expect(c.ok).toBe(false);
    expect(c.mensagem).toMatch(/máx\. 250 ms \("que"/);
  });

  it("primeira palavra depois de pausa mede o fim (o Whisper puxa o início para dentro do silêncio)", () => {
    const f = [w("nenhum", 47.76), w("Ele", 49.36), w("ajusta", 49.6)];
    const o = [w("nenhum", 47.8), { texto: "Ele", ini: 48.12, fim: 49.68 }, w("ajusta", 49.64)];
    expect(desviosSync(f, o).map((d) => [d.palavra, d.borda, d.desvio])).toEqual([
      ["nenhum", "fim", 0.04],
      ["Ele", "fim", 0.02],
      ["ajusta", "ini", 0.04],
    ]);
  });

  it("fallback e som sem arquivo são avisos", () => {
    const cs = avaliarQa(medidas, { ...esperado, fallback: ["p04 fala (kokoro)"], sonsSemArquivo: ["clique_rele"] });
    expect(cs.filter((c) => !c.ok).map((c) => [c.id, c.aviso])).toEqual([
      ["provedor_tts", true],
      ["sons_sem_arquivo", true],
    ]);
  });
});
