import { describe, expect, it } from "vitest";
import { instanteEventoLuz } from "../compose/plano";
import { grafoMix, planejarSfx, GANHO_SFX_DB, type Sons } from "./mix";

const sons: Sons = {
  sfx: {
    estalo_seco: { arquivos: ["sfx/e1.ogg", "sfx/e2.ogg", "sfx/e3.ogg"] },
    zumbido_corta: { arquivos: ["sfx/z.ogg"] },
    passos_leves: { arquivos: ["sfx/p.ogg"], ganho_db: -8 },
  },
  musica: { drone: { arquivo: "musica/d.ogg", loop: true } },
};
const dur = (a: string) => (a.endsWith("z.ogg") ? 2.6 : 0.3);

describe("planejarSfx", () => {
  it("estalos em rodízio pelo episódio inteiro, sem repetir o mesmo seguido", () => {
    const { colocados } = planejarSfx(
      [
        { id: "p12", ini: 0, dur: 4.5, som: ["estalo_seco", "estalo_seco"], eventoLuz: false },
        { id: "p13", ini: 4.5, dur: 4.5, som: ["estalo_seco", "estalo_seco", "estalo_seco"], eventoLuz: false },
        { id: "p14", ini: 9, dur: 6, som: ["estalo_seco"], eventoLuz: false },
      ],
      sons,
      dur,
    );
    const arqs = colocados.map((c) => c.arquivo);
    expect(arqs).toEqual(["sfx/e1.ogg", "sfx/e2.ogg", "sfx/e3.ogg", "sfx/e1.ogg", "sfx/e2.ogg", "sfx/e3.ogg"]);
    for (let i = 1; i < arqs.length; i++) expect(arqs[i]).not.toBe(arqs[i - 1]);
    // espalhados dentro do plano, em ordem
    const ts = colocados.map((c) => c.t);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
  });

  it("zumbido do apagão termina no corte da luz; ganho do som somado ao dos efeitos; id sem arquivo vira aviso", () => {
    const { colocados, semArquivo } = planejarSfx(
      [
        { id: "p02", ini: 5, dur: 5, som: ["zumbido_corta", "clique_rele"], eventoLuz: true },
        { id: "p07", ini: 10, dur: 4, som: ["passos_leves"], eventoLuz: false },
      ],
      sons,
      dur,
    );
    expect(colocados[0].t + 2.6).toBeCloseTo(5 + instanteEventoLuz(5) + 0.05);
    expect(colocados[1].ganhoDb).toBe(GANHO_SFX_DB - 8);
    expect(semArquivo).toEqual(["clique_rele"]);
  });
});

describe("grafoMix", () => {
  it("vozes, efeitos e música com ducking pela voz", () => {
    const g = grafoMix({ duracao: 10, vozes: [{ wav: "a.wav", t: 0.2 }, { wav: "b.wav", t: 3 }], sfx: [{ id: "x", arquivo: "sfx/e1.ogg", t: 1, ganhoDb: -4 }], musica: "musica/d.ogg" });
    expect(g.entradas.map((e) => e.at(-1))).toEqual(["a.wav", "b.wav", expect.stringMatching(/sfx\/e1\.ogg$/), expect.stringMatching(/musica\/d\.ogg$/)]);
    expect(g.entradas[3]).toContain("-stream_loop");
    expect(g.filtro).toContain("adelay=3000:all=1");
    expect(g.filtro).toContain("[mus0][sc]sidechaincompress");
    expect(g.filtro).toMatch(/\[voz\]\[sfx\]\[mus\]amix=inputs=3/);
  });
  it("sem música, o sidechain vai para o ralo", () => {
    const g = grafoMix({ duracao: 5, vozes: [{ wav: "a.wav", t: 0.2 }], sfx: [] });
    expect(g.filtro).toContain("[sc]anullsink");
    expect(g.filtro).toMatch(/\[voz\]amix=inputs=1/);
  });
});
