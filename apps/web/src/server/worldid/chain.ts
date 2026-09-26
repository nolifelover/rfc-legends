// Wires the voucher logic to the real game API, store and Sepolia.

import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { rareItemsAbi } from "../../lib/contracts/abis";
import { getDeployment } from "../../lib/worldid/deployment";
import type { Hex } from "../../lib/worldid/types";
import { getGameApi } from "./deps";
import { getWorldIdStore } from "./runtime";
import type { ConfirmDeps, VoucherDeps } from "./voucher";

function publicClient() {
  const rpc = process.env.SEPOLIA_RPC_URL?.trim() || process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || undefined;
  return createPublicClient({ chain: sepolia, transport: http(rpc) });
}

export function dailyMintLimit(): number {
  const n = Number(process.env.MINT_DAILY_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : 3;
}

export async function resolveVoucherDeps(): Promise<VoucherDeps> {
  const deployment = getDeployment();
  const client = deployment ? publicClient() : null;
  return {
    store: getWorldIdStore(),
    game: await getGameApi(),
    rareItems: deployment ? { chainId: deployment.chainId, address: deployment.RareItems } : null,
    signerKey: process.env.GAME_SIGNER_PRIVATE_KEY?.trim(),
    isDropMintedOnchain:
      client && deployment
        ? (dropId: Hex) =>
            client.readContract({
              address: deployment.RareItems,
              abi: rareItemsAbi,
              functionName: "dropMinted",
              args: [dropId],
            })
        : undefined,
    dailyLimit: dailyMintLimit(),
  };
}

export async function resolveConfirmDeps(): Promise<ConfirmDeps> {
  const deployment = getDeployment();
  const client = publicClient();
  return {
    game: await getGameApi(),
    rareItems: deployment ? { address: deployment.RareItems } : null,
    getReceipt: async (hash) => {
      try {
        const r = await client.getTransactionReceipt({ hash });
        return { status: r.status, logs: r.logs };
      } catch {
        return null;
      }
    },
  };
}
