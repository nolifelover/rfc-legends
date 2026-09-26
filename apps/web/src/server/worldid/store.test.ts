// One behavioural contract, run against the in-memory store and against a
// real PocketBase started from pocketbase/pb_migrations (the persistent path).

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import PocketBase from "pocketbase";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Hex } from "../../lib/worldid/types";
import { MemoryWorldIdStore, type WorldIdStore } from "./store";
import { PocketBaseWorldIdStore } from "./store-pb";

const A = "0x1111111111111111111111111111111111111111" as Hex;
const B = "0x2222222222222222222222222222222222222222" as Hex;
const DAY = "2026-09-26";
const drop = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
let seq = 0;
const unique = (p: string) => `${p}${Date.now()}${++seq}`;
const NOW = 1_790_000_000;

function storeContract(name: string, make: () => WorldIdStore) {
  describe(`WorldIdStore contract: ${name}`, () => {
    it("RP nonces are bound to one wallet, expire, and are single use", async () => {
      const s = make();
      const n = unique("0xrp");
      await s.putNonce(n, A, NOW + 60);
      expect(await s.checkNonce(n, A, NOW)).toBe("ok");
      expect(await s.checkNonce(n, B, NOW)).toBe("unknown");
      expect(await s.checkNonce(n, A, NOW + 61)).toBe("expired");
      expect(await s.checkNonce(unique("0xnope"), A, NOW)).toBe("unknown");

      const results = await Promise.all([s.consumeNonce(n, A, NOW), s.consumeNonce(n, A, NOW)]);
      expect(results.filter((r) => r === "ok")).toHaveLength(1);
      expect(await s.consumeNonce(n, A, NOW)).toBe("unknown");
    });

    it("binds a nullifier to one wallet and refuses the same human's second wallet", async () => {
      const s = make();
      const n = unique("1");
      const a = `0x${unique("").padStart(40, "a").slice(-40)}` as Hex;
      const b = `0x${unique("").padStart(40, "b").slice(-40)}` as Hex;
      expect(await s.reserveBinding(n, a, "2026-09-26T10:00:00.000Z")).toEqual({ kind: "new" });
      expect(await s.getVerifiedHuman(a)).toBeNull(); // still pending
      expect(await s.reserveBinding(n, a, "2026-09-26T10:00:00.000Z")).toEqual({ kind: "same" });
      expect(await s.reserveBinding(n, b, "2026-09-26T10:00:00.000Z")).toEqual({ kind: "nullifier_taken", boundTo: a });

      await s.finalizeBinding(n, a, { verifiedAt: "2026-09-26T10:00:05.000Z", txHash: null, onchain: "skipped" });
      expect(await s.getVerifiedHuman(a)).toMatchObject({ nullifier: n, address: a, status: "verified", onchain: "skipped" });
      expect(await s.getBinding(n)).toMatchObject({ address: a, status: "verified" });
      expect(await s.getBinding(unique("9"))).toBeNull();
    });

    it("refuses a second World ID on an already bound wallet", async () => {
      const s = make();
      const a = `0x${unique("").padStart(40, "c").slice(-40)}` as Hex;
      await s.reserveBinding(unique("2"), a, "2026-09-26T10:00:00.000Z");
      expect(await s.reserveBinding(unique("3"), a, "2026-09-26T10:00:00.000Z")).toEqual({ kind: "wallet_taken" });
    });

    it("lets exactly one of two concurrent wallets reserve the same nullifier", async () => {
      const s = make();
      const n = unique("4");
      const a = `0x${unique("").padStart(40, "d").slice(-40)}` as Hex;
      const b = `0x${unique("").padStart(40, "e").slice(-40)}` as Hex;
      const results = await Promise.all([s.reserveBinding(n, a, "t"), s.reserveBinding(n, b, "t")]);
      expect(results.filter((r) => r.kind === "new")).toHaveLength(1);
      expect(results.filter((r) => r.kind === "nullifier_taken")).toHaveLength(1);
    });

    it("releases only a pending reservation", async () => {
      const s = make();
      const n = unique("5");
      const a = `0x${unique("").padStart(40, "f").slice(-40)}` as Hex;
      const b = `0x${unique("").padStart(40, "9").slice(-40)}` as Hex;
      await s.reserveBinding(n, a, "t");
      await s.releaseBinding(n, a);
      expect(await s.reserveBinding(n, b, "t")).toEqual({ kind: "new" });
      await s.finalizeBinding(n, b, { verifiedAt: "t", txHash: null, onchain: "marked" });
      await s.releaseBinding(n, b);
      expect(await s.getVerifiedHuman(b)).not.toBeNull();
    });

    it("useOnce refuses a replayed wallet-signature nonce", async () => {
      const s = make();
      const k = unique("0xsig");
      expect(await s.useOnce(k, A, NOW + 60)).toBe(true);
      expect(await s.useOnce(k, A, NOW + 60)).toBe(false);
    });

    it("voucher slots respect the daily limit atomically; the same drop reuses its slot", async () => {
      const s = make();
      const a = `0x${unique("").padStart(40, "7").slice(-40)}` as Hex;
      const claims = await Promise.all([1, 2, 3, 4, 5].map((i) => s.claimVoucherSlot(a, DAY, drop(i), 3)));
      expect(claims.filter((c) => c !== null)).toHaveLength(3);
      expect(await s.vouchersOn(a, DAY)).toHaveLength(3);
      const kept = (await s.vouchersOn(a, DAY))[0];
      expect(await s.claimVoucherSlot(a, DAY, kept, 3)).toBe(1);
      expect(await s.vouchersOn(a, "2026-09-27")).toEqual([]);
    });
  });
}

storeContract("memory", () => new MemoryWorldIdStore());

// ---- PocketBase (real binary, temp data dir, repo migrations) ---------------

const repo = path.resolve(__dirname, "../../../../..");
const binary = path.join(repo, "pocketbase", "pocketbase");
const hasBinary = existsSync(binary);
if (!hasBinary) {
  console.warn(`[store.test] ${binary} missing; run pocketbase/fetch.sh to test the PocketBase store`);
}

describe.skipIf(!hasBinary)("PocketBase store", () => {
  let proc: ChildProcess | null = null;
  let dir = "";
  let pb: PocketBase;
  const port = 18090 + Math.floor(Math.random() * 500);

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "worldid-pb-"));
    const email = "test@worldid.local";
    const password = "worldid-test-password";
    spawnSync(binary, ["superuser", "upsert", email, password, "--dir", dir], { stdio: "ignore" });
    proc = spawn(
      binary,
      ["serve", "--http", `127.0.0.1:${port}`, "--dir", dir, "--migrationsDir", path.join(repo, "pocketbase", "pb_migrations")],
      { stdio: "ignore" },
    );
    pb = new PocketBase(`http://127.0.0.1:${port}`);
    pb.autoCancellation(false);
    for (let i = 0; i < 100; i++) {
      try {
        await pb.health.check();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    await pb.collection("_superusers").authWithPassword(email, password);
  }, 20_000);

  afterAll(() => {
    proc?.kill();
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("the migration creates locked collections with the unique indexes", async () => {
    const bindings = await pb.collections.getOne("worldid_bindings");
    expect(bindings.listRule).toBeNull();
    expect(bindings.createRule).toBeNull();
    expect(bindings.indexes.join("\n")).toMatch(/UNIQUE INDEX .* \(nullifier\)/);
    expect(bindings.indexes.join("\n")).toMatch(/UNIQUE INDEX .* \(address\)/);
    const anon = new PocketBase(`http://127.0.0.1:${port}`);
    await expect(anon.collection("worldid_bindings").getList()).rejects.toMatchObject({ status: 403 });
  });

  storeContract("pocketbase", () => new PocketBaseWorldIdStore(async () => pb));
});
