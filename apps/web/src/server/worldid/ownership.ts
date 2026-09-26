// Server side of the wallet-ownership proof: rebuild the message, check the
// expiry window, and recover the signer with viem.

import { verifyMessage } from "viem";
import { z } from "zod";
import { OWNERSHIP_MAX_TTL_SECONDS, ownershipMessage, type OwnershipPurpose } from "../../lib/worldid/ownership";
import type { Hex } from "../../lib/worldid/types";

export const ownershipSchema = z.object({
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  expiresAt: z.number().int().positive(),
  nonce: z.string().min(8).max(130).optional(),
});

export async function checkOwnership(
  p: { purpose: OwnershipPurpose; address: Hex; nonce: string; expiresAt: number; signature: string; dropId?: Hex },
  nowSeconds: number,
): Promise<string | null> {
  if (p.expiresAt < nowSeconds) return "Your wallet signature expired. Try again.";
  if (p.expiresAt > nowSeconds + OWNERSHIP_MAX_TTL_SECONDS) return "Wallet signature expiry is too far in the future.";
  const message = ownershipMessage(p);
  const ok = await verifyMessage({ address: p.address, message, signature: p.signature as Hex }).catch(() => false);
  return ok ? null : "The wallet signature doesn't match this wallet. Sign again from the connected wallet.";
}
