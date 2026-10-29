import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { provedores, sintetizarComFallback, type TtsProvider } from "./provedores";
import { lerVozes } from "../../src/lib/vozes";

const dir = mkdtempSync(path.join(tmpdir(), "tts-teste-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function falso(id: string, comportamento: "ok" | "erro" | "fora"): TtsProvider & { chamadas: number } {
  return {
    id,
    chamadas: 0,
    disponivel: () => comportamento !== "fora",
    voz: () => ({ voz: `${id}-voz`, ajustes: "" }),
    async sintetizar(_t, _p, saida) {
      this.chamadas++;
      if (comportamento === "erro") throw new Error("serviço caiu");
      writeFileSync(saida, "RIFF");
      return { duracao: 1.2, palavras: [{ texto: "oi", ini: 0.1, fim: 0.4 }] };
    },
  };
}

describe("TtsProvider com fallback", () => {
  it("pula o indisponível e o que falha; registra quem gerou e por quê", async () => {
    const azure = falso("azure", "fora");
    const edge = falso("edge", "erro");
    const kokoro = falso("kokoro", "ok");
    const r = await sintetizarComFallback({ texto: "Oi.", papel: "narrador" }, [azure, edge, kokoro], path.join(dir, "a.wav"), path.join(dir, "cache"));
    expect(r).toMatchObject({ provedor: "kokoro", voz: "kokoro-voz", duracao: 1.2, cache: false });
    expect(r.falhas).toEqual(["azure: indisponível", "edge: serviço caiu"]);
  });

  it("cache por hash: a segunda vez não chama o provedor", async () => {
    const edge = falso("edge", "ok");
    await sintetizarComFallback({ texto: "Fale baixo.", papel: "valdir" }, [edge], path.join(dir, "b.wav"), path.join(dir, "cache"));
    const r = await sintetizarComFallback({ texto: "Fale baixo.", papel: "valdir" }, [edge], path.join(dir, "c.wav"), path.join(dir, "cache"));
    expect(edge.chamadas).toBe(1);
    expect(r.cache).toBe(true);
  });

  it("nenhum provedor: erro com o motivo de cada um", async () => {
    await expect(sintetizarComFallback({ texto: "x", papel: "narrador" }, [falso("edge", "erro")], path.join(dir, "d.wav"), path.join(dir, "cache"))).rejects.toThrow(/edge: serviço caiu/);
  });

  it("ordem configurável; Azure e VoiceStudio existem mas ficam indisponíveis sem chave", () => {
    const v = lerVozes("estacao-fantasma")!;
    expect(provedores(v, ["azure", "edge", "kokoro", "voicestudio"]).map((p) => p.id)).toEqual(["azure", "edge", "kokoro", "voicestudio"]);
    expect(provedores(v, ["azure"])[0].disponivel()).toBe(false);
    expect(() => provedores(v, ["piper"])).toThrow(/desconhecido/);
  });
});
