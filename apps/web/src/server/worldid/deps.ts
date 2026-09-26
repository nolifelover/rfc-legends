// TEMPORARY SHIM: stands in for apps/web/src/server/game/index.ts (eth-dev2)
// until it is committed. Replace the body of getGameApi() with the real
// getPlayer / getDrop / listDrops / setDropStatus (docs/interfaces.md §5).

import type { Hex } from "../../lib/worldid/types";

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
 * Fake game data (one Lv 35 player per wallet with mintable drops) for local
 * UI work only. Off unless WORLDID_DEV_FIXTURES=true, and never in a
 * production build. It fakes the game, never World ID: verification always
 * goes through World's API.
 */
export function devFixturesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.WORLDID_DEV_FIXTURES === "true";
}

/** Until the game engine lands this is an empty world: every voucher request fails with "player not found". */
export async function getGameApi(): Promise<GameApi> {
  return devFixturesEnabled() ? devFixtureGame : emptyGame;
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
