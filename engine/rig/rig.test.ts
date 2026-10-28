import { describe, expect, it } from "vitest";
import { resolverPose } from "./poses";
import { kfsPose, kfsRaiz } from "./instancia";
import { PERSONAGENS, personagem, pose } from "./personagens";
import { montarCena, parseVista } from "../compose/cena";

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

describe("regra dos objetos (isopor, pasta)", () => {
  const OBJETO: Record<string, string> = { socorro: "isopor_mao", valdir: "pasta" };
  const GESTOS = ["apontar", "braco_estendido", "assustado", "maos_na_cabeca", "empurrar", "ajustar_oculos"];
  for (const [id, objeto] of Object.entries(OBJETO)) {
    it(`${id}: com o objeto na mão, o braço dele não gesticula`, () => {
      for (const nome of Object.keys(personagem(id).poses)) {
        for (const v of ["perfil", "3/4", "frente"] as const) {
          const p = pose(id, nome, v);
          if (!p.acessorios[objeto]) continue;
          expect(Math.abs(p.angulos.braco_d), `${nome} · ${v}`).toBeLessThanOrEqual(45);
        }
      }
    });
    it(`${id}: gestos usam a outra mão`, () => {
      for (const nome of GESTOS.filter((g) => personagem(id).poses[g])) {
        const p = pose(id, nome, "perfil");
        expect(Math.abs(p.angulos.braco_e), nome).toBeGreaterThan(45);
      }
    });
  }
});

describe("ações", () => {
  it("espelhar lados troca perna/braço da frente e de trás (de frente, inverte o sinal)", async () => {
    const { espelharLados } = await import("../acoes/acoes");
    const p = pose("caio", "andar", "perfil");
    const e = espelharLados(p, "perfil");
    expect(e.angulos.coxa_d).toBe(p.angulos.coxa_e);
    expect(e.angulos.braco_e).toBe(p.angulos.braco_d);
    const f = pose("caio", "andar", "frente");
    expect(espelharLados(f, "frente").angulos.coxa_d).toBe(-f.angulos.coxa_e + 0);
  });
  it("andar até para_x: a raiz chega ao destino e todas as trilhas compilam", async () => {
    const { kfsAcao } = await import("../acoes/acoes");
    const { compilar } = await import("../core/keyframes");
    const ctx = { id: "caio", inst: "i", vista: "perfil" as const, espelho: false, pos: { x: 100, y: 1470, escala: 1 }, poseBase: "em_pe", extras: {}, dur: 5, semente: "s" };
    const kfs = kfsAcao({ tipo: "andar", para_x: 0.5 }, ctx);
    const xs = kfs.filter((k) => k.alvo === "#i" && k.prop === "x");
    expect(xs.at(-1)!.v).toBe(540);
    // a pose inicial em t=0 vem do montarCena
    const base = kfsPose(PERSONAGENS.caio.d, "i", "perfil", pose("caio", "em_pe", "perfil"), 0);
    expect(() => compilar([...base, ...kfsRaiz("i", { x: 100, y: 1470, escala: 1, espelho: false }, 0), ...kfs])).not.toThrow();
  });
});

describe("lanterna de mão", () => {
  it("segurar_lanterna em perfil: a ponta fica à frente do corpo, na altura do peito, e o feixe sai quase na horizontal", () => {
    const { d } = personagem("caio");
    const pr = pose("caio", "segurar_lanterna", "perfil");
    expect(pr.acessorios.lanterna_mao).toBe(true);
    const p = d.pontaDaMao!("perfil", pr, "d", 98);
    expect(p.x).toBeGreaterThan(200);
    expect(p.y).toBeLessThan(-300);
    expect(p.y).toBeGreaterThan(-450);
    expect(p.angulo).toBeGreaterThan(0);
    expect(p.angulo).toBeLessThan(15);
  });

  it("montarCena: o feixe sai da mão (espelhado para a esquerda) e acompanha a instância", () => {
    const m = montarCena({ px: "t", cenario: "vagao", luz: "lanterna", itens: ["lanterna_mao"], personagens: [{ id: "caio", vista: "3/4_esq", pose: "segurar_lanterna", x: 0.6 }] });
    expect(m.lanterna!.dono).toBe(m.instancias[0].inst);
    expect(m.lanterna!.x).toBeLessThan(0.6 * 1080 - 150);
    expect(Math.abs(m.lanterna!.angulo - 180)).toBeLessThan(20);
  });

  it("sem ninguém segurando, o feixe vem de baixo (ponto de vista)", () => {
    const m = montarCena({ px: "t", cenario: "tunel", luz: "lanterna", itens: ["lanterna_mao"], personagens: [{ id: "socorro", vista: "3/4_dir", pose: "em_pe", x: 0.5 }] });
    expect(m.lanterna).toMatchObject({ x: 540, angulo: -90 });
  });
});
