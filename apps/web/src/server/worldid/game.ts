// The slice of the game engine's server API (docs/interfaces.md §5) that the
// drop economy uses. Injected into the voucher logic so tests can use a fake.

import { getDrop, getPlayer, listDrops, setDropStatus } from "../game";
import type { Drop, DropStatus, Player } from "../../game/types";
import type { Hex } from "../../lib/worldid/types";

export type { Drop, DropStatus };
export type Rarity = Drop["rarity"];
export type PlayerView = Pick<Player, "address" | "baseLevel"> & { name?: string };

export type GameApi = {
  getPlayer(address: string): Promise<PlayerView | null>;
  getDrop(address: string, dropId: Hex): Promise<Drop | null>;
  listDrops(address: string): Promise<Drop[]>;
  /** Forward-only: unminted -> minting -> minted (minting -> unminted = rollback). Throws otherwise. */
  setDropStatus(address: string, dropId: Hex, status: DropStatus, txHash?: string): Promise<void>;
};

export const gameApi: GameApi = { getPlayer, getDrop, listDrops, setDropStatus };
