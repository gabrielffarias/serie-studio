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
});
