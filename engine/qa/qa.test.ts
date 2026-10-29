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
  });

  it("apagão: escuro planejado até 0,6 s dentro do plano com o evento", () => {
    const comApagao = { ...esperado, planosApagao: [{ id: "p02", ini: 6.2, fim: 11.7 }] };
    const c = avaliarQa({ ...medidas, pretos: [{ ini: 9.5, fim: 9.93 }] }, comApagao).find((x) => x.id === "telas_pretas")!;
    expect(c.ok).toBe(true);
    expect(c.mensagem).toMatch(/escuro planejado: 9\.5–9\.9 s \(apagão p02, 0\.43 s\)/);
    expect(falhas({ ...medidas, pretos: [{ ini: 9.5, fim: 10.2 }] }, comApagao)).toEqual(["telas_pretas"]);
    // fora do plano do apagão vale o limite normal
    expect(falhas({ ...medidas, pretos: [{ ini: 20, fim: 20.5 }] }, comApagao)).toEqual(["telas_pretas"]);
  });

  it("última frase cortada bloqueia (Whisper escreve vote-b, a comparação ignora pontuação)", () => {
    const ouvidas = ["ou", "vote-b", "para", "que", "fiquem", "trancados", "no", "vagão."].map((t, i) => w(t, i));
    expect(ultimaFraseCompleta(esperado.ultimaFrase, ouvidas)).toBe(1); // "vote-b" vira "vote b"
    expect(ultimaFraseCompleta(esperado.ultimaFrase, ouvidas.slice(0, -2))).toBeLessThan(0.9);
    expect(falhas({ ...medidas, ouvidas: medidas.ouvidas.slice(0, -3) })).toContain("ultima_frase");
  });

  it("sync: maior desvio por palavra acima de 150 ms bloqueia", () => {
    const ouvidas = medidas.ouvidas.map((x, i) => (i === 4 ? { ...x, ini: x.ini + 0.2 } : x));
    expect(desviosSync(faladas, ouvidas).desvios[4].desvio).toBeCloseTo(0.25);
    const c = avaliarQa({ ...medidas, ouvidas }, esperado).find((x) => x.id === "sync_legenda")!;
    expect(c.ok).toBe(false);
    expect(c.mensagem).toMatch(/máx\. 250 ms \("que"/);
  });

  it("primeira palavra depois de pausa mede o fim (o Whisper puxa o início para dentro do silêncio)", () => {
    const f = [w("nenhum", 47.76), w("Ele", 49.36), w("ajusta", 49.6)];
    const o = [w("nenhum", 47.8), { texto: "Ele", ini: 49.0, fim: 49.68 }, w("ajusta", 49.64)];
    expect(desviosSync(f, o).desvios.map((d) => [d.palavra, d.borda, d.desvio])).toEqual([
      ["nenhum", "fim", 0.04],
      ["Ele", "fim", 0.02],
      ["ajusta", "ini", 0.04],
    ]);
  });

  it("palavra sem confiança do Whisper fica fora do sync (caso real do EP1: \"ajusta\" em 49,6 s)", () => {
    // o Whisper deu 0,01 ao "Ele" e esticou "ajusta" por 2 s sobre o silêncio do corte p08→p09
    const f = [w("nenhum", 47.76), { texto: "Ele", ini: 49.36, fim: 49.6 }, { texto: "ajusta", ini: 49.6, fim: 50.41 }, w("os", 50.41)];
    const o = [
      { ...w("nenhum.", 47.8), prob: 0.98 },
      { texto: "Ele", ini: 48.12, fim: 48.36, prob: 0.01 },
      { texto: "ajusta", ini: 48.36, fim: 50.38, prob: 0.96 },
      { ...w("os", 50.38), prob: 0.98 },
    ];
    const { desvios, ignoradas } = desviosSync(f, o);
    expect(desvios.map((d) => d.palavra)).toEqual(["nenhum", "os"]);
    expect(ignoradas.map((x) => [x.palavra, x.motivo])).toEqual([
      ["Ele", "probabilidade 0.01"],
      ["ajusta", "duração 2.02 s ouvida × 0.81 s falada"],
    ]);
    const c = avaliarQa({ ...medidas, ouvidas: o }, { ...esperado, faladas: f }).find((x) => x.id === "sync_legenda")!;
    expect(c.ok).toBe(true);
    expect(c.mensagem).toMatch(/fora \(Whisper sem confiança\): "Ele" 48\.1 s/);
  });

  it("fallback e som sem arquivo são avisos", () => {
    const cs = avaliarQa(medidas, { ...esperado, fallback: ["p04 fala (kokoro)"], sonsSemArquivo: ["clique_rele"] });
    expect(cs.filter((c) => !c.ok).map((c) => [c.id, c.aviso])).toEqual([
      ["provedor_tts", true],
      ["sons_sem_arquivo", true],
    ]);
  });
});
