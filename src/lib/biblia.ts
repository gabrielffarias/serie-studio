// Leitura das tabelas da bíblia (Markdown): estado inicial (§7), cronograma de
// pistas (§9) e esqueleto da temporada (§10). A bíblia é a fonte; o código só lê.

/** Linhas de dados da primeira tabela Markdown depois do título que começa com `titulo`. */
export function tabelaDaSecao(md: string, titulo: RegExp): string[][] {
  const linhas = md.split("\n");
  const ini = linhas.findIndex((l) => /^#{2,3}\s/.test(l) && titulo.test(l));
  if (ini < 0) throw new Error(`seção não encontrada na bíblia: ${titulo}`);
  const out: string[][] = [];
  let dentro = false;
  for (let i = ini + 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (/^#{2,3}\s/.test(l)) break;
    if (!l.startsWith("|")) {
      if (dentro) break;
      continue;
    }
    dentro = true;
    const celulas = l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (celulas.every((c) => /^:?-+:?$/.test(c))) continue; // separador
    out.push(celulas);
  }
  return out.slice(1); // sem o cabeçalho
}

const semMarcacao = (s: string) => s.replace(/\*\*|`/g, "").trim();

// ── §9 cronograma ────────────────────────────────────────────────────────────

/** pista → primeiro EP em que pode aparecer */
export function cronogramaPistas(md: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ep, , chaves] of tabelaDaSecao(md, /Cronograma de revela/i)) {
    const n = Number.parseInt(ep, 10);
    if (!Number.isFinite(n)) continue;
    for (const m of (chaves ?? "").matchAll(/`([a-z0-9_]+)`/g)) out[m[1]] ??= n;
  }
  return out;
}

// ── §10 esqueleto ────────────────────────────────────────────────────────────

export type NoEsqueleto = {
  no: string;
  numero: number;
  resumo: string;
  temVotacao: boolean;
  opcaoA?: string;
  opcaoB?: string;
  noSeA?: string;
  noSeB?: string;
  efeitos: string;
};

/**
 * Nós da temporada. A votação de um nó leva aos nós do episódio seguinte:
 * dois nós (2A, 2B) = A vai para o primeiro e B para o segundo; um nó só =
 * os dois galhos convergem nele.
 */
export function esqueleto(md: string): NoEsqueleto[] {
  const nos: NoEsqueleto[] = tabelaDaSecao(md, /Esqueleto da temporada/i).map(([ep, no, resumo, votacao, efeitos]) => {
    const v = semMarcacao(votacao ?? "");
    const m = v.match(/^A:\s*(.+?)\s*\/\s*B:\s*(.+)$/);
    return {
      no: semMarcacao(no),
      numero: Number.parseInt(ep, 10),
      resumo: semMarcacao(resumo ?? ""),
      temVotacao: !!m,
      opcaoA: m?.[1],
      opcaoB: m?.[2],
      efeitos: semMarcacao(efeitos ?? ""),
    };
  });
  for (const n of nos) {
    if (!n.temVotacao) continue;
    const proximos = nos.filter((x) => x.numero === n.numero + 1);
    n.noSeA = proximos[0]?.no;
    n.noSeB = (proximos[1] ?? proximos[0])?.no;
  }
  return nos;
}

// ── §7 estado inicial ────────────────────────────────────────────────────────

/** "100" → 100, "[]" → [], "[caio, socorro]" → ["caio","socorro"], "`vagao`" → "vagao", "{vagao: normal}" → { vagao: "normal" } */
function valorInicial(bruto: string): unknown {
  const s = semMarcacao(bruto);
  const mapa = s.match(/^\{(.*)\}$/);
  if (mapa) return Object.fromEntries(mapa[1].split(",").map((par) => par.split(":").map((x) => x.trim())).filter(([k]) => k));
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  const lista = s.match(/^\[(.*)\]$/);
  if (lista) return lista[1].split(",").map((x) => x.trim()).filter(Boolean);
  return s;
}

/** Estado inicial da história pela tabela "Estado da história" (`noite` / `hora` dividem a mesma linha). */
export function estadoInicialDaBiblia(md: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [nome, , inicio] of tabelaDaSecao(md, /Estado da hist/i)) {
    const nomes = semMarcacao(nome).split("/").map((x) => x.trim());
    const valores = semMarcacao(inicio ?? "").split(nomes.length > 1 ? "/" : /$^/).map((x) => x.trim());
    nomes.forEach((n, i) => (out[n] = valorInicial(valores[i] ?? "")));
  }
  return out;
}
