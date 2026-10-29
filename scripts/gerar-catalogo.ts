// Gera assets/catalogo.json a partir do motor. Uso: npm run catalogo
import { writeFileSync } from "node:fs";
import path from "node:path";
import { gerarCatalogo } from "../engine/catalogo";
import { CAMINHO_CATALOGO } from "../src/lib/catalogo";

const c = gerarCatalogo();
writeFileSync(CAMINHO_CATALOGO, JSON.stringify(c, null, 2) + "\n");
console.log(
  `✅ ${path.relative(process.cwd(), CAMINHO_CATALOGO)}: ${c.personagens.length} personagens, ${c.cenarios.length} cenários, ` +
    `${c.acoes.length} ações, ${c.props.length} props, ${c.infograficos.length} infográficos, ${c.sons.length} sons`,
);
