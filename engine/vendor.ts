// Arquivos de terceiros que todo projeto HyperFrames do motor precisa ter localmente:
// o render não pode buscar nada na rede (contrato do HyperFrames: determinismo).
import { copyFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const nm = (p: string) => path.join(RAIZ, "node_modules", p);

export const VENDOR: Record<string, string> = {
  "assets/vendor/gsap.min.js": nm("gsap/dist/gsap.min.js"),
  "assets/fonts/anton-400.woff2": nm("@fontsource/anton/files/anton-latin-400-normal.woff2"),
  "assets/fonts/inter-800.woff2": nm("@fontsource/inter/files/inter-latin-800-normal.woff2"),
  "assets/fonts/inter-900.woff2": nm("@fontsource/inter/files/inter-latin-900-normal.woff2"),
};

/** Copia GSAP e fontes para dentro de um projeto HyperFrames. */
export function copiarVendor(projetoDir: string): void {
  for (const [destino, origem] of Object.entries(VENDOR)) {
    const alvo = path.join(projetoDir, destino);
    mkdirSync(path.dirname(alvo), { recursive: true });
    copyFileSync(origem, alvo);
  }
}
