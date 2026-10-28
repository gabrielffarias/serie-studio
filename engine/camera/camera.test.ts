import { describe, expect, it } from "vitest";
import { compilar } from "../core/keyframes";
import { enquadrar, kfsCamera } from "./camera";

const valores = (kfs: ReturnType<typeof kfsCamera>, prop: string) => kfs.filter((k) => k.prop === prop).map((k) => k.v as number);

describe("câmera", () => {
  it("enquadrar nunca mostra borda", () => {
    for (const s of [1, 1.2, 1.5]) {
      for (const f of [{ x: 0, y: 0 }, { x: 1080, y: 1920 }, { x: 540, y: 900 }]) {
        const p = enquadrar(s, f);
        expect(p.x).toBeLessThanOrEqual(0);
        expect(p.x).toBeGreaterThanOrEqual(1080 - 1080 * s - 0.1);
        expect(p.y).toBeLessThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(1920 - 1920 * s - 0.1);
      }
    }
  });
  it("push_in aproxima de `de` até `para` no plano todo", () => {
    const kfs = kfsCamera("p", { mov: "push_in", de: 1, para: 1.3, foco: "janela" }, 5, { janela: { x: 870, y: 710 } }, "s");
    expect(valores(kfs, "scale")).toEqual([1, 1.3]);
    const fim = kfs.find((k) => k.prop === "scale" && k.v === 1.3)!;
    expect(fim.t + fim.dur!).toBeCloseTo(5);
    expect(() => compilar(kfs)).not.toThrow();
  });
  it("shake é determinístico, curto e dentro da margem", () => {
    const a = kfsCamera("p", { mov: "shake", intensidade: 1 }, 4, {}, "semente");
    const b = kfsCamera("p", { mov: "shake", intensidade: 1 }, 4, {}, "semente");
    expect(a).toEqual(b);
    expect(Math.max(...a.map((k) => k.t + (k.dur ?? 0)))).toBeLessThanOrEqual(0.66);
    for (const x of valores(a, "x")) expect(x).toBeLessThanOrEqual(0);
  });
  it("pan_dir vai da borda esquerda à direita", () => {
    const xs = valores(kfsCamera("p", { mov: "pan_dir" }, 4, {}, "s"), "x");
    expect(xs[0]).toBe(0);
    expect(xs[1]).toBeLessThan(0);
  });
});
