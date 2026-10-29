import { describe, expect, it } from "vitest";
import { compilar } from "../core/keyframes";
import { marcarDestaques, tamanhoCartao } from "./cartao";
import { camadaHudEpisodio, faixaBateria, partesSelo, passosHud } from "./hud";
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

describe("HUD animado", () => {
  const planos = [
    { ini: 0, dur: 10, cena: true, lanterna: false },
    { ini: 10, dur: 10, cena: true, lanterna: true },
    { ini: 20, dur: 10, cena: true, lanterna: false },
    { ini: 30, dur: 7, cena: false, lanterna: false },
  ];
  it("o relógio avança nas cenas até a hora final; a bateria cai só no plano com lanterna", () => {
    const p = passosHud(planos, { de: "18:04", para: "18:07" }, { de: 100, para: 98 });
    expect(p.horas).toEqual([{ t: 0, hora: "18:04" }, { t: 5, hora: "18:05" }, { t: 15, hora: "18:06" }, { t: 25, hora: "18:07" }]);
    expect(p.bateria).toEqual([{ t: 0, valor: 100 }, { t: 12.5, valor: 99 }, { t: 17.5, valor: 98 }]);
  });

  it("sem lanterna acesa a bateria não cai; a camada compila", () => {
    const p = passosHud(planos.map((x) => ({ ...x, lanterna: false })), { de: "23:59", para: "00:01" }, { de: 21, para: 15 });
    expect(p.bateria).toEqual([{ t: 0, valor: 21 }]);
    expect(p.horas.map((h) => h.hora)).toEqual(["23:59", "00:00", "00:01"]);
    const c = camadaHudEpisodio("r", "NOITE 1 · 23:59", "BATERIA", passosHud(planos, { de: "18:04", para: "18:05" }, { de: 20, para: 18 }), 37);
    expect(() => compilar(c.kfs)).not.toThrow();
    expect(c.html).toContain("· 18:05");
    expect(c.kfs.some((k) => k.alvo === "#r-bat-2-pct")).toBe(true);
  });
});
