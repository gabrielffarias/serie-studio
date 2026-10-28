import { describe, expect, it } from "vitest";
import { gerarCatalogo } from "../../engine/catalogo";
import { cronogramaPistas, esqueleto } from "./biblia";
import { extrairJson } from "./claude-cli";
import { estadoInicial } from "./estado";
import { BIBLIA, ep1Json } from "./fixtures/roteiro";
import { gerarRoteiro, promptRoteiro, type PedidoRoteiro } from "./gerar-roteiro";

const nos = esqueleto(BIBLIA);
const pedido: PedidoRoteiro = {
  serie: "estacao-fantasma",
  no: nos[0],
  estado: estadoInicial("estacao-fantasma", BIBLIA),
  catalogo: gerarCatalogo(),
  cronograma: cronogramaPistas(BIBLIA),
};

/** CLI falso: devolve as respostas em ordem e guarda os prompts. */
function falso(...respostas: string[]) {
  const prompts: string[] = [];
  const salvos: string[] = [];
  return {
    prompts,
    salvos,
    deps: {
      chamar: async (p: string) => {
        prompts.push(p);
        const r = respostas.shift();
        if (r === undefined) throw new Error("chamada a mais");
        return r;
      },
      salvarTentativa: (n: number, bruto: string) => {
        salvos.push(bruto);
        return `data/roteiros/ep01-t${n}.txt`;
      },
    },
  };
}

const valido = () => JSON.stringify(ep1Json());

describe("extrairJson", () => {
  it("aceita JSON puro, cerca de código e texto em volta", () => {
    expect(extrairJson('{"a":1}')).toEqual({ a: 1 });
    expect(extrairJson('Aqui está:\n```json\n{"a":2}\n```\nPronto.')).toEqual({ a: 2 });
    expect(extrairJson('Segue o roteiro {"a":{"b":[3]}} espero que goste')).toEqual({ a: { b: [3] } });
  });

  it("explica quando não há JSON ou ele está quebrado", () => {
    expect(() => extrairJson("não consegui")).toThrow(/nenhum JSON/);
    expect(() => extrairJson('{"a":')).toThrow(/malformado/);
  });
});

describe("promptRoteiro", () => {
  it("leva nó, votação, destinos, pistas permitidas e as proibições do EP1", () => {
    const p = promptRoteiro(pedido);
    expect(p).toContain("MODO 2");
    expect(p).toContain("`ep01` (EP1)");
    expect(p).toContain('votacao.no_se_a = "ep02_tunel", votacao.no_se_b = "ep02_vagao"');
    expect(p).toContain("Pistas permitidas até aqui: vulto_janela.");
    expect(p).toContain("Não use infográfico");
    expect(p).toContain("resultado_anterior é null");
    expect(p).toContain("series/estacao-fantasma/estado.json, assets/catalogo.json");
    expect(p).toContain("Itens no estado: lanterna_mao.");
  });

  it("com votação anterior, pede o plano de resultado; sem votação no nó, pede CONTINUA", () => {
    const p = promptRoteiro({ ...pedido, no: nos.find((n) => n.no === "ep02_tunel")!, resultado: { opcao: "A", pct_a: 62, pct_b: 38, total_votos: 120 } });
    expect(p).toContain("venceu A (A 62% × B 38%, 120 votos)");
    expect(p).toContain("último plano é `continua`");
    expect(p).not.toContain("Não use infográfico");
  });

  it("anexa o comentário da revisão", () => {
    expect(promptRoteiro({ ...pedido, comentario: "Socorro fala demais" })).toContain("corrija isto: Socorro fala demais");
  });
});

describe("gerarRoteiro", () => {
  it("roteiro válido na primeira chamada", async () => {
    const f = falso(`Claro! ${valido()}`);
    const r = await gerarRoteiro(pedido, f.deps);
    expect(r.ok && r.tentativas).toBe(1);
    expect(f.prompts).toHaveLength(1);
  });

  it("schema inválido → segunda chamada com os erros e o arquivo da tentativa", async () => {
    const quebrado = { ...ep1Json(), no: "EP1" };
    const f = falso(JSON.stringify(quebrado), valido());
    const r = await gerarRoteiro(pedido, f.deps);
    expect(r.ok && r.tentativas).toBe(2);
    expect(f.prompts[1]).toContain("data/roteiros/ep01-t1.txt");
    expect(f.prompts[1]).toMatch(/- no: nó no formato/);
  });

  it("checagem bloqueante também vai para o retry", async () => {
    const cedo = { ...ep1Json(), estado_final: { bateria: 100, pistas: ["vulto_janela", "pegadas"] } };
    const f = falso(JSON.stringify(cedo), valido());
    const r = await gerarRoteiro(pedido, f.deps);
    expect(r.ok).toBe(true);
    expect(f.prompts[1]).toContain("pistas_cronograma: pistas antes da hora: pegadas (EP2)");
  });

  it("schema válido mas com checagem em ❌ depois do retry segue para revisão com o ❌ visível", async () => {
    const cedo = JSON.stringify({ ...ep1Json(), estado_final: { bateria: 100, pistas: ["pegadas"] } });
    const r = await gerarRoteiro(pedido, falso(cedo, cedo).deps);
    if (!r.ok) throw new Error("devia seguir");
    expect(r.checagens.find((c) => c.id === "pistas_cronograma")?.ok).toBe(false);
  });

  it("inválido duas vezes = falha com os erros", async () => {
    const r = await gerarRoteiro(pedido, falso("sem json", '{"serie":1}').deps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.some((e) => e.startsWith("serie:"))).toBe(true);
  });
});
