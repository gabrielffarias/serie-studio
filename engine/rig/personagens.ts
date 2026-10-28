// Registro dos personagens do catálogo: desenho + poses (base + próprias).
import { readFileSync } from "node:fs";
import path from "node:path";
import { caio } from "../../assets/personagens/caio/rig.svg";
import { desenhavelHumano, type Desenhavel } from "./instancia";
import { resolverPose } from "./poses";
import type { PoseDef, PoseResolvida, VistaBase } from "./tipos";

const RAIZ = path.resolve(import.meta.dirname, "../..");
const lerJson = (p: string) => JSON.parse(readFileSync(path.join(RAIZ, p), "utf8"));

export const POSES_BASE: Record<string, PoseDef> = lerJson("engine/rig/poses-base.json");

export type Personagem = { d: Desenhavel; poses: Record<string, PoseDef> };

function humano(f: Parameters<typeof desenhavelHumano>[0]): Personagem {
  const proprias: Record<string, PoseDef> = lerJson(`assets/personagens/${f.id}/poses.json`);
  return { d: desenhavelHumano(f), poses: { ...POSES_BASE, ...proprias } };
}

export const PERSONAGENS: Record<string, Personagem> = {
  caio: humano(caio),
};

export function personagem(id: string): Personagem {
  const p = PERSONAGENS[id];
  if (!p) throw new Error(`personagem fora do catálogo: ${id}`);
  return p;
}

export function pose(id: string, nomePose: string, v: VistaBase, extras: Record<string, boolean> = {}): PoseResolvida {
  const p = personagem(id);
  const def = p.poses[nomePose];
  if (!def) throw new Error(`pose ${nomePose} não existe para ${id}`);
  return resolverPose(def, v, { ...p.d.acessoriosPadrao(), ...extras });
}
