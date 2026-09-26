"use client";

// Market-side chain helpers: tx runner with readable reverts, and item display names.

import { BaseError, ContractFunctionRevertedError, formatUnits, type Abi } from "viem";
import { sepolia } from "viem/chains";
import type { Config } from "wagmi";
import { getChainId, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { getItem } from "@/game/data/items";
import type { Hex } from "@/lib/worldid/types";

export const USDC_DECIMALS = 6;
export const fmtUsdc = (v: bigint) =>
  Number(formatUnits(v, USDC_DECIMALS)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export class TxRejected extends Error {
  constructor(
    message: string,
    readonly errorName?: string,
  ) {
    super(message);
  }
}

/** Turns a viem/wagmi error into one readable line, naming the custom error when there is one. */
export function describeError(err: unknown): { message: string; errorName?: string } {
  if (err instanceof TxRejected) return { message: err.message, errorName: err.errorName };
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      const args = (revert.data.args ?? []).map((a) => String(a)).join(", ");
      return { message: `${revert.data.errorName}(${args})`, errorName: revert.data.errorName };
    }
    if (err.walk((e) => (e as { name?: string }).name === "UserRejectedRequestError")) {
      return { message: "You rejected the transaction in your wallet." };
    }
    return { message: err.shortMessage };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}

/**
 * simulate -> write -> wait. Simulating first means a contract rule (e.g.
 * RareMarket.NotVerifiedHuman) is shown as a readable rejection before the
 * wallet ever pops up.
 */
export async function runTx(
  config: Config,
  account: Hex,
  req: { address: Hex; abi: Abi; functionName: string; args: readonly unknown[] },
) {
  if (getChainId(config) !== sepolia.id) await switchChain(config, { chainId: sepolia.id });
  const { request } = await simulateContract(config, { ...req, account, chainId: sepolia.id } as never);
  const hash = await writeContract(config, request as never);
  const receipt = await waitForTransactionReceipt(config, { hash, chainId: sepolia.id });
  if (receipt.status !== "success") throw new TxRejected(`Transaction reverted: ${hash}`);
  return receipt;
}

export type ItemInfo = { name: string; thai?: string; image?: string; kind: string; glyph: string; tone: string };

/** English-first display name plus the game catalog's Thai name and art (game/data/items.ts). */
export function itemInfo(itemId: number | bigint): ItemInfo {
  const id = Number(itemId);
  const def = getItem(id);
  const extra = { thai: def?.name, image: def?.image };
  if (id >= 3000) return { name: `MVP Card #${id}`, kind: "MVP Card", glyph: def?.emoji ?? "👑", tone: "from-sun to-clay", ...extra };
  if (id >= 2000) return { name: `Legendary Gear #${id}`, kind: "Legendary", glyph: def?.emoji ?? "🛡️", tone: "from-clay to-clay-deep", ...extra };
  if (id >= 1000) return { name: `Monster Card #${id}`, kind: "Monster Card", glyph: def?.emoji ?? "🃏", tone: "from-field to-field-deep", ...extra };
  return { name: `Item #${id}`, kind: "Item", glyph: def?.emoji ?? "📦", tone: "from-bark-soft to-bark", ...extra };
}
