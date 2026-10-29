// Captura de tela de HTML com o Chrome do HyperFrames (prévias de asset e folhas).
import { execFileSync } from "node:child_process";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";

const RAIZ = path.resolve(import.meta.dirname, "../..");

let caminhoChrome: string | null = null;
function chrome(): string {
  if (!caminhoChrome) {
    const hf = path.join(RAIZ, "node_modules/.bin/hyperframes");
    const saida = execFileSync(hf, ["browser", "path"], { env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1" } }).toString();
    caminhoChrome = saida.trim().split("\n").pop()!.trim();
  }
  return caminhoChrome;
}

export async function abrirNavegador(): Promise<Browser> {
  return puppeteer.launch({ executablePath: chrome(), headless: "shell", timeout: 30000, args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=none"] });
}

/** Abre um arquivo HTML local e salva PNG do tamanho pedido. `antes` roda na página antes da foto. */
export async function fotografar(
  navegador: Browser,
  arquivoHtml: string,
  png: string,
  largura: number,
  altura: number,
  antes?: string,
): Promise<void> {
  const pagina = await navegador.newPage();
  try {
    await pagina.setViewport({ width: largura, height: altura });
    await pagina.goto(`file://${arquivoHtml}`, { waitUntil: "load" });
    await pagina.evaluate(() => document.fonts.ready.then(() => true));
    // devolver objetos (timeline, FontFaceSet) trava a serialização do puppeteer
    if (antes) await pagina.evaluate(`void (${antes}); true`);
    await pagina.screenshot({ path: png as `${string}.png` });
  } finally {
    await pagina.close();
  }
}
