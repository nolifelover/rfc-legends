"use client";

// Market-side chain helpers: deployment config, tx runner with readable
// reverts, and item display names.

import { useQuery } from "@tanstack/react-query";
import { BaseError, ContractFunctionRevertedError, formatUnits, type Abi } from "viem";
import { sepolia } from "viem/chains";
import type { Config } from "wagmi";
import { getChainId, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import type { Deployment } from "@/lib/worldid/contracts";
import type { Hex } from "@/lib/worldid/types";

export const USDC_DECIMALS = 6;
export const fmtUsdc = (v: bigint) =>
  Number(formatUnits(v, USDC_DECIMALS)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function useDeployment() {
  return useQuery({
    queryKey: ["market-deployment"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ deployment: Deployment | null; dailyLimit: number }> => {
      const res = await fetch("/api/voucher/config", { cache: "no-store" });
      return res.json();
    },
  });
}

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

// TEMPORARY SHIM: display names until apps/web/src/game/data/items.ts (eth-dev2) exists.
export function itemInfo(itemId: number | bigint): { name: string; kind: string; glyph: string; tone: string } {
  const id = Number(itemId);
  if (id >= 3000) return { name: `MVP Card #${id}`, kind: "MVP Card", glyph: "👑", tone: "from-sun to-clay" };
  if (id >= 2000) return { name: `Legendary Gear #${id}`, kind: "Legendary", glyph: "🛡️", tone: "from-clay to-clay-deep" };
  if (id >= 1000) return { name: `Monster Card #${id}`, kind: "Monster Card", glyph: "🃏", tone: "from-field to-field-deep" };
  return { name: `Item #${id}`, kind: "Item", glyph: "📦", tone: "from-bark-soft to-bark" };
}
