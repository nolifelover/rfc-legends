import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { SEPOLIA_RPC_URL, ENS_OWNER_PRIVATE_KEY } from './config';

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
});

export const ownerAccount = privateKeyToAccount(ENS_OWNER_PRIVATE_KEY as `0x${string}`);

export const ownerWallet = createWalletClient({
  account: ownerAccount,
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
});

export function farmWallet(pk?: string) {
  if (!pk) throw new Error('FARM_SIGNER_PRIVATE_KEY not set');
  return createWalletClient({
    account: privateKeyToAccount(pk as `0x${string}`),
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  });
}

/** Arbitrary wallet (e.g. the RoosterRWA owner) against the configured RPC. */
export function walletFor(pk: string) {
  return createWalletClient({
    account: privateKeyToAccount(pk as `0x${string}`),
    chain: sepolia,
    transport: http(SEPOLIA_RPC_URL),
  });
}

/** Send a tx and wait for the receipt; throws with the revert reason on failure. */
export async function send(label: string, wallet: typeof ownerWallet, args: Parameters<typeof wallet.writeContract>[0]) {
  const hash = await wallet.writeContract(args);
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== 'success') {
    throw new Error(`${label} failed (tx ${hash} reverted)`);
  }
  console.log(`  ✓ ${label} tx=${hash} block=${receipt.blockNumber} gas=${receipt.gasUsed}`);
  return { hash, receipt };
}
