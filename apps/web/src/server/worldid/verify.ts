// POST /api/worldid/verify, minus the HTTP layer. Order of checks:
//   1. body shape + wallet address
//   2. wallet ownership: EIP-191 signature over (wallet, RP nonce, expiry)
//   3. result pinned to one proof-of-human response, our action / environment,
//      World ID 4.0, and the wallet as signal
//   4. RP nonce was issued by us, for this wallet, and is unexpired
//   5. proof verified by World's Portal; we bind only the nullifier it confirms
//   6. nonce consumed (single use), then the nullifier <-> wallet binding is
//      reserved by a UNIQUE-index insert
//   7. HumanRegistry.markVerified mirrored onchain with GAME_SIGNER
//
// World's Portal accepts nullifier reuse (a repeat verification succeeds), so
// step 6 is the sybil guard, backed onchain by HumanRegistry.

import { getAddress, isAddress } from "viem";
import { z } from "zod";
import type { Hex, VerifyRejectCode, VerifyResponse } from "../../lib/worldid/types";
import type { WorldIdConfig } from "./config";
import { maskAddress } from "./nullifier";
import { checkOwnership, ownershipSchema } from "./ownership";
import { idkitResultSchema, precheckResult, verifyWithPortal } from "./portal";
import type { HumanRegistryClient } from "./registry";
import type { NonceCheck, OnchainStatus, WorldIdStore } from "./store";

export type VerifyDeps = {
  cfg: WorldIdConfig;
  store: WorldIdStore;
  fetchImpl?: typeof fetch;
  registry: HumanRegistryClient | null;
  /** Why `registry` is null, echoed to the client. */
  registryNote?: string;
  now?: () => Date;
};

export type VerifyOutcome = { status: number; body: VerifyResponse };

const bodySchema = z.object({
  address: z.string().refine((a) => isAddress(a, { strict: false }), "not an address"),
  result: idkitResultSchema,
  ownership: ownershipSchema,
});

function reject(status: number, code: VerifyRejectCode, reason: string, boundTo?: string): VerifyOutcome {
  return { status, body: { verified: false, code, reason, ...(boundTo ? { boundTo } : {}) } };
}

function secondWallet(boundTo: string): VerifyOutcome {
  return reject(
    409,
    "nullifier_bound_to_other_wallet",
    `This World ID is already linked to wallet ${maskAddress(boundTo)}. One human, one wallet: a second wallet can't verify with the same World ID.`,
    maskAddress(boundTo),
  );
}

function nonceReject(status: Exclude<NonceCheck, "ok">): VerifyOutcome {
  return status === "expired"
    ? reject(403, "nonce_expired", "The verification request expired. Start again.")
    : reject(403, "nonce_unknown", "This verification request is unknown, already used, or for another wallet. Start again.");
}

export async function verifyHuman(input: unknown, deps: VerifyDeps): Promise<VerifyOutcome> {
  const now = deps.now ?? (() => new Date());
  const nowSeconds = () => Math.floor(now().getTime() / 1000);

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return reject(400, "invalid_request", "Request must include a wallet address, the IDKit result and a wallet signature.");
  }
  const address = getAddress(parsed.data.address).toLowerCase() as Hex;
  const { result, ownership } = parsed.data;

  const badSignature = await checkOwnership(
    { purpose: "verify-world-id", address, nonce: result.nonce, expiresAt: ownership.expiresAt, signature: ownership.signature },
    nowSeconds(),
  );
  if (badSignature) return reject(401, "bad_signature", badSignature);

  const pre = precheckResult(result, address, deps.cfg);
  if (pre) return reject(403, pre.code, pre.reason);

  const nonce = await deps.store.checkNonce(result.nonce, address, nowSeconds());
  if (nonce !== "ok") return nonceReject(nonce);

  const portal = await verifyWithPortal(result, address, deps.cfg, deps.fetchImpl);
  if (!portal.ok) return reject(portal.code === "portal_unreachable" ? 502 : 403, portal.code, portal.reason);
  const nullifier = portal.nullifier;

  const consumed = await deps.store.consumeNonce(result.nonce, address, nowSeconds());
  if (consumed !== "ok") return nonceReject(consumed);

  const reservation = await deps.store.reserveBinding(nullifier, address, now().toISOString());
  if (reservation.kind === "nullifier_taken") return secondWallet(reservation.boundTo);
  if (reservation.kind === "wallet_taken") {
    return reject(
      409,
      "wallet_already_verified",
      "This wallet is already verified with a different World ID. One wallet, one human.",
    );
  }
  const release = () => (reservation.kind === "new" ? deps.store.releaseBinding(nullifier, address) : Promise.resolve());

  // Mirror onchain. The contract enforces the same rule, so a stale local
  // store can't let a second wallet through.
  let txHash: Hex | null = null;
  let onchain: OnchainStatus = "skipped";
  if (deps.registry) {
    try {
      const n = BigInt(nullifier);
      const owner = await deps.registry.nullifierOwner(n);
      if (owner && owner !== address) {
        await release();
        return secondWallet(owner);
      }
      if (owner === address) {
        onchain = "already_marked";
      } else {
        txHash = await deps.registry.markVerified(address, n);
        onchain = "marked";
      }
    } catch (err) {
      await release();
      return reject(
        502,
        "onchain_failed",
        `Proof is valid, but recording it onchain failed: ${err instanceof Error ? err.message : String(err)}. Try again.`,
      );
    }
  }

  await deps.store.finalizeBinding(nullifier, address, { verifiedAt: now().toISOString(), txHash, onchain });

  return {
    status: 200,
    body: {
      verified: true,
      address,
      txHash,
      onchain,
      ...(onchain === "skipped" && deps.registryNote ? { onchainNote: deps.registryNote } : {}),
    },
  };
}
