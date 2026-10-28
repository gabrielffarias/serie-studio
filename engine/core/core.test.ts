import { describe, expect, it } from "vitest";
import { rng, hashSemente } from "./rng";
import { compilar, valoresFinais, type Keyframe } from "./keyframes";

describe("rng", () => {
  it("mesma semente, mesma sequência; sementes diferentes divergem", () => {
    const a = rng("ep01/p03"), b = rng("ep01/p03"), c = rng("ep01/p04");
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(hashSemente("x")).toBe(hashSemente("x"));
  });
});

describe("compilar", () => {
  it("encadeia de→para por trilha, em ordem de tempo", () => {
    const kfs: Keyframe[] = [
      { alvo: "#b", prop: "rotation", t: 1, v: -90, dur: 0.2, ease: "power2.out" },
      { alvo: "#b", prop: "rotation", t: 0, v: 0 },
      { alvo: "#b", prop: "rotation", t: 2, v: -45, dur: 0.1 },
    ];
    expect(compilar(kfs)).toEqual([
      ["#b", "rotation", 0, 0, 0, 0, "none"],
      ["#b", "rotation", 0, -90, 1, 0.2, "power2.out"],
      ["#b", "rotation", -90, -45, 2, 0.1, "none"],
    ]);
  });

  it("exige valor inicial ou usa o dos iniciais", () => {
    const kfs: Keyframe[] = [{ alvo: "#b", prop: "x", t: 1, v: 10, dur: 1 }];
    expect(() => compilar(kfs)).toThrow(/sem valor inicial/);
    expect(compilar(kfs, { "#b|x": 5 })).toEqual([["#b", "x", 5, 10, 1, 1, "none"]]);
  });

  it("valoresFinais pega o último valor de cada trilha", () => {
    const f = valoresFinais([
      { alvo: "#a", prop: "x", t: 0, v: 0 },
      { alvo: "#a", prop: "x", t: 2, v: 30, dur: 1 },
      { alvo: "#a", prop: "x", t: 1, v: 10, dur: 0.5 },
      { alvo: "#a", prop: "opacity", t: 0, v: 1 },
    ]);
    expect(f.get("#a|x")).toBe(30);
    expect(f.get("#a|opacity")).toBe(1);
  });
});

describe("compilar: encaixes no mesmo instante", () => {
  it("só o último encaixe de duração zero no mesmo t vale", () => {
    const segs = compilar([
      { alvo: "#h", prop: "opacity", t: 0, v: 1 },
      { alvo: "#h", prop: "opacity", t: 0, v: 0 },
      { alvo: "#h", prop: "opacity", t: 5, v: 1 },
    ]);
    expect(segs.map((s) => [s[2], s[3], s[4]])).toEqual([[0, 0, 0], [0, 1, 5]]);
  });
  it("mantém o encaixe em t=0 quando a transição seguinte começa no mesmo t", () => {
    const segs = compilar([
      { alvo: "#j", prop: "rotation", t: 0, v: 5 },
      { alvo: "#j", prop: "rotation", t: 0, v: 20, dur: 0.1 },
    ]);
    expect(segs.length).toBe(2);
  });
});
