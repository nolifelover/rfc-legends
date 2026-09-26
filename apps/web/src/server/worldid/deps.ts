// TEMPORARY SHIMS for things other lanes own. Each one names what replaces it.
//
// 1. loadDeployment(): reads contracts/deployments/sepolia.json directly.
//    Replace with apps/web/src/lib/contracts/addresses.ts (eth-dev1).
// 2. gameApi: stands in for apps/web/src/server/game/index.ts (eth-dev2).
//    Replace the body of getGameApi() with `return import("../game")`-style
//    re-exports of getPlayer / getDrop / listDrops / setDropStatus.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Deployment } from "../../lib/worldid/contracts";
import type { Hex } from "../../lib/worldid/types";

export async function loadDeployment(): Promise<Deployment | null> {
  const file = path.resolve(process.cwd(), "..", "..", "contracts", "deployments", "sepolia.json");
  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<Deployment>;
    if (!parsed.HumanRegistry || !parsed.RareItems || !parsed.RareMarket || !parsed.MockUSDC) return null;
    return { chainId: 11155111, ...parsed } as Deployment;
  } catch {
    return null;
  }
}

// ---- game API (docs/interfaces.md §5) -------------------------------------

export type Rarity = "common" | "rare" | "epic" | "legendary" | "monster_card" | "mvp_card";
export type DropStatus = "unminted" | "minting" | "minted";

export type Player = { address: string; name?: string; baseLevel: number; jobLevel?: number };
export type Drop = {
  dropId: Hex;
  itemId: number;
  rarity: Rarity;
  status: DropStatus;
  droppedAt: number | string;
};

export type GameApi = {
  getPlayer(address: string): Promise<Player | null>;
  getDrop(address: string, dropId: Hex): Promise<Drop | null>;
  listDrops(address: string): Promise<Drop[]>;
  setDropStatus(address: string, dropId: Hex, status: DropStatus, txHash?: string): Promise<void>;
};

/**
 * Until the game engine lands this returns an empty world: no players, no
 * drops, so every voucher request fails with "player not found". Set
 * WORLDID_DEV_FIXTURES=true to get one Lv 35 player per wallet with three
 * mintable drops, for building the market UI before the engine exists.
 */
export async function getGameApi(): Promise<GameApi> {
  return process.env.WORLDID_DEV_FIXTURES === "true" ? devFixtureGame : emptyGame;
}

const emptyGame: GameApi = {
  getPlayer: async () => null,
  getDrop: async () => null,
  listDrops: async () => [],
  setDropStatus: async () => {},
};

const fixtureStatus = new Map<string, DropStatus>();

function fixtureDrops(address: string): Drop[] {
  const a = address.toLowerCase().replace(/^0x/, "").padStart(40, "0");
  const mk = (n: number, itemId: number, rarity: Rarity): Drop => {
    const dropId = `0x${a}${n.toString(16).padStart(24, "0")}` as Hex;
    return { dropId, itemId, rarity, status: fixtureStatus.get(dropId) ?? "unminted", droppedAt: Date.now() - n * 60_000 };
  };
  return [mk(1, 1001, "monster_card"), mk(2, 3001, "mvp_card"), mk(3, 2001, "legendary"), mk(4, 12, "epic")];
}

const devFixtureGame: GameApi = {
  getPlayer: async (address) => ({ address: address.toLowerCase(), name: "นายไก่ (dev)", baseLevel: 35, jobLevel: 12 }),
  getDrop: async (address, dropId) =>
    fixtureDrops(address).find((d) => d.dropId.toLowerCase() === dropId.toLowerCase()) ?? null,
  listDrops: async (address) => fixtureDrops(address),
  setDropStatus: async (_address, dropId, status) => {
    fixtureStatus.set(dropId.toLowerCase(), status);
  },
};
