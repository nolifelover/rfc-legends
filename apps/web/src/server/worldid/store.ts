// Persistent state for the World ID lane, as domain operations. Every
// operation that guards against sybils or replays is atomic in the backing
// store: PocketBase does it with UNIQUE-index inserts and single-row deletes
// (store-pb.ts); the in-memory store (tests) does it under one lock.

import type { Hex } from "../../lib/worldid/types";

export type OnchainStatus = "marked" | "already_marked" | "skipped";

export type Binding = {
  nullifier: string;
  address: Hex;
  /** "pending" while the onchain mirror is in flight; it still reserves both keys. */
  status: "pending" | "verified";
  verifiedAt: string;
  txHash: Hex | null;
  onchain: OnchainStatus | null;
};

export type ReserveResult =
  | { kind: "new" }
  | { kind: "same" }
  /** The World ID already backs another wallet: the same human's second wallet. */
  | { kind: "nullifier_taken"; boundTo: Hex }
  /** This wallet is already backed by a different World ID. */
  | { kind: "wallet_taken" };

export type NonceCheck = "ok" | "unknown" | "expired";

export interface WorldIdStore {
  /** Remembers an RP nonce issued for `address`. */
  putNonce(nonce: string, address: Hex, expiresAt: number): Promise<void>;
  /** Read-only: may this nonce still be used by this wallet? */
  checkNonce(nonce: string, address: Hex, nowSeconds: number): Promise<NonceCheck>;
  /** Single use: "ok" for exactly one caller, then the nonce is gone ("unknown"). */
  consumeNonce(nonce: string, address: Hex, nowSeconds: number): Promise<NonceCheck>;

  /** Atomic: one nullifier per wallet and one wallet per nullifier. */
  reserveBinding(nullifier: string, address: Hex, at: string): Promise<ReserveResult>;
  finalizeBinding(
    nullifier: string,
    address: Hex,
    patch: { verifiedAt: string; txHash: Hex | null; onchain: OnchainStatus },
  ): Promise<void>;
  /** Drops a still-pending reservation (e.g. the onchain write failed). */
  releaseBinding(nullifier: string, address: Hex): Promise<void>;
  getVerifiedHuman(address: Hex): Promise<Binding | null>;

  /** Replay guard for wallet signatures: true the first time a key is seen. */
  useOnce(key: string, address: Hex, expiresAt: number): Promise<boolean>;

  /** dropIds a voucher was issued for on `day` (UTC YYYY-MM-DD). */
  vouchersOn(address: Hex, day: string): Promise<Hex[]>;
  /** Atomic: records a voucher slot. Returns slots used, or null if the limit is reached. Same drop = same slot. */
  claimVoucherSlot(address: Hex, day: string, dropId: Hex, limit: number): Promise<number | null>;
}

export function nonceStatus(
  entry: { address: string; expiresAt: number } | undefined | null,
  address: Hex,
  nowSeconds: number,
): NonceCheck {
  if (!entry || entry.address !== address) return "unknown";
  return entry.expiresAt < nowSeconds ? "expired" : "ok";
}

/** In-memory store for tests. Same semantics as the PocketBase store. */
export class MemoryWorldIdStore implements WorldIdStore {
  readonly nonces = new Map<string, { address: Hex; expiresAt: number }>();
  readonly bindings = new Map<string, Binding>();
  readonly seen = new Set<string>();
  readonly vouchers = new Map<string, Hex[]>();

  async putNonce(nonce: string, address: Hex, expiresAt: number) {
    this.nonces.set(nonce, { address, expiresAt });
  }

  async checkNonce(nonce: string, address: Hex, now: number) {
    return nonceStatus(this.nonces.get(nonce), address, now);
  }

  async consumeNonce(nonce: string, address: Hex, now: number) {
    const status = nonceStatus(this.nonces.get(nonce), address, now);
    if (status === "ok") this.nonces.delete(nonce);
    return status;
  }

  async reserveBinding(nullifier: string, address: Hex, at: string): Promise<ReserveResult> {
    const byNullifier = this.bindings.get(nullifier);
    if (byNullifier) {
      return byNullifier.address === address ? { kind: "same" } : { kind: "nullifier_taken", boundTo: byNullifier.address };
    }
    if ([...this.bindings.values()].some((b) => b.address === address)) return { kind: "wallet_taken" };
    this.bindings.set(nullifier, { nullifier, address, status: "pending", verifiedAt: at, txHash: null, onchain: null });
    return { kind: "new" };
  }

  async finalizeBinding(nullifier: string, address: Hex, patch: { verifiedAt: string; txHash: Hex | null; onchain: OnchainStatus }) {
    const b = this.bindings.get(nullifier);
    if (b && b.address === address) this.bindings.set(nullifier, { ...b, ...patch, status: "verified" });
  }

  async releaseBinding(nullifier: string, address: Hex) {
    const b = this.bindings.get(nullifier);
    if (b && b.address === address && b.status === "pending") this.bindings.delete(nullifier);
  }

  async getVerifiedHuman(address: Hex) {
    return [...this.bindings.values()].find((b) => b.address === address && b.status === "verified") ?? null;
  }

  async useOnce(key: string) {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }

  async vouchersOn(address: Hex, day: string) {
    return [...(this.vouchers.get(`${address}:${day}`) ?? [])];
  }

  async claimVoucherSlot(address: Hex, day: string, dropId: Hex, limit: number) {
    const key = `${address}:${day}`;
    const list = this.vouchers.get(key) ?? [];
    if (list.includes(dropId)) return list.indexOf(dropId) + 1;
    if (list.length >= limit) return null;
    this.vouchers.set(key, [...list, dropId]);
    return list.length + 1;
  }
}
