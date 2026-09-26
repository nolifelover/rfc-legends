// POST /api/voucher/mint and /api/voucher/confirm, minus the HTTP layer.
//
// Mint checks run in this order, and the first failure is the reason shown:
//   1. verified human (World ID, one human = one wallet)
//   2. Base Lv >= 30
//   3. drop owned + unminted + mintable rarity
//   4. daily mint limit
// Only then does GAME_SIGNER sign the EIP-712 MintVoucher (docs/interfaces.md §4.2).

import { decodeEventLog, getAddress, isAddress, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { MINT_VOUCHER_TYPE, rareItemsDomain } from "../../lib/contracts/eip712";
import { rareItemsAbi } from "../../lib/worldid/contracts";
import type { Hex, VoucherRejectCode, VoucherResponse } from "../../lib/worldid/types";
import type { Drop, GameApi } from "./deps";
import { maskAddress } from "./nullifier";
import type { WorldIdStore } from "./store";

export const MIN_BASE_LEVEL = 30;
export const MINTABLE_RARITIES: ReadonlySet<Drop["rarity"]> = new Set(["legendary", "monster_card", "mvp_card"]);
const VOUCHER_TTL_SECONDS = 15 * 60;

export type VoucherDeps = {
  store: WorldIdStore;
  game: GameApi;
  /** null until contracts are deployed. */
  rareItems: { chainId: number; address: Hex } | null;
  signerKey?: string;
  /** Reads RareItems.dropMinted onchain, when available. */
  isDropMintedOnchain?: (dropId: Hex) => Promise<boolean>;
  dailyLimit: number;
  now?: () => Date;
};

export type VoucherOutcome = { status: number; body: VoucherResponse };

const bytes32 = z.string().refine((v) => isHex(v) && v.length === 66, "dropId must be bytes32 hex");
const mintBody = z.object({
  address: z.string().refine((a) => isAddress(a, { strict: false }), "not an address"),
  dropId: bytes32,
});

function reject(status: number, code: VoucherRejectCode, reason: string): VoucherOutcome {
  return { status, body: { ok: false, code, reason } };
}

export const utcDay = (d: Date) => d.toISOString().slice(0, 10);

export async function issueMintVoucher(input: unknown, deps: VoucherDeps): Promise<VoucherOutcome> {
  const now = deps.now ?? (() => new Date());
  const parsed = mintBody.safeParse(input);
  if (!parsed.success) return reject(400, "invalid_request", "Request must include a wallet address and a bytes32 dropId.");
  const address = getAddress(parsed.data.address).toLowerCase() as Hex;
  const dropId = parsed.data.dropId.toLowerCase() as Hex;

  // 1. Verified human
  const state = await deps.store.read();
  if (!state.humans[address]) {
    return reject(
      403,
      "not_verified_human",
      `Wallet ${maskAddress(address)} hasn't verified with World ID. Only verified humans can mint rare drops, so bot farms can't cash out.`,
    );
  }

  // 2. Base level
  const player = await deps.game.getPlayer(address);
  if (!player) return reject(403, "player_not_found", "No character found for this wallet. Start the game first.");
  if (player.baseLevel < MIN_BASE_LEVEL) {
    return reject(
      403,
      "base_level_too_low",
      `Base Lv ${player.baseLevel}: reach Base Lv ${MIN_BASE_LEVEL} to mint rare drops.`,
    );
  }

  // 3. Drop owned, unminted, mintable
  const drop = await deps.game.getDrop(address, dropId);
  if (!drop) return reject(403, "drop_not_found", "This drop isn't in your inventory.");
  if (drop.status === "minted") return reject(403, "drop_already_minted", "This drop has already been minted.");
  if (deps.isDropMintedOnchain && (await deps.isDropMintedOnchain(dropId))) {
    await deps.game.setDropStatus(address, dropId, "minted");
    return reject(403, "drop_already_minted", "This drop has already been minted onchain.");
  }
  if (!MINTABLE_RARITIES.has(drop.rarity) || drop.itemId < 1000) {
    return reject(
      403,
      "drop_not_mintable",
      `${labelRarity(drop.rarity)} items stay in-game. Only Legendary, Monster Card and MVP Card drops can be minted.`,
    );
  }

  // 4. Daily limit (re-issuing a voucher for the same drop doesn't count again)
  const day = utcDay(now());
  const issuedToday = state.vouchers[address]?.[day] ?? [];
  if (!issuedToday.includes(dropId) && issuedToday.length >= deps.dailyLimit) {
    return reject(
      403,
      "daily_limit_reached",
      `Daily mint limit reached (${issuedToday.length}/${deps.dailyLimit} today). It resets at 00:00 UTC.`,
    );
  }

  if (!deps.rareItems || !deps.signerKey || !/^0x[0-9a-fA-F]{64}$/.test(deps.signerKey)) {
    return reject(503, "not_configured", "Minting isn't available yet: contracts or GAME_SIGNER aren't configured.");
  }

  // Record the issuance atomically, re-checking the limit under the lock.
  const recorded = await deps.store.update((s) => {
    const list = ((s.vouchers[address] ??= {})[day] ??= []);
    if (list.includes(dropId)) return list.length;
    if (list.length >= deps.dailyLimit) return null;
    list.push(dropId);
    return list.length;
  });
  if (recorded === null) {
    return reject(403, "daily_limit_reached", `Daily mint limit reached (${deps.dailyLimit}/${deps.dailyLimit} today).`);
  }

  const voucher = {
    to: address,
    itemId: BigInt(drop.itemId),
    amount: BigInt(1),
    dropId,
    deadline: BigInt(Math.floor(now().getTime() / 1000) + VOUCHER_TTL_SECONDS),
  };
  const signer = privateKeyToAccount(deps.signerKey as Hex);
  const signature = await signer.signTypedData({
    domain: rareItemsDomain(deps.rareItems.chainId, deps.rareItems.address),
    types: { MintVoucher: MINT_VOUCHER_TYPE },
    primaryType: "MintVoucher",
    message: voucher,
  });
  await deps.game.setDropStatus(address, dropId, "minting");

  return {
    status: 200,
    body: {
      ok: true,
      voucher: {
        to: voucher.to,
        itemId: voucher.itemId.toString(),
        amount: voucher.amount.toString(),
        dropId: voucher.dropId,
        deadline: voucher.deadline.toString(),
      },
      signature,
      rareItems: deps.rareItems.address,
      chainId: deps.rareItems.chainId,
      mintsToday: recorded,
      dailyLimit: deps.dailyLimit,
    },
  };
}

function labelRarity(r: Drop["rarity"]): string {
  return { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary", monster_card: "Monster Card", mvp_card: "MVP Card" }[r];
}

// ---- confirm ----------------------------------------------------------------

export type ReceiptLike = {
  status: "success" | "reverted";
  logs: { address: string; topics: readonly Hex[] | Hex[]; data: Hex }[];
};

const confirmBody = z.object({
  address: z.string().refine((a) => isAddress(a, { strict: false }), "not an address"),
  dropId: bytes32,
  txHash: z.string().refine((v) => isHex(v) && v.length === 66, "txHash must be 32-byte hex"),
});

export type ConfirmDeps = {
  game: GameApi;
  rareItems: { address: Hex } | null;
  getReceipt: (txHash: Hex) => Promise<ReceiptLike | null>;
};

/**
 * Marks a drop minted only after the chain says so: the tx must contain a
 * RareMinted event from our RareItems contract for this wallet and dropId.
 */
export async function confirmMint(
  input: unknown,
  deps: ConfirmDeps,
): Promise<{ status: number; body: { ok: boolean; reason?: string } }> {
  const parsed = confirmBody.safeParse(input);
  if (!parsed.success) return { status: 400, body: { ok: false, reason: "address, dropId and txHash are required." } };
  if (!deps.rareItems) return { status: 503, body: { ok: false, reason: "Contracts aren't deployed yet." } };
  const address = parsed.data.address.toLowerCase();
  const dropId = parsed.data.dropId.toLowerCase();

  const receipt = await deps.getReceipt(parsed.data.txHash as Hex);
  if (!receipt) return { status: 404, body: { ok: false, reason: "Transaction not found yet." } };
  if (receipt.status !== "success") return { status: 409, body: { ok: false, reason: "Mint transaction reverted." } };

  const minted = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== deps.rareItems!.address.toLowerCase()) return false;
    try {
      const ev = decodeEventLog({ abi: rareItemsAbi, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      return (
        ev.eventName === "RareMinted" &&
        ev.args.to.toLowerCase() === address &&
        ev.args.dropId.toLowerCase() === dropId
      );
    } catch {
      return false;
    }
  });
  if (!minted) return { status: 409, body: { ok: false, reason: "No RareMinted event for this drop in that transaction." } };

  await deps.game.setDropStatus(address, dropId as Hex, "minted", parsed.data.txHash);
  return { status: 200, body: { ok: true } };
}
