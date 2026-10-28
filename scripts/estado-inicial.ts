// Cria series/<slug>/estado.json com o estado inicial da bíblia (§7).
// Uso: npm run estado:inicial -- [slug]   (não sobrescreve um estado existente)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { caminhoEstado, estadoInicial } from "../src/lib/estado";

const serie = process.argv[2] ?? "estacao-fantasma";
const destino = caminhoEstado(serie);
if (existsSync(destino)) {
  console.error(`❌ ${path.relative(process.cwd(), destino)} já existe; apague à mão se quiser recomeçar a história`);
  process.exit(1);
}
const biblia = readFileSync(path.join(path.dirname(destino), "biblia.md"), "utf8");
writeFileSync(destino, JSON.stringify(estadoInicial(serie, biblia), null, 2) + "\n");
console.log(`✅ ${path.relative(process.cwd(), destino)}`);
