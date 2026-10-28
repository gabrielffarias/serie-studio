import { describe, expect, it } from "vitest";
import { compilar } from "../core/keyframes";
import { comporCena, type PlanoCena } from "./plano";

const plano = (efeitos: string[]): PlanoCena =>
  ({ id: "p01", tipo: "cena", duracao_s: 5, cenario: "vagao", luz: "normal", lanterna: false, personagens: [{ id: "caio", vista: "frente", pose: "em_pe", x: 0.5 }], props: [], efeitos }) as PlanoCena;

const luzes = { p01: { id: "p01", local: "vagao", inicio: "normal", fim: "emergencia_vermelha", evento: "apagao" } } as const;

describe("efeitos de luz", () => {
  it("apagão: corte para quase preto no meio do plano e troca da luz normal para a emergência", () => {
    const c = comporCena(plano(["apagao"]), { px: "p01", dur: 5, itens: [], semente: "t", luzes });
    expect(() => compilar(c.kfs)).not.toThrow();
    expect(c.svg).toContain('id="p01-amb1"');
    const em = (alvo: string) => c.kfs.filter((x) => x.alvo === alvo).map((x) => [x.t, x.v]);
    expect(em("#p01-amb0")).toEqual([[0, 1], [2.5, 0]]);
    expect(em("#p01-amb1")).toEqual([[0, 0], [2.5, 1]]);
    expect(em("#p01-piscar")).toEqual([[0, 0], [2.5, 0.95], [2.85, 0]]);
  });

  it("apagão com piscar também compila", () => {
    expect(() => compilar(comporCena(plano(["piscar_luz", "apagao"]), { px: "p01", dur: 5, itens: [], semente: "t", luzes }).kfs)).not.toThrow();
  });

  it("o feixe da lanterna acompanha o Caio andando", () => {
    const p = { ...plano([]), luz: "emergencia_vermelha", lanterna: true, personagens: [{ id: "caio", vista: "perfil_dir", pose: "segurar_lanterna", x: 0.3, acao: { tipo: "andar", para_x: 0.6, em_s: 1 } }] } as PlanoCena;
    const c = comporCena(p, { px: "p01", dur: 5, itens: ["lanterna_mao"], semente: "t" });
    expect(() => compilar(c.kfs)).not.toThrow();
    const xs = c.kfs.filter((k) => k.alvo === "#p01-cone" && k.prop === "x").map((k) => k.v as number);
    expect(Math.max(...xs) - xs[0]).toBeCloseTo(0.3 * 1080, -1);
  });
});
