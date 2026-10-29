import { describe, expect, it } from "vitest";
import { arranjar, deficit, extensao, pesNoQuadro, type CorpoArranjo } from "./arranjo";
import { montarCena } from "./cena";
import { comporCena, type PlanoCena } from "./plano";
import { PASSAGEM, trajetoPassagem } from "./vulto";
import { PERSONAGENS, pose } from "../rig/personagens";
import { VISTAS_BASE } from "../rig/tipos";
import { compilar } from "../core/keyframes";

const corpo = (id: string, x: number, escala = 1, extra: Partial<CorpoArranjo> = {}): CorpoArranjo => ({
  id, x, y: 1470, escala, espelho: false, esq: -110, dir: 110, topo: -650,
  pes: [{ x0: -60, x1: 10, y0: -24, y1: 2 }, { x0: 0, x1: 70, y0: -24, y1: 2 }], ...extra,
});

describe("arranjo dos personagens", () => {
  it("no mesmo plano, afasta até os corpos não se tocarem (com folga)", () => {
    const cs = [corpo("a", 500, 0.9), corpo("b", 600, 0.9)];
    const r = arranjar(cs);
    expect(r.problemas).toEqual([]);
    expect(deficit(cs[0], cs[1], r.x[0], r.x[1])).toBe(0);
    expect(r.x[0]).toBeLessThan(500);
    expect(r.x[1]).toBeGreaterThan(600);
  });

  it("em planos diferentes, quem está na frente não cobre os pés de quem está atrás", () => {
    const tras = corpo("tras", 540, 0.85), frente = corpo("frente", 560, 1);
    expect(deficit(tras, frente)).toBeGreaterThan(0);
    const r = arranjar([tras, frente]);
    const corpoF = extensao(frente, r.x[1]);
    for (const pe of pesNoQuadro(tras, r.x[0])) expect(pe.x[1] <= corpoF[0] || pe.x[0] >= corpoF[1]).toBe(true);
  });

  it("não tira ninguém do quadro nem do assento; o que não cabe vira problema", () => {
    const r = arranjar([corpo("a", 900, 1, { faixa: [700, 1040] }), corpo("b", 1000)]);
    expect(r.x[0]).toBeGreaterThanOrEqual(700);
    expect(extensao(corpo("b", r.x[1]))[1]).toBeLessThanOrEqual(1080 - 24);
    const cheio = arranjar([0.2, 0.4, 0.6, 0.8, 0.5].map((x, i) => corpo(`c${i}`, x * 1080)));
    expect(cheio.problemas.length).toBeGreaterThan(0);
  });
});

describe("pés sempre à vista", () => {
  // andar e correr são poses do ciclo (passam em 0,3 s); nas outras o objeto não cobre os pés
  const CICLO = ["andar", "correr"];
  it("nenhum acessório cobre os pés do próprio personagem nas poses paradas", () => {
    for (const [id, P] of Object.entries(PERSONAGENS)) {
      for (const nome of Object.keys(P.poses).filter((n) => !CICLO.includes(n))) {
        for (const v of nome === "sentado" ? (["3/4"] as const) : VISTAS_BASE) {
          expect(P.d.pegada!(v, pose(id, nome, v)).cobrePes, `${id} · ${nome} · ${v}`).toEqual([]);
        }
      }
    }
  });

  it("p01 do EP1: Socorro vai para o banco e ninguém cobre os pés de ninguém", () => {
    const m = montarCena({
      px: "p01", cenario: "vagao", luz: "normal",
      personagens: [
        { id: "caio", vista: "3/4_dir", pose: "em_pe", x: 0.3 },
        { id: "socorro", vista: "3/4_esq", pose: "sentado", x: 0.62, y: 0.71, escala: 0.9 },
        { id: "valdir", vista: "3/4_esq", pose: "segurando_pasta", x: 0.82, escala: 0.9 },
      ],
    });
    const [, so, va] = m.instancias;
    expect(so.pos.x).toBeGreaterThanOrEqual(700);
    expect(m.avisos.filter((a) => !a.startsWith("arranjo"))).toEqual([]);
    expect(so.pos.x).toBeLessThan(va.pos.x);
  });
});

describe("passagem do vulto (antes do EP5)", () => {
  const p10 = {
    id: "p10", tipo: "cena", duracao_s: 4, cenario: "vagao", luz: "emergencia_vermelha", lanterna: false,
    camera: { mov: "corte_seco", foco: "janela_dir" }, props: [], efeitos: [],
    personagens: [
      { id: "caio", vista: "3/4_esq", pose: "em_pe", x: 0.28 },
      { id: "criatura_vulto", vista: "perfil_esq", pose: "correr", x: 0.88, y: 0.48, escala: 0.9, acao: { tipo: "correr", para_x: 0.15, em_s: 0.6 } },
    ],
  } as unknown as PlanoCena;

  it("cruza a janela mais perto em 0,5 s, recortada por ela, com borrão, e some", () => {
    const c = comporCena(p10, { px: "p10", dur: 4, itens: [], semente: "t", passagemVulto: true });
    expect(() => compilar(c.kfs)).not.toThrow();
    const inst = "p10-criatura_vulto1";
    expect(c.svg).toContain(`<clipPath id="${inst}-jan"><rect x="748" y="538" width="244" height="344"`);
    expect(c.svg).toContain("feGaussianBlur");
    const op = c.kfs.filter((k) => k.alvo === `#${inst}-passa`).map((k) => [k.t, k.v]);
    expect(op).toEqual([[0, 0], [0.6, 1], [1.1, 0]]);
    const mov = c.kfs.filter((k) => k.alvo === `#${inst}` && k.prop === "x" && k.t > 0);
    expect(mov).toHaveLength(1);
    expect(mov[0]).toMatchObject({ t: 0.6, dur: PASSAGEM.dur });
    // da direita para a esquerda (olha para a esquerda), saindo e entrando fora da janela
    const x0 = c.kfs.find((k) => k.alvo === `#${inst}` && k.prop === "x" && k.t === 0)!.v as number;
    expect(x0).toBeGreaterThan(992);
    expect(mov[0].v as number).toBeLessThan(748);
  });

  it("só o topo da silhueta passa acima da moldura de baixo", () => {
    const j = { x: 730, y: 520, w: 280, h: 380 };
    const g = { esq: -114, dir: 111, topo: -362 };
    const tr = trajetoPassagem(j, g, 0.9, -1);
    const topo = tr.y + g.topo * 0.9;
    expect(j.y + j.h - topo).toBeCloseTo(362 * 0.9 * PASSAGEM.visivel, 0);
  });

  it("depois do EP5 o vulto segue o roteiro (sem passagem forçada)", () => {
    const c = comporCena(p10, { px: "p10", dur: 4, itens: [], semente: "t", passagemVulto: false });
    expect(c.svg).not.toContain("-jan");
  });
});
