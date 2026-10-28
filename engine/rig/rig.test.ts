import { describe, expect, it } from "vitest";
import { resolverPose } from "./poses";
import { kfsPose, kfsRaiz } from "./instancia";
import { PERSONAGENS, pose } from "./personagens";
import { parseVista } from "../compose/cena";

describe("resolverPose", () => {
  const apontar = { angulos: { braco_d: -80 } };
  it("perfil e 3/4 usam os ângulos como estão", () => {
    expect(resolverPose(apontar, "perfil").angulos.braco_d).toBe(-80);
    expect(resolverPose(apontar, "3/4").angulos.braco_d).toBe(-80);
  });
  it("de frente, o braço direito (à esquerda da tela) abre girando no sentido horário", () => {
    expect(resolverPose(apontar, "frente").angulos.braco_d).toBe(48);
    expect(resolverPose({ angulos: { braco_e: -80 } }, "frente").angulos.braco_e).toBe(-48);
  });
  it("de costas, os lados se invertem", () => {
    expect(resolverPose(apontar, "costas").angulos.braco_d).toBe(-48);
  });
  it("por_vista sobrescreve; cabeça virada só em perfil/3-4", () => {
    const p = { angulos: { braco_d: -80 }, por_vista: { frente: { angulos: { braco_d: 12 } } }, cabeca_virada: true };
    expect(resolverPose(p, "frente").angulos.braco_d).toBe(12);
    expect(resolverPose(p, "frente").cabeca_virada).toBe(false);
    expect(resolverPose(p, "perfil").cabeca_virada).toBe(true);
  });
});

describe("personagens do catálogo", () => {
  it("todas as poses resolvem nas 4 vistas, para todo personagem", () => {
    for (const [id, p] of Object.entries(PERSONAGENS)) {
      for (const nome of Object.keys(p.poses)) {
        for (const v of ["frente", "costas", "perfil", "3/4"] as const) expect(() => pose(id, nome, v)).not.toThrow();
      }
    }
  });
  it("acessório pendurado contra-gira a soma da cadeia", () => {
    const { d } = PERSONAGENS.socorro;
    const p = pose("socorro", "apontar", "perfil");
    const kf = kfsPose(d, "x", "perfil", p, 0).find((k) => k.alvo === "#x-perfil-ac-isopor_mao" && k.prop === "rotation");
    const soma = p.angulos.tronco + p.angulos.braco_d + p.angulos.antebraco_d + p.angulos.mao_d;
    expect(kf?.v).toBeCloseTo(-soma);
  });
  it("encolher a coxa desloca a canela, sem escalar a cadeia", () => {
    const { d } = PERSONAGENS.caio;
    const kfs = kfsPose(d, "x", "frente", pose("caio", "sentado", "frente"), 0);
    expect(kfs.find((k) => k.alvo === "#x-frente-coxa_d-seg")?.v).toBe(0.25);
    expect(kfs.find((k) => k.alvo === "#x-frente-canela_d-pos")?.v).toBe(-75);
  });
  it("escala e espelho ficam no grupo interno, a raiz só posiciona", () => {
    const kfs = kfsRaiz("x", { x: 100, y: 200, escala: 0.5, espelho: true }, 0);
    expect(kfs.filter((k) => k.alvo === "#x").map((k) => k.prop)).toEqual(["x", "y"]);
    expect(kfs.find((k) => k.alvo === "#x-espelho" && k.prop === "scaleX")?.v).toBe(-0.5);
  });
  it("parseVista", () => {
    expect(parseVista("3/4_esq")).toEqual({ base: "3/4", espelho: true });
    expect(parseVista("frente")).toEqual({ base: "frente", espelho: false });
  });
});
