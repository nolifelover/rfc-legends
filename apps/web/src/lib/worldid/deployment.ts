// Which deployed contracts the drop economy talks to. Addresses come from
// eth-dev1's generated lib/contracts/addresses.ts; the market runs on Sepolia.

import { ADDRESSES, type ChainAddresses } from "../contracts/addresses";

export const MARKET_CHAIN_ID = 11155111;

export type Deployment = ChainAddresses & { chainId: number };

/** null until contracts are deployed to `chainId` and exported. */
export function getDeployment(chainId: number = MARKET_CHAIN_ID): Deployment | null {
  const addresses = ADDRESSES[chainId] as ChainAddresses | undefined;
  return addresses ? { chainId, ...addresses } : null;
}
