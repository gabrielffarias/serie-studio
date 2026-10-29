import { describe, expect, it } from "vitest";
import { alinharLegenda, deslocar, ENTRE_FALAS_S, estimarPalavras, INICIO_VOZ_S, lcs, posicionarFalas } from "./tempos";

const audio = (duracao: number) => ({ duracao, palavras: [] });

describe("posicionarFalas", () => {
  it("narração em 0,2 s, fala depois do respiro; plano curto estica até a voz + folga (para cima, em 0,1 s)", () => {
    const r = posicionarFalas(
      [
        { id: "p01", duracao_s: 5 },
        { id: "p02", duracao_s: 4 },
        { id: "p03", duracao_s: 3 },
      ],
      { p01: { narracao: audio(3) }, p02: { narracao: audio(2), fala: audio(2.02) } },
    );
    expect(r[0]).toEqual({ id: "p01", ini: 0, dur: 5, narracaoEm: INICIO_VOZ_S, esticou: false });
    // 0,2 + 2 + 0,25 + 2,02 + 0,35 = 4,82 → 4,9
    expect(r[1]).toEqual({ id: "p02", ini: 5, dur: 4.9, narracaoEm: 5.2, falaEm: 5 + 0.2 + 2 + ENTRE_FALAS_S, esticou: true });
    // plano sem voz mantém a duração e começa depois do esticado
    expect(r[2]).toEqual({ id: "p03", ini: 9.9, dur: 3, esticou: false });
  });

  it("o silêncio no fim do arquivo não ocupa o plano (conta até a última palavra + 0,05 s)", () => {
    const narracao = { duracao: 3, palavras: [{ texto: "oi", ini: 0.1, fim: 2.6 }] };
    const [p] = posicionarFalas([{ id: "p01", duracao_s: 2 }], { p01: { narracao } });
    // 0,2 + 2,65 + 0,35 = 3,2
    expect(p).toMatchObject({ dur: 3.2, esticou: true });
  });

  it("voz que cabe exatamente não estica", () => {
    const [p] = posicionarFalas([{ id: "p01", duracao_s: 3 }], { p01: { narracao: audio(2.45) } });
    expect(p).toMatchObject({ dur: 3, esticou: false });
  });
});

describe("alinharLegenda", () => {
  const faladas = deslocar(
    [
      { texto: "Dezoito", ini: 0.1, fim: 0.5 },
      { texto: "e", ini: 0.5, fim: 0.6 },
      { texto: "quatro", ini: 0.6, fim: 1.0 },
      { texto: "Túnel", ini: 1.4, fim: 1.8 },
      { texto: "sentido", ini: 1.8, fim: 2.2 },
      { texto: "cento", ini: 2.2, fim: 2.5 },
      { texto: "e", ini: 2.5, fim: 2.6 },
      { texto: "oito", ini: 2.6, fim: 2.9 },
      { texto: "Sul", ini: 2.9, fim: 3.2 },
    ],
    10,
  );

  it("palavras iguais pegam o tempo real; números da legenda cobrem as palavras faladas por extenso", () => {
    const t = alinharLegenda("18:04. TÚNEL SENTIDO 108 SUL.", faladas);
    expect(t.map((w) => w.palavra)).toEqual(["18:04.", "TÚNEL", "SENTIDO", "108", "SUL."]);
    expect(t[1]).toMatchObject({ ini: 11.4, fim: 11.8 });
    expect(t[4]).toMatchObject({ ini: 12.9, fim: 13.2 });
    // "18:04." vai do começo da fala até "túnel"; "108" fica entre "sentido" e "sul"
    expect(t[0]).toMatchObject({ ini: 10.1, fim: 11.4 });
    expect(t[3]).toMatchObject({ ini: 12.2, fim: 12.9 });
  });

  it("legenda que resume a fala segue as âncoras e marca quem fala", () => {
    const f = deslocar(
      "Vote A para que saiam Ou vote B para que fiquem".split(" ").map((texto, i) => ({ texto, ini: i * 0.4, fim: i * 0.4 + 0.3 })),
      0,
    );
    const t = alinharLegenda("VOTE A OU B NOS COMENTÁRIOS", f, "narrador");
    expect(t.slice(0, 4).map((w) => w.ini)).toEqual([0, 0.4, 2, 2.8]);
    expect(t.at(-1)!.fim).toBeCloseTo(f.at(-1)!.fim);
    expect(t.every((w) => w.quem === "narrador")).toBe(true);
    for (let i = 1; i < t.length; i++) expect(t[i].ini).toBeGreaterThanOrEqual(t[i - 1].ini);
  });

  it("lcs ignora vazios", () => {
    expect(lcs(["a", "", "b"], ["a", "", "b"])).toEqual([
      [0, 0],
      [2, 2],
    ]);
  });
});

describe("estimarPalavras", () => {
  it("cabe no áudio, em ordem", () => {
    const p = estimarPalavras("Fale baixo, rapaz.", 1.6);
    expect(p.map((w) => w.texto)).toEqual(["Fale", "baixo,", "rapaz."]);
    expect(p[0].ini).toBeGreaterThan(0);
    expect(p.at(-1)!.fim).toBeLessThanOrEqual(1.6);
  });
});
