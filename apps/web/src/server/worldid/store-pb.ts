// WorldIdStore on PocketBase (collections from
// pocketbase/pb_migrations/*_worldid_bindings.js). Atomicity comes from the
// database: reservations and replay guards are UNIQUE-index inserts, and
// consuming an RP nonce is a single-row delete that only one caller can win.

import type PocketBase from "pocketbase";
import { ClientResponseError } from "pocketbase";
import type { Hex } from "../../lib/worldid/types";
import {
  nonceStatus,
  type Binding,
  type NonceCheck,
  type OnchainStatus,
  type ReserveResult,
  type WorldIdStore,
} from "./store";

const BINDINGS = "worldid_bindings";
const NONCES = "worldid_nonces";
const VOUCHERS = "worldid_vouchers";

type BindingRow = {
  id: string;
  nullifier: string;
  address: Hex;
  status: "pending" | "verified";
  verified_at: string;
  tx_hash: string;
  onchain: OnchainStatus | "";
};

function isNotFound(err: unknown) {
  return err instanceof ClientResponseError && err.status === 404;
}

/** Which fields failed a UNIQUE constraint, if that's what this error is. */
function uniqueViolations(err: unknown): string[] {
  if (!(err instanceof ClientResponseError) || err.status !== 400) return [];
  const fields = (err.response?.data ?? {}) as Record<string, { code?: string }>;
  return Object.entries(fields)
    .filter(([, v]) => v?.code === "validation_not_unique")
    .map(([k]) => k);
}

function toBinding(r: BindingRow): Binding {
  return {
    nullifier: r.nullifier,
    address: r.address,
    status: r.status,
    verifiedAt: r.verified_at,
    txHash: (r.tx_hash || null) as Hex | null,
    onchain: r.onchain || null,
  };
}

export class PocketBaseWorldIdStore implements WorldIdStore {
  constructor(private readonly pb: () => Promise<PocketBase>) {}

  private async first<T>(collection: string, filter: string, params: Record<string, unknown>): Promise<T | null> {
    const pb = await this.pb();
    try {
      return await pb.collection(collection).getFirstListItem<T>(pb.filter(filter, params));
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async putNonce(nonce: string, address: Hex, expiresAt: number) {
    const pb = await this.pb();
    await pb.collection(NONCES).create({ kind: "rp", nonce, address, expires_at: expiresAt });
  }

  async checkNonce(nonce: string, address: Hex, now: number): Promise<NonceCheck> {
    const row = await this.first<{ address: string; expires_at: number }>(NONCES, "kind = 'rp' && nonce = {:nonce}", { nonce });
    return nonceStatus(row && { address: row.address, expiresAt: row.expires_at }, address, now);
  }

  async consumeNonce(nonce: string, address: Hex, now: number): Promise<NonceCheck> {
    const row = await this.first<{ id: string; address: string; expires_at: number }>(
      NONCES,
      "kind = 'rp' && nonce = {:nonce}",
      { nonce },
    );
    const status = nonceStatus(row && { address: row.address, expiresAt: row.expires_at }, address, now);
    if (status !== "ok") return status;
    try {
      await (await this.pb()).collection(NONCES).delete(row!.id);
      return "ok";
    } catch (err) {
      if (isNotFound(err)) return "unknown"; // someone else consumed it first
      throw err;
    }
  }

  async reserveBinding(nullifier: string, address: Hex, at: string): Promise<ReserveResult> {
    const pb = await this.pb();
    try {
      await pb.collection(BINDINGS).create({ nullifier, address, status: "pending", verified_at: at });
      return { kind: "new" };
    } catch (err) {
      const fields = uniqueViolations(err);
      if (fields.length === 0) throw err;
    }
    const byNullifier = await this.first<BindingRow>(BINDINGS, "nullifier = {:n}", { n: nullifier });
    if (byNullifier) {
      return byNullifier.address === address
        ? { kind: "same" }
        : { kind: "nullifier_taken", boundTo: byNullifier.address };
    }
    return { kind: "wallet_taken" };
  }

  async finalizeBinding(nullifier: string, address: Hex, patch: { verifiedAt: string; txHash: Hex | null; onchain: OnchainStatus }) {
    const row = await this.first<BindingRow>(BINDINGS, "nullifier = {:n} && address = {:a}", { n: nullifier, a: address });
    if (!row) return;
    await (await this.pb()).collection(BINDINGS).update(row.id, {
      status: "verified",
      verified_at: patch.verifiedAt,
      tx_hash: patch.txHash ?? "",
      onchain: patch.onchain,
    });
  }

  async releaseBinding(nullifier: string, address: Hex) {
    const row = await this.first<BindingRow>(BINDINGS, "nullifier = {:n} && address = {:a} && status = 'pending'", {
      n: nullifier,
      a: address,
    });
    if (!row) return;
    try {
      await (await this.pb()).collection(BINDINGS).delete(row.id);
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }
  }

  async getVerifiedHuman(address: Hex) {
    const row = await this.first<BindingRow>(BINDINGS, "address = {:a} && status = 'verified'", { a: address });
    return row ? toBinding(row) : null;
  }

  async getBinding(nullifier: string) {
    const row = await this.first<BindingRow>(BINDINGS, "nullifier = {:n}", { n: nullifier });
    return row ? toBinding(row) : null;
  }

  async useOnce(key: string, address: Hex, expiresAt: number) {
    try {
      await (await this.pb()).collection(NONCES).create({ kind: "wallet", nonce: key, address, expires_at: expiresAt });
      return true;
    } catch (err) {
      if (uniqueViolations(err).length > 0) return false;
      throw err;
    }
  }

  async vouchersOn(address: Hex, day: string): Promise<Hex[]> {
    const pb = await this.pb();
    const rows = await pb.collection(VOUCHERS).getFullList<{ drop_id: Hex; slot: number }>({
      filter: pb.filter("address = {:a} && day = {:d}", { a: address, d: day }),
      sort: "slot",
    });
    return rows.map((r) => r.drop_id);
  }

  async claimVoucherSlot(address: Hex, day: string, dropId: Hex, limit: number): Promise<number | null> {
    const pb = await this.pb();
    // A concurrent claim can take the slot we picked; the unique index tells us, and we look again.
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await pb.collection(VOUCHERS).getFullList<{ drop_id: Hex; slot: number }>({
        filter: pb.filter("address = {:a} && day = {:d}", { a: address, d: day }),
        sort: "slot",
      });
      const existing = rows.find((r) => r.drop_id === dropId);
      if (existing) return existing.slot;
      if (rows.length >= limit) return null;
      try {
        await pb.collection(VOUCHERS).create({ address, day, drop_id: dropId, slot: rows.length + 1 });
        return rows.length + 1;
      } catch (err) {
        if (uniqueViolations(err).length === 0) throw err;
      }
    }
    return null;
  }
}
