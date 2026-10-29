import { describe, expect, it } from "vitest";
import { instanteEventoLuz } from "../compose/plano";
import { ganhoMusicaExpr, grafoMix, planejarSfx, trechosDuck, DUCK_RAMPA_S, GANHO_SFX_DB, type Sons } from "./mix";

const sons: Sons = {
  sfx: {
    estalo_seco: { arquivos: ["sfx/e1.ogg", "sfx/e2.ogg", "sfx/e3.ogg"] },
    zumbido_corta: { arquivos: ["sfx/z.ogg"] },
    passos_leves: { arquivos: ["sfx/p.ogg"], ganho_db: -8 },
  },
  musica: { drone: { arquivo: "musica/d.ogg", loop: true } },
  mix: { silencio_: { musica_db: -12 } },
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

  it("silencio_* não toca arquivo: vira música baixa no plano inteiro", () => {
    const { colocados, silencios, semArquivo } = planejarSfx([{ id: "p08", ini: 40, dur: 6, som: ["silencio_tenso"], eventoLuz: false }], sons, dur);
    expect(colocados).toEqual([]);
    expect(semArquivo).toEqual([]);
    expect(silencios).toEqual([{ id: "silencio_tenso", ini: 40, fim: 46, db: -12 }]);
  });
});

describe("ganhoMusicaExpr", () => {
  it("1 fora dos silêncios; -12 dB dentro, com rampa", () => {
    const expr = ganhoMusicaExpr([{ id: "silencio_tenso", ini: 40, fim: 46, db: -12 }]);
    const clip = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
    const em = (t: number) => Function("t", "clip", "min", `return ${expr}`)(t, clip, Math.min) as number;
    expect(em(30)).toBe(1);
    expect(em(43)).toBeCloseTo(10 ** (-12 / 20), 3);
    expect(em(40.2)).toBeGreaterThan(em(43));
    expect(ganhoMusicaExpr([])).toBe("1");
  });
});

describe("trechosDuck", () => {
  it("rampa antes da voz, segura depois e junta falas próximas", () => {
    const d = trechosDuck([{ t: 5, fim: 6 }, { t: 0.2, fim: 2 }, { t: 2.5, fim: 3 }]);
    expect(d).toEqual([
      { id: "duck", ini: 0.05, fim: 3.35, db: -8 },
      { id: "duck", ini: 4.85, fim: 6.35, db: -8 },
    ]);
    expect(d[0].ini).toBeCloseTo(0.2 - DUCK_RAMPA_S);
  });
});

describe("grafoMix", () => {
  it("vozes, efeitos e música com ducking pela voz", () => {
    const g = grafoMix({ duracao: 10, vozes: [{ wav: "a.wav", t: 0.2, fim: 2 }, { wav: "b.wav", t: 3, fim: 4 }], sfx: [{ id: "x", arquivo: "sfx/e1.ogg", t: 1, ganhoDb: -4 }], musica: "musica/d.ogg" });
    expect(g.entradas.map((e) => e.at(-1))).toEqual(["a.wav", "b.wav", expect.stringMatching(/sfx\/e1\.ogg$/), expect.stringMatching(/musica\/d\.ogg$/)]);
    expect(g.entradas[3]).toContain("-stream_loop");
    expect(g.filtro).toContain("adelay=3000:all=1");
    expect(g.filtro).not.toContain("sidechaincompress");
    expect(g.filtro).toContain("highpass=f=90");
    expect(g.filtro).toContain("equalizer=f=4000");
    expect(g.filtro).toContain("aecho=");
    expect(g.filtro).toMatch(/\[voz\]\[sfx\]\[mus\]amix=inputs=3/);
    // ducking de -8 dB (ganho 0,3981) nas vozes, juntas num trecho só (buraco de 1 s < 0,8 s depois das rampas)
    expect(g.filtro).toMatch(/volume='\(1-0\.6019\*clip\(min\(\(t-0\.05\)\/0\.15,\(4\.35-t\)\/0\.15\),0,1\)\)':eval=frame,afade/);
    const comSilencio = grafoMix({ duracao: 10, vozes: [{ wav: "a.wav", t: 0.2, fim: 1 }], sfx: [], musica: "musica/d.ogg", silencios: [{ id: "silencio_tenso", ini: 2, fim: 6, db: -12 }] });
    expect(comSilencio.filtro).toMatch(/volume='\(1-0\.7488\*clip\(.*\)\)':eval=frame,volume='\(1-0\.6019/);
  });
  it("sem música, só a voz", () => {
    const g = grafoMix({ duracao: 5, vozes: [{ wav: "a.wav", t: 0.2, fim: 1 }], sfx: [] });
    expect(g.filtro).toMatch(/\[voz\]amix=inputs=1/);
  });
});
