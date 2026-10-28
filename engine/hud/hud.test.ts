import { describe, expect, it } from "vitest";
import { compilar } from "../core/keyframes";
import { marcarDestaques, tamanhoCartao } from "./cartao";
import { faixaBateria, partesSelo } from "./hud";
import { blocos, camadaLegenda, ehDestaque, MAX_CARACTERES, silabas, temposPorSilaba } from "./legenda";
import { alturasBarras } from "./telas";

describe("legenda", () => {
  it("conta sílabas por grupos de vogais", () => {
    expect(silabas("porta")).toBe(2);
    expect(silabas("estação")).toBe(3);
    expect(silabas("64%")).toBeGreaterThanOrEqual(2);
  });
  it("distribui as palavras na janela, em ordem, sem passar do fim", () => {
    const t = temposPorSilaba("O trem parou. E tinha alguém lá fora.", 1, 5);
    expect(t[0].ini).toBe(1);
    expect(t.at(-1)!.fim).toBeLessThanOrEqual(5);
    for (let i = 1; i < t.length; i++) expect(t[i].ini).toBeGreaterThanOrEqual(t[i - 1].fim);
    // pausa depois do ponto
    expect(t[3].ini - t[2].fim).toBeGreaterThan(t[1].ini - t[0].fim);
  });
  it("blocos de até 3 palavras, quebrando na pontuação e no limite de caracteres, sem buracos", () => {
    const bs = blocos(temposPorSilaba("O trem parou. E tinha alguém do lado de fora da janela.", 0, 6));
    expect(bs[0].palavras.map((w) => w.palavra)).toEqual(["O", "trem", "parou."]);
    for (const b of bs) {
      expect(b.palavras.length).toBeLessThanOrEqual(3);
      if (b.palavras.length > 1) expect(b.palavras.map((w) => w.palavra).join(" ").length).toBeLessThanOrEqual(MAX_CARACTERES);
    }
    for (let i = 0; i < bs.length - 1; i++) expect(bs[i].fim).toBe(bs[i + 1].ini);
  });
  it("destaque sem acento e sem caixa", () => {
    expect(ehDestaque("PORTA,", ["porta"])).toBe(true);
    expect(ehDestaque("fora", ["lá fora"])).toBe(true);
    expect(ehDestaque("trem", ["porta"])).toBe(false);
  });
  it("keyframes compilam (toda trilha começa em t=0)", () => {
    const { kfs } = camadaLegenda("x", blocos(temposPorSilaba("abre a porta agora", 1, 3)), ["porta"]);
    expect(() => compilar(kfs)).not.toThrow();
  });
});

describe("hud", () => {
  it("faixas da bateria: amarelo abaixo de 50, vermelho abaixo de 20", () => {
    expect(faixaBateria(82)).toBe("normal");
    expect(faixaBateria(50)).toBe("normal");
    expect(faixaBateria(49)).toBe("amarelo");
    expect(faixaBateria(19)).toBe("vermelho");
  });
  it("separa o selo", () => {
    expect(partesSelo("NOITE 1 · 18:47")).toEqual(["NOITE 1", "· 18:47"]);
  });
});

describe("cartão e telas", () => {
  it("pinta trechos de destaque de várias palavras", () => {
    const h = marcarDestaques("TEM ALGUÉM LÁ FORA", ["lá fora"]);
    expect(h).toContain('<span style="color:#FFC21A">LÁ</span>');
    expect(h).toContain('<span style="color:#FFC21A">FORA</span>');
    expect(h).not.toContain('<span style="color:#FFC21A">TEM');
  });
  it("texto curto fica gigante", () => {
    expect(tamanhoCartao("FANTASMA")).toBe(104);
    expect(tamanhoCartao("A ENERGIA ACABOU HÁ UMA HORA E O ELEVADOR SUBIU")).toBe(56);
  });
  it("barras proporcionais, a maior ocupa a altura toda", () => {
    expect(alturasBarras(64, 36, 600)).toEqual([600, 338]);
    expect(alturasBarras(0, 0, 600)).toEqual([0, 0]);
  });
});
