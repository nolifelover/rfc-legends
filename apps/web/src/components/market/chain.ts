"use client";

// Market-side chain helpers: tx runner with readable reverts, the wrong-chain
// guard, a double-click guard, and item display names.

import { createContext, useContext, useState } from "react";
import { formatUnits, type Abi } from "viem";
import { sepolia } from "viem/chains";
import type { Config } from "wagmi";
import { getConnection, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { createInFlight, TxRejected } from "./errors";
import { getItem } from "@/game/data/items";
import type { Hex } from "@/lib/worldid/types";

export const USDC_DECIMALS = 6;
export const fmtUsdc = (v: bigint) =>
  Number(formatUnits(v, USDC_DECIMALS)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export { createInFlight, describeError, TxRejected } from "./errors";

/**
 * simulate -> write -> wait. Simulating first means a contract rule (e.g.
 * RareMarket.NotVerifiedHuman) is shown as a readable rejection before the
 * wallet ever pops up. A dropped or slow tx times out instead of spinning
 * forever, and a revert names the tx.
 */
export async function runTx(
  config: Config,
  account: Hex,
  req: { address: Hex; abi: Abi; functionName: string; args: readonly unknown[]; revertHint?: string },
) {
  const { revertHint, ...call } = req;
  if (getConnection(config).chainId !== sepolia.id) await switchChain(config, { chainId: sepolia.id });
  const { request } = await simulateContract(config, { ...call, account, chainId: sepolia.id } as never);
  const hash = await writeContract(config, request as never);
  let receipt;
  try {
    receipt = await waitForTransactionReceipt(config, { hash, chainId: sepolia.id, timeout: 180_000 });
  } catch {
    throw new TxRejected(`Sent (${hash.slice(0, 10)}…) but not confirmed after 3 minutes. Check it on Etherscan before retrying.`);
  }
  if (receipt.status !== "success") {
    throw new TxRejected(`The transaction reverted onchain (${hash.slice(0, 10)}…). ${revertHint ?? "Nothing changed."}`, "Reverted");
  }
  return receipt;
}

/** True while the connected wallet is on another chain; tx buttons read it and stay disabled. */
export const TxBlockedContext = createContext(false);
export const useTxBlocked = () => useContext(TxBlockedContext);
export const WRONG_CHAIN_LABEL = "Switch to Sepolia first";

/** One guard per component instance: extra clicks while a flow runs are ignored. */
export function useSingleFlight() {
  const [guard] = useState(createInFlight);
  return guard;
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
