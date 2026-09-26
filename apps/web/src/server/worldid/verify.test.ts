import { describe, expect, it, vi } from "vitest";
import type { Hex } from "../../lib/worldid/types";
import type { WorldIdConfig } from "./config";
import { decideBinding, maskAddress, normalizeNullifier } from "./nullifier";
import { expectedSignalHash } from "./portal";
import type { HumanRegistryClient } from "./registry";
import { issueRpContext } from "./rp-context";
import { emptyState, MemoryWorldIdStore } from "./store";
import { verifyHuman, type VerifyDeps } from "./verify";

const A = "0x1111111111111111111111111111111111111111" as Hex; // verified human
const A2 = "0x2222222222222222222222222222222222222222" as Hex; // same human, second wallet
const NULLIFIER_HEX = "0x0abc";
const NULLIFIER = normalizeNullifier(NULLIFIER_HEX);
const NOW = new Date("2026-09-26T10:00:00Z");
const NOW_S = Math.floor(NOW.getTime() / 1000);

const cfg: WorldIdConfig = {
  appId: "app_test",
  action: "mint-rare-drop",
  rpId: "rp_test",
  signingKey: "0x" + "11".repeat(32),
  environment: "staging",
  allowLegacyProofs: false,
  verifyBaseUrl: "https://portal.test",
  stagingToken: "staging-token",
  nonceTtlSeconds: 300,
};

function idkitResult(address: Hex, nonce: string, overrides: Record<string, unknown> = {}) {
  return {
    protocol_version: "4.0",
    nonce,
    action: cfg.action,
    environment: "staging",
    responses: [
      {
        identifier: "proof_of_human",
        signal_hash: expectedSignalHash(address),
        proof: ["0x1", "0x2", "0x3", "0x4", "0x5"],
        nullifier: NULLIFIER_HEX,
        issuer_schema_id: 1,
        expires_at_min: NOW_S + 3600,
      },
    ],
    ...overrides,
  };
}

function portalOk(nullifier = NULLIFIER_HEX) {
  return vi.fn(async () =>
    Response.json({ success: true, nullifier, results: [{ identifier: "proof_of_human", success: true, nullifier }] }),
  );
}

function fakeRegistry(initialOwners: Record<string, Hex> = {}) {
  const owners = new Map(Object.entries(initialOwners));
  const registry: HumanRegistryClient & { markVerified: ReturnType<typeof vi.fn> } = {
    nullifierOwner: vi.fn(async (n: bigint) => (owners.get(n.toString()) as Hex | undefined) ?? null),
    isVerified: vi.fn(async (a: Hex) => [...owners.values()].includes(a)),
    markVerified: vi.fn(async (a: Hex, n: bigint) => {
      owners.set(n.toString(), a);
      return ("0x" + "ab".repeat(32)) as Hex;
    }),
  };
  return registry;
}

function setup(opts: { nonces?: Record<string, Hex>; registry?: HumanRegistryClient | null; fetchImpl?: typeof fetch } = {}) {
  const state = emptyState();
  for (const [nonce, address] of Object.entries(opts.nonces ?? { n1: A })) {
    state.nonces[nonce] = { address, expiresAt: NOW_S + 300 };
  }
  const store = new MemoryWorldIdStore(state);
  const fetchImpl = opts.fetchImpl ?? (portalOk() as unknown as typeof fetch);
  const deps: VerifyDeps = {
    cfg,
    store,
    fetchImpl,
    registry: opts.registry === undefined ? fakeRegistry() : opts.registry,
    registryNote: "contracts not deployed",
    now: () => NOW,
  };
  return { store, deps, fetchImpl };
}

describe("normalizeNullifier / decideBinding", () => {
  it("treats hex and decimal spellings of the same field element as one key", () => {
    expect(normalizeNullifier("0x0A")).toBe("10");
    expect(normalizeNullifier("0xa")).toBe("10");
    expect(normalizeNullifier("10")).toBe("10");
  });

  it("rejects junk and values above uint256", () => {
    expect(() => normalizeNullifier("hello")).toThrow();
    expect(() => normalizeNullifier("0x1" + "0".repeat(64))).toThrow();
  });

  it("decides new / same / other", () => {
    const state = emptyState();
    expect(decideBinding(state, A, NULLIFIER)).toEqual({ kind: "new" });
    state.bindings[NULLIFIER] = { address: A, status: "verified", verifiedAt: NOW.toISOString(), txHash: null };
    expect(decideBinding(state, A, NULLIFIER)).toEqual({ kind: "same" });
    expect(decideBinding(state, A2, NULLIFIER)).toEqual({ kind: "other", boundTo: A });
  });

  it("masks addresses for display", () => {
    expect(maskAddress(A)).toBe("0x1111…1111");
  });
});

describe("verifyHuman: accepted paths", () => {
  it("verifies a new human, binds the nullifier and marks them onchain", async () => {
    const registry = fakeRegistry();
    const { deps, store } = setup({ registry });
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ verified: true, address: A, onchain: "marked" });
    expect(registry.markVerified).toHaveBeenCalledWith(A, BigInt(NULLIFIER));
    const state = await store.read();
    expect(state.bindings[NULLIFIER]).toMatchObject({ address: A, status: "verified" });
    expect(state.humans[A]).toMatchObject({ nullifier: NULLIFIER, onchain: "marked" });
    expect(state.nonces.n1.usedAt).toBeDefined();
  });

  it("accepts a checksummed address and stores it lowercase", async () => {
    const mixed = "0xAbCdEf0123456789aBcDeF0123456789AbCdEf01";
    const lower = mixed.toLowerCase() as Hex;
    const { deps, store } = setup({ nonces: { n1: lower } });
    const out = await verifyHuman({ address: mixed, result: idkitResult(lower, "n1") }, deps);
    expect(out.body.verified).toBe(true);
    expect((await store.read()).humans[lower]).toBeDefined();
  });

  it("is idempotent when the same wallet verifies again", async () => {
    const registry = fakeRegistry();
    const { deps } = setup({ nonces: { n1: A, n2: A }, registry });
    await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);
    const again = await verifyHuman({ address: A, result: idkitResult(A, "n2") }, deps);

    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ verified: true, onchain: "already_marked", txHash: null });
    expect(registry.markVerified).toHaveBeenCalledTimes(1);
  });

  it("skips the onchain mirror (and says why) when contracts aren't deployed", async () => {
    const { deps } = setup({ registry: null });
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);
    expect(out.body).toMatchObject({ verified: true, onchain: "skipped", onchainNote: "contracts not deployed" });
  });

  it("pins action, environment and signal_hash, and sends the staging token", async () => {
    const fetchImpl = portalOk();
    const { deps } = setup({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://portal.test/api/v4/verify/rp_test");
    expect((init.headers as Record<string, string>)["x-staging-verification-token"]).toBe("staging-token");
    const sent = JSON.parse(init.body as string);
    expect(sent.action).toBe(cfg.action);
    expect(sent.environment).toBe("staging");
    expect(sent.responses[0].signal_hash).toBe(expectedSignalHash(A));
  });
});

describe("verifyHuman: rejected paths", () => {
  it("rejects the same human's second wallet (nullifier already bound)", async () => {
    const registry = fakeRegistry();
    const { deps, store } = setup({ nonces: { n1: A, n2: A2 }, registry });
    await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);
    const second = await verifyHuman({ address: A2, result: idkitResult(A2, "n2") }, deps);

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({
      verified: false,
      code: "nullifier_bound_to_other_wallet",
      boundTo: "0x1111…1111",
    });
    expect(registry.markVerified).toHaveBeenCalledTimes(1);
    const state = await store.read();
    expect(state.humans[A2]).toBeUndefined();
    expect(state.bindings[NULLIFIER].address).toBe(A);
  });

  it("rejects a second wallet when the binding only exists onchain, and frees the reservation", async () => {
    const registry = fakeRegistry({ [NULLIFIER]: A });
    const { deps, store } = setup({ nonces: { n2: A2 }, registry });
    const out = await verifyHuman({ address: A2, result: idkitResult(A2, "n2") }, deps);

    expect(out.status).toBe(409);
    expect(out.body).toMatchObject({ code: "nullifier_bound_to_other_wallet" });
    expect(registry.markVerified).not.toHaveBeenCalled();
    expect((await store.read()).bindings[NULLIFIER]).toBeUndefined();
  });

  it("lets exactly one of two concurrent wallets win the same nullifier", async () => {
    const { deps, store } = setup({ nonces: { n1: A, n2: A2 } });
    const [r1, r2] = await Promise.all([
      verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps),
      verifyHuman({ address: A2, result: idkitResult(A2, "n2") }, deps),
    ]);
    const wins = [r1, r2].filter((r) => r.body.verified);
    expect(wins).toHaveLength(1);
    expect([r1, r2].find((r) => !r.body.verified)?.body).toMatchObject({ code: "nullifier_bound_to_other_wallet" });
    expect(Object.keys((await store.read()).humans)).toHaveLength(1);
  });

  it("rejects a proof whose signal is another wallet, without calling World", async () => {
    const { deps, fetchImpl } = setup({ nonces: { n1: A2 } });
    const out = await verifyHuman({ address: A2, result: idkitResult(A, "n1") }, deps);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ code: "signal_mismatch" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a proof with no signal at all", async () => {
    const { deps } = setup();
    const result = idkitResult(A, "n1");
    delete (result.responses[0] as { signal_hash?: string }).signal_hash;
    const out = await verifyHuman({ address: A, result }, deps);
    expect(out.body).toMatchObject({ code: "signal_mismatch" });
  });

  it("rejects a proof for a different action", async () => {
    const { deps } = setup();
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1", { action: "other-action" }) }, deps);
    expect(out.body).toMatchObject({ verified: false, code: "wrong_action" });
  });

  it("rejects a proof from another environment", async () => {
    const { deps } = setup();
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1", { environment: "production" }) }, deps);
    expect(out.body).toMatchObject({ verified: false, code: "wrong_environment" });
  });

  it("rejects legacy World ID 3.0 proofs when legacy is off", async () => {
    const { deps } = setup();
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1", { protocol_version: "3.0" }) }, deps);
    expect(out.body).toMatchObject({ verified: false, code: "legacy_proof_not_allowed" });
  });

  it("rejects session proofs", async () => {
    const { deps } = setup();
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1", { session_id: "session_ab" }) }, deps);
    expect(out.body).toMatchObject({ verified: false, code: "session_proof_not_allowed" });
  });

  it("rejects nonces we never issued, issued to another wallet, expired, or already used", async () => {
    const { deps, store } = setup({ nonces: { n1: A, other: A2 } });
    expect((await verifyHuman({ address: A, result: idkitResult(A, "nope") }, deps)).body).toMatchObject({
      code: "nonce_unknown",
    });
    expect((await verifyHuman({ address: A, result: idkitResult(A, "other") }, deps)).body).toMatchObject({
      code: "nonce_unknown",
    });

    await store.update((s) => {
      s.nonces.old = { address: A, expiresAt: NOW_S - 1 };
    });
    expect((await verifyHuman({ address: A, result: idkitResult(A, "old") }, deps)).body).toMatchObject({
      code: "nonce_expired",
    });

    await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);
    expect((await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps)).body).toMatchObject({
      code: "nonce_used",
    });
  });

  it("passes World's rejection through as the reason and binds nothing", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ success: false, code: "all_verifications_failed", detail: "Invalid proof" }, { status: 400 }),
    );
    const { deps, store } = setup({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);

    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ verified: false, code: "proof_rejected" });
    expect(out.body.verified === false && out.body.reason).toContain("Invalid proof");
    const state = await store.read();
    expect(state.bindings).toEqual({});
    expect(state.nonces.n1.usedAt).toBeUndefined();
  });

  it("reports an unreachable Portal as 502", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const { deps } = setup({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);
    expect(out.status).toBe(502);
    expect(out.body).toMatchObject({ code: "portal_unreachable" });
  });

  it("releases the reservation when the onchain write fails", async () => {
    const registry = fakeRegistry();
    registry.markVerified.mockRejectedValueOnce(new Error("HumanRegistry reverted: NotAttestor()"));
    const { deps, store } = setup({ registry });
    const out = await verifyHuman({ address: A, result: idkitResult(A, "n1") }, deps);

    expect(out.status).toBe(502);
    expect(out.body).toMatchObject({ code: "onchain_failed" });
    const state = await store.read();
    expect(state.bindings[NULLIFIER]).toBeUndefined();
    expect(state.humans[A]).toBeUndefined();
  });

  it("rejects malformed bodies", async () => {
    const { deps } = setup();
    expect((await verifyHuman(null, deps)).status).toBe(400);
    expect((await verifyHuman({ address: "0x123", result: idkitResult(A, "n1") }, deps)).body).toMatchObject({
      code: "invalid_request",
    });
  });
});

describe("issueRpContext", () => {
  it("signs for our action and remembers the nonce for this wallet", async () => {
    const store = new MemoryWorldIdStore();
    const sign = vi.fn(() => ({ sig: "0xsig", nonce: "0xnonce", createdAt: NOW_S, expiresAt: NOW_S + 300 }));
    const out = await issueRpContext(A, cfg, store, sign);

    expect(sign).toHaveBeenCalledWith({ signingKeyHex: cfg.signingKey, action: cfg.action, ttl: 300 });
    expect(out).toMatchObject({
      app_id: "app_test",
      action: cfg.action,
      environment: "staging",
      signal: A,
      rp_context: { rp_id: "rp_test", nonce: "0xnonce", signature: "0xsig" },
    });
    expect((await store.read()).nonces["0xnonce"]).toMatchObject({ address: A });
  });
});
