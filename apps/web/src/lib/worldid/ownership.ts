// The message a wallet signs (EIP-191 personal_sign) to prove it is the one
// asking. Shared by the browser (to sign) and the server (to rebuild and verify).

import type { Hex } from "./types";

export type OwnershipPurpose = "verify-world-id" | "mint-rare-drop";

/** A signature is accepted for at most this long. */
export const OWNERSHIP_MAX_TTL_SECONDS = 10 * 60;

export function ownershipMessage(p: {
  purpose: OwnershipPurpose;
  address: string;
  nonce: string;
  expiresAt: number;
  dropId?: string;
}): string {
  return [
    "RFC Legends: confirm this is your wallet.",
    `Action: ${p.purpose}`,
    `Wallet: ${p.address.toLowerCase()}`,
    ...(p.dropId ? [`Drop: ${p.dropId.toLowerCase()}`] : []),
    `Nonce: ${p.nonce}`,
    `Expires: ${new Date(p.expiresAt * 1000).toISOString()}`,
    "Signing is free and doesn't send a transaction.",
  ].join("\n");
}

/** 16 random bytes as 0x-hex, for mint signatures. */
export function randomNonce(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
