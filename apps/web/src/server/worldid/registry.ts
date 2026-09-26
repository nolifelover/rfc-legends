// Mirrors a server-side World ID verification onchain via
// HumanRegistry.markVerified(account, nullifier), signed by GAME_SIGNER.

import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, http, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { humanRegistryAbi } from "../../lib/contracts/abis";
import { getDeployment } from "../../lib/worldid/deployment";
import type { Hex } from "../../lib/worldid/types";

export interface HumanRegistryClient {
  /** Account the nullifier is bound to onchain, or null if unbound. */
  nullifierOwner(nullifier: bigint): Promise<Hex | null>;
  isVerified(address: Hex): Promise<boolean>;
  /** Sends markVerified and waits for the receipt. Throws with a readable message on revert. */
  markVerified(address: Hex, nullifier: bigint): Promise<Hex>;
}

export type RegistryResolution = { client: HumanRegistryClient } | { client: null; note: string };

export async function resolveHumanRegistry(env: NodeJS.ProcessEnv = process.env): Promise<RegistryResolution> {
  const deployment = getDeployment();
  if (!deployment) {
    return { client: null, note: "Contracts not deployed to Sepolia yet; onchain mirror skipped." };
  }
  const key = env.GAME_SIGNER_PRIVATE_KEY?.trim();
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    return { client: null, note: "GAME_SIGNER_PRIVATE_KEY not set; onchain mirror skipped." };
  }
  const rpc = env.SEPOLIA_RPC_URL?.trim() || env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim() || undefined;
  const transport = http(rpc);
  const signer = privateKeyToAccount(key as Hex);
  const publicClient = createPublicClient({ chain: sepolia, transport });
  const walletClient = createWalletClient({ chain: sepolia, transport, account: signer });
  const address = deployment.HumanRegistry;

  return {
    client: {
      async nullifierOwner(nullifier) {
        const owner = await publicClient.readContract({
          address,
          abi: humanRegistryAbi,
          functionName: "nullifierOwner",
          args: [nullifier],
        });
        return owner === zeroAddress ? null : (owner.toLowerCase() as Hex);
      },
      async isVerified(player) {
        return publicClient.readContract({ address, abi: humanRegistryAbi, functionName: "isVerified", args: [player] });
      },
      async markVerified(player, nullifier) {
        try {
          const { request } = await publicClient.simulateContract({
            address,
            abi: humanRegistryAbi,
            functionName: "markVerified",
            args: [player, nullifier],
            account: signer,
          });
          const hash = await walletClient.writeContract(request);
          const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
          if (receipt.status !== "success") throw new Error(`markVerified reverted in tx ${hash}`);
          return hash;
        } catch (err) {
          throw new Error(describeRevert(err));
        }
      },
    },
  };
}

function describeRevert(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      const args = revert.data.args?.map(String).join(", ") ?? "";
      return `HumanRegistry reverted: ${revert.data.errorName}(${args})`;
    }
    return err.shortMessage;
  }
  return err instanceof Error ? err.message : String(err);
}
