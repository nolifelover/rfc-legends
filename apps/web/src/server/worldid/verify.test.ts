import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { ownershipMessage } from "../../lib/worldid/ownership";
import type { Hex } from "../../lib/worldid/types";
import type { WorldIdConfig } from "./config";
import { maskAddress, normalizeNullifier } from "./nullifier";
import { expectedSignalHash } from "./portal";
import type { HumanRegistryClient } from "./registry";
import { issueRpContext } from "./rp-context";
import { MemoryWorldIdStore } from "./store";
import { verifyHuman, type VerifyDeps } from "./verify";

const alice = privateKeyToAccount(("0x" + "a1".repeat(32)) as Hex); // verified human
const alice2 = privateKeyToAccount(("0x" + "a2".repeat(32)) as Hex); // same human, second wallet
const mallory = privateKeyToAccount(("0x" + "b0".repeat(32)) as Hex); // someone else
const addr = (a: PrivateKeyAccount) => a.address.toLowerCase() as Hex;
const A = addr(alice);
const A2 = addr(alice2);

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

async function ownership(signer: PrivateKeyAccount, address: Hex, nonce: string, expiresAt = NOW_S + 300) {
  const signature = await signer.signMessage({
    message: ownershipMessage({ purpose: "verify-world-id", address, nonce, expiresAt }),
  });
  return { signature, expiresAt };
}

/** A well-formed request from `signer` for its own wallet. */
async function body(signer: PrivateKeyAccount, nonce: string, overrides: Record<string, unknown> = {}) {
  const address = addr(signer);
  return { address, result: idkitResult(address, nonce, overrides), ownership: await ownership(signer, address, nonce) };
}

function portalReturns(payload: unknown, status = 200) {
  return vi.fn(async () => Response.json(payload, { status }));
}

function portalOk(nullifier = NULLIFIER_HEX) {
  return portalReturns({
    success: true,
    nullifier,
    results: [{ identifier: "proof_of_human", success: true, nullifier }],
  });
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

async function setup(opts: { nonces?: Record<string, Hex>; registry?: HumanRegistryClient | null; fetchImpl?: unknown } = {}) {
  const store = new MemoryWorldIdStore();
  for (const [nonce, address] of Object.entries(opts.nonces ?? { n1: A })) {
    await store.putNonce(nonce, address, NOW_S + 300);
  }
  const fetchImpl = (opts.fetchImpl ?? portalOk()) as typeof fetch;
  const deps: VerifyDeps = {
    cfg,
    store,
    fetchImpl,
    registry: opts.registry === undefined ? fakeRegistry() : opts.registry,
    registryNote: "contracts not deployed",
    now: () => NOW,
  };
  return { store, deps, fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

describe("nullifier helpers", () => {
  it("treats hex and decimal spellings of the same field element as one key", () => {
    expect(normalizeNullifier("0x0A")).toBe("10");
    expect(normalizeNullifier("0xa")).toBe("10");
    expect(normalizeNullifier("10")).toBe("10");
  });

  it("rejects junk and values above uint256", () => {
    expect(() => normalizeNullifier("hello")).toThrow();
    expect(() => normalizeNullifier("0x1" + "0".repeat(64))).toThrow();
  });

  it("masks addresses for display", () => {
    expect(maskAddress("0x1111111111111111111111111111111111111111")).toBe("0x1111…1111");
  });
});

describe("verifyHuman: accepted paths", () => {
  it("verifies a new human, binds the nullifier and marks them onchain", async () => {
    const registry = fakeRegistry();
    const { deps, store } = await setup({ registry });
    const out = await verifyHuman(await body(alice, "n1"), deps);

    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ verified: true, address: A, onchain: "marked" });
    expect(registry.markVerified).toHaveBeenCalledWith(A, BigInt(NULLIFIER));
    expect(await store.getVerifiedHuman(A)).toMatchObject({ nullifier: NULLIFIER, onchain: "marked" });
    expect(await store.checkNonce("n1", A, NOW_S)).toBe("unknown"); // consumed
  });

  it("accepts a checksummed address and stores it lowercase", async () => {
    const { deps, store } = await setup();
    const req = await body(alice, "n1");
    const out = await verifyHuman({ ...req, address: alice.address }, deps);
    expect(out.body.verified).toBe(true);
    expect(await store.getVerifiedHuman(A)).not.toBeNull();
  });

  it("is idempotent when the same wallet verifies again", async () => {
    const registry = fakeRegistry();
    const { deps } = await setup({ nonces: { n1: A, n2: A }, registry });
    await verifyHuman(await body(alice, "n1"), deps);
    const again = await verifyHuman(await body(alice, "n2"), deps);

    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ verified: true, onchain: "already_marked", txHash: null });
    expect(registry.markVerified).toHaveBeenCalledTimes(1);
  });

  it("skips the onchain mirror (and says why) when contracts aren't deployed", async () => {
    const { deps, store } = await setup({ registry: null });
    const out = await verifyHuman(await body(alice, "n1"), deps);
    expect(out.body).toMatchObject({ verified: true, onchain: "skipped", onchainNote: "contracts not deployed" });
    expect(await store.getVerifiedHuman(A)).toMatchObject({ onchain: "skipped" });
  });

  it("pins action, environment and signal_hash, and sends the staging token", async () => {
    const { deps, fetchImpl } = await setup();
    await verifyHuman(await body(alice, "n1"), deps);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://portal.test/api/v4/verify/rp_test");
    expect((init.headers as Record<string, string>)["x-staging-verification-token"]).toBe("staging-token");
    const sent = JSON.parse(init.body as string);
    expect(sent.action).toBe(cfg.action);
    expect(sent.environment).toBe("staging");
    expect(sent.responses[0].signal_hash).toBe(expectedSignalHash(A));
  });
});

describe("verifyHuman: proof shape is pinned (G-W1)", () => {
  const junk = {
    identifier: "passport",
    signal_hash: "0x0",
    proof: ["0x9", "0x9", "0x9", "0x9", "0x9"],
    nullifier: "0xdead",
    issuer_schema_id: 9303,
    expires_at_min: NOW_S + 3600,
  };

  it("rejects a junk response smuggled next to a real proof, without calling World", async () => {
    const { deps, fetchImpl } = await setup();
    const req = await body(alice, "n1");
    const out = await verifyHuman({ ...req, result: { ...req.result, responses: [junk, ...req.result.responses] } }, deps);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ verified: false, code: "unexpected_proof_shape" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a real proof followed by junk too", async () => {
    const { deps } = await setup();
    const req = await body(alice, "n1");
    const out = await verifyHuman({ ...req, result: { ...req.result, responses: [...req.result.responses, junk] } }, deps);
    expect(out.body).toMatchObject({ code: "unexpected_proof_shape" });
  });

  it("rejects a single response for another credential", async () => {
    const { deps } = await setup();
    const req = await body(alice, "n1");
    const out = await verifyHuman(
      { ...req, result: { ...req.result, responses: [{ ...req.result.responses[0], identifier: "passport" }] } },
      deps,
    );
    expect(out.body).toMatchObject({ code: "unexpected_proof_shape" });
  });

  it("rejects proof of human claimed under another issuer schema", async () => {
    const { deps } = await setup();
    const req = await body(alice, "n1");
    const out = await verifyHuman(
      { ...req, result: { ...req.result, responses: [{ ...req.result.responses[0], issuer_schema_id: 9303 }] } },
      deps,
    );
    expect(out.body).toMatchObject({ code: "unexpected_proof_shape" });
  });

  it.each([
    ["results missing (top-level nullifier only)", { success: true, nullifier: NULLIFIER_HEX }],
    ["results for another identifier", { success: true, results: [{ identifier: "passport", success: true, nullifier: NULLIFIER_HEX }] }],
    ["our result not successful", { success: true, results: [{ identifier: "proof_of_human", success: false, nullifier: NULLIFIER_HEX }] }],
    ["our result without a nullifier", { success: true, results: [{ identifier: "proof_of_human", success: true }] }],
    ["a different nullifier than the proof", { success: true, results: [{ identifier: "proof_of_human", success: true, nullifier: "0xbeef" }] }],
  ])("never binds when the Portal response has %s", async (_label, payload) => {
    const { deps, store } = await setup({ fetchImpl: portalReturns(payload) });
    const out = await verifyHuman(await body(alice, "n1"), deps);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ verified: false, code: "proof_rejected" });
    expect(await store.getVerifiedHuman(A)).toBeNull();
    expect(store.bindings.size).toBe(0);
  });
});

describe("verifyHuman: wallet ownership (G-W3)", () => {
  it("rejects a request without a wallet signature", async () => {
    const { deps } = await setup();
    const { address, result } = await body(alice, "n1");
    const out = await verifyHuman({ address, result }, deps);
    expect(out.status).toBe(400);
  });

  it("rejects a signature made by another wallet", async () => {
    const { deps, fetchImpl } = await setup();
    const req = await body(alice, "n1");
    const out = await verifyHuman({ ...req, ownership: await ownership(mallory, A, "n1") }, deps);
    expect(out.status).toBe(401);
    expect(out.body).toMatchObject({ code: "bad_signature" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a signature over a different nonce", async () => {
    const { deps } = await setup();
    const req = await body(alice, "n1");
    const out = await verifyHuman({ ...req, ownership: await ownership(alice, A, "other-nonce") }, deps);
    expect(out.body).toMatchObject({ code: "bad_signature" });
  });

  it("rejects expired signatures and expiries too far ahead", async () => {
    const { deps } = await setup();
    const req = await body(alice, "n1");
    const expired = await verifyHuman({ ...req, ownership: await ownership(alice, A, "n1", NOW_S - 1) }, deps);
    expect(expired.body).toMatchObject({ code: "bad_signature" });
    const far = await verifyHuman({ ...req, ownership: await ownership(alice, A, "n1", NOW_S + 3600) }, deps);
    expect(far.body).toMatchObject({ code: "bad_signature" });
  });
});

describe("verifyHuman: rejected paths", () => {
  it("rejects the same human's second wallet (nullifier already bound)", async () => {
    const registry = fakeRegistry();
    const { deps, store } = await setup({ nonces: { n1: A, n2: A2 }, registry });
    await verifyHuman(await body(alice, "n1"), deps);
    const second = await verifyHuman(await body(alice2, "n2"), deps);

    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({
      verified: false,
      code: "nullifier_bound_to_other_wallet",
      boundTo: maskAddress(A),
    });
    expect(registry.markVerified).toHaveBeenCalledTimes(1);
    expect(await store.getVerifiedHuman(A2)).toBeNull();
  });

  it("rejects a second wallet when the binding only exists onchain, and frees the reservation", async () => {
    const registry = fakeRegistry({ [NULLIFIER]: A });
    const { deps, store } = await setup({ nonces: { n2: A2 }, registry });
    const out = await verifyHuman(await body(alice2, "n2"), deps);

    expect(out.status).toBe(409);
    expect(out.body).toMatchObject({ code: "nullifier_bound_to_other_wallet" });
    expect(registry.markVerified).not.toHaveBeenCalled();
    expect(store.bindings.size).toBe(0);
  });

  it("rejects a wallet that is already backed by a different World ID", async () => {
    const { deps } = await setup({ nonces: { n1: A, n2: A } });
    await verifyHuman(await body(alice, "n1"), deps);
    deps.fetchImpl = portalOk("0x0def") as unknown as typeof fetch;
    const req = await body(alice, "n2");
    req.result.responses[0].nullifier = "0x0def";
    const out = await verifyHuman(req, deps);
    expect(out.status).toBe(409);
    expect(out.body).toMatchObject({ code: "wallet_already_verified" });
  });

  it("lets exactly one of two concurrent wallets win the same nullifier", async () => {
    const { deps, store } = await setup({ nonces: { n1: A, n2: A2 } });
    const [r1, r2] = await Promise.all([verifyHuman(await body(alice, "n1"), deps), verifyHuman(await body(alice2, "n2"), deps)]);
    expect([r1, r2].filter((r) => r.body.verified)).toHaveLength(1);
    expect([r1, r2].find((r) => !r.body.verified)?.body).toMatchObject({ code: "nullifier_bound_to_other_wallet" });
    expect(store.bindings.size).toBe(1);
  });

  it("rejects a proof whose signal is another wallet, without calling World", async () => {
    const { deps, fetchImpl } = await setup({ nonces: { n1: A2 } });
    const req = await body(alice2, "n1");
    const out = await verifyHuman({ ...req, result: idkitResult(A, "n1") }, deps);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ code: "signal_mismatch" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a proof with no signal at all", async () => {
    const { deps } = await setup();
    const req = await body(alice, "n1");
    delete (req.result.responses[0] as { signal_hash?: string }).signal_hash;
    expect((await verifyHuman(req, deps)).body).toMatchObject({ code: "signal_mismatch" });
  });

  it("rejects a proof for a different action", async () => {
    const { deps } = await setup();
    const out = await verifyHuman(await body(alice, "n1", { action: "other-action" }), deps);
    expect(out.body).toMatchObject({ verified: false, code: "wrong_action" });
  });

  it("rejects a proof from another environment", async () => {
    const { deps } = await setup();
    const out = await verifyHuman(await body(alice, "n1", { environment: "production" }), deps);
    expect(out.body).toMatchObject({ verified: false, code: "wrong_environment" });
  });

  it("rejects legacy World ID 3.0 proofs when legacy is off", async () => {
    const { deps } = await setup();
    const out = await verifyHuman(await body(alice, "n1", { protocol_version: "3.0" }), deps);
    expect(out.body).toMatchObject({ verified: false, code: "legacy_proof_not_allowed" });
  });

  it("rejects session proofs", async () => {
    const { deps } = await setup();
    const out = await verifyHuman(await body(alice, "n1", { session_id: "session_ab" }), deps);
    expect(out.body).toMatchObject({ verified: false, code: "session_proof_not_allowed" });
  });

  it("rejects nonces we never issued, issued to another wallet, expired, or already used", async () => {
    const { deps, store } = await setup({ nonces: { n1: A, other: A2 } });
    expect((await verifyHuman(await body(alice, "nope"), deps)).body).toMatchObject({ code: "nonce_unknown" });
    expect((await verifyHuman(await body(alice, "other"), deps)).body).toMatchObject({ code: "nonce_unknown" });

    await store.putNonce("old", A, NOW_S - 1);
    expect((await verifyHuman(await body(alice, "old"), deps)).body).toMatchObject({ code: "nonce_expired" });

    await verifyHuman(await body(alice, "n1"), deps);
    expect((await verifyHuman(await body(alice, "n1"), deps)).body).toMatchObject({ code: "nonce_unknown" });
  });

  it("passes World's rejection through as the reason, binds nothing, and keeps the nonce", async () => {
    const fetchImpl = portalReturns({ success: false, code: "all_verifications_failed", detail: "Invalid proof" }, 400);
    const { deps, store } = await setup({ fetchImpl });
    const out = await verifyHuman(await body(alice, "n1"), deps);

    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ verified: false, code: "proof_rejected" });
    expect(out.body.verified === false && out.body.reason).toContain("Invalid proof");
    expect(store.bindings.size).toBe(0);
    expect(await store.checkNonce("n1", A, NOW_S)).toBe("ok");
  });

  it("reports an unreachable Portal as 502", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const { deps } = await setup({ fetchImpl });
    const out = await verifyHuman(await body(alice, "n1"), deps);
    expect(out.status).toBe(502);
    expect(out.body).toMatchObject({ code: "portal_unreachable" });
  });

  it("releases the reservation when the onchain write fails", async () => {
    const registry = fakeRegistry();
    registry.markVerified.mockRejectedValueOnce(new Error("HumanRegistry reverted: NotAttestor()"));
    const { deps, store } = await setup({ registry });
    const out = await verifyHuman(await body(alice, "n1"), deps);

    expect(out.status).toBe(502);
    expect(out.body).toMatchObject({ code: "onchain_failed" });
    expect(store.bindings.size).toBe(0);
  });

  it("rejects malformed bodies", async () => {
    const { deps } = await setup();
    expect((await verifyHuman(null, deps)).status).toBe(400);
    const req = await body(alice, "n1");
    expect((await verifyHuman({ ...req, address: "0x123" }, deps)).body).toMatchObject({ code: "invalid_request" });
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
    expect(await store.checkNonce("0xnonce", A, NOW_S)).toBe("ok");
  });
});
