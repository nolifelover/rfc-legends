// POST /api/worldid/verify, minus the HTTP layer. Order of checks:
//   1. body shape + wallet address
//   2. result pinned to our action / environment / protocol / wallet signal
//   3. RP nonce was issued by us, for this wallet, unexpired, unused
//   4. proof verified by World's Portal (we take the nullifier from there)
//   5. nullifier not bound to another wallet (server store, then onchain)
//   6. HumanRegistry.markVerified mirrored onchain with GAME_SIGNER

import { getAddress, isAddress } from "viem";
import { z } from "zod";
import type { Hex, VerifyRejectCode, VerifyResponse } from "../../lib/worldid/types";
import type { WorldIdConfig } from "./config";
import { decideBinding, maskAddress } from "./nullifier";
import { idkitResultSchema, precheckResult, verifyWithPortal } from "./portal";
import type { HumanRegistryClient } from "./registry";
import type { OnchainStatus, WorldIdStore } from "./store";

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

export async function verifyHuman(input: unknown, deps: VerifyDeps): Promise<VerifyOutcome> {
  const now = deps.now ?? (() => new Date());

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return reject(400, "invalid_request", "Request must include a wallet address and the IDKit result.");
  }
  const address = getAddress(parsed.data.address).toLowerCase() as Hex;
  const result = parsed.data.result;

  const pre = precheckResult(result, address, deps.cfg);
  if (pre) return reject(403, pre.code, pre.reason);

  const nonceProblem = checkNonce((await deps.store.read()).nonces[result.nonce], address, now());
  if (nonceProblem) return reject(403, nonceProblem.code, nonceProblem.reason);

  const portal = await verifyWithPortal(result, address, deps.cfg, deps.fetchImpl);
  if (!portal.ok) return reject(portal.code === "portal_unreachable" ? 502 : 403, portal.code, portal.reason);
  const nullifier = portal.nullifier;

  // Consume the nonce and reserve the nullifier atomically.
  const reservation = await deps.store.update((state) => {
    const again = checkNonce(state.nonces[result.nonce], address, now());
    if (again) return { kind: "nonce" as const, ...again };
    state.nonces[result.nonce].usedAt = now().toISOString();

    const decision = decideBinding(state, address, nullifier);
    if (decision.kind === "other") return { kind: "other" as const, boundTo: decision.boundTo };
    if (decision.kind === "new") {
      state.bindings[nullifier] = { address, status: "pending", verifiedAt: now().toISOString(), txHash: null };
    }
    return { kind: decision.kind };
  });
  if (reservation.kind === "nonce") return reject(403, reservation.code, reservation.reason);
  if (reservation.kind === "other") return secondWallet(reservation.boundTo);

  const release = async () => {
    if (reservation.kind !== "new") return;
    await deps.store.update((state) => {
      if (state.bindings[nullifier]?.status === "pending" && state.bindings[nullifier].address === address) {
        delete state.bindings[nullifier];
      }
    });
  };

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

  const verifiedAt = now().toISOString();
  await deps.store.update((state) => {
    state.bindings[nullifier] = { address, status: "verified", verifiedAt, txHash, onchain };
    state.humans[address] = { nullifier, verifiedAt, txHash, onchain };
  });

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

function checkNonce(
  entry: { address: Hex; expiresAt: number; usedAt?: string } | undefined,
  address: Hex,
  now: Date,
): { code: VerifyRejectCode; reason: string } | null {
  if (!entry || entry.address !== address) {
    return { code: "nonce_unknown", reason: "This verification request wasn't issued for this wallet. Start again." };
  }
  if (entry.usedAt) return { code: "nonce_used", reason: "This proof was already used. Start a new verification." };
  if (entry.expiresAt < Math.floor(now.getTime() / 1000)) {
    return { code: "nonce_expired", reason: "The verification request expired. Start again." };
  }
  return null;
}
