import { describe, expect, it } from "vitest";
import { compilar } from "../core/keyframes";
import { comporCena, type PlanoCena } from "./plano";

const plano = (efeitos: string[]): PlanoCena =>
  ({ id: "p01", tipo: "cena", duracao_s: 5, cenario: "vagao", luz: "normal", personagens: [{ id: "caio", vista: "frente", pose: "em_pe", x: 0.5 }], props: [], efeitos }) as PlanoCena;

describe("efeitos de luz", () => {
  it("apagão sozinho (sem piscar) tem valor inicial e cai no meio do plano", () => {
    const c = comporCena(plano(["apagao"]), { px: "p01", dur: 5, itens: [], semente: "t" });
    expect(() => compilar(c.kfs)).not.toThrow();
    const k = c.kfs.filter((x) => x.alvo === "#p01-piscar");
    expect(k.map((x) => [x.t, x.v])).toEqual([[0, 0], [2.5, 0.93]]);
  });

  it("apagão com piscar também compila", () => {
    expect(() => compilar(comporCena(plano(["piscar_luz", "apagao"]), { px: "p01", dur: 5, itens: [], semente: "t" }).kfs)).not.toThrow();
  });

  it("o feixe da lanterna acompanha o Caio andando", () => {
    const p = { ...plano([]), luz: "lanterna", personagens: [{ id: "caio", vista: "perfil_dir", pose: "segurar_lanterna", x: 0.3, acao: { tipo: "andar", para_x: 0.6, em_s: 1 } }] } as PlanoCena;
    const c = comporCena(p, { px: "p01", dur: 5, itens: ["lanterna_mao"], semente: "t" });
    expect(() => compilar(c.kfs)).not.toThrow();
    const xs = c.kfs.filter((k) => k.alvo === "#p01-cone" && k.prop === "x").map((k) => k.v as number);
    expect(xs[0]).toBe(0);
    expect(Math.max(...xs)).toBeCloseTo(0.3 * 1080, -1);
  });
});
