// Server-side proof verification against World's Developer Portal
// (POST {base}/api/v4/verify/{rp_id}).
//
// The official examples forward the widget result verbatim. We don't: the
// Portal takes `action`, `environment` and each `signal_hash` from the body,
// so a verbatim forward lets the client pick the action (fresh nullifier), the
// environment (simulator identities), and the signal (a proof made for some
// other wallet). All three are pinned here from server config.

import { hashSignal } from "@worldcoin/idkit/hashing";
import { z } from "zod";
import type { Hex, VerifyRejectCode } from "../../lib/worldid/types";
import type { WorldIdConfig } from "./config";
import { normalizeNullifier } from "./nullifier";

const responseItem = z.looseObject({
  identifier: z.string(),
  signal_hash: z.string().optional(),
  nullifier: z.string(),
  issuer_schema_id: z.number().optional(),
});

/**
 * The one credential we accept: World ID proof of human (Orb). The widget asks
 * for exactly this (proofOfHuman preset), so a result that carries anything
 * else, or more than one response, was not produced by our request.
 */
export const EXPECTED_CREDENTIAL = { identifier: "proof_of_human", issuerSchemaId: 1 } as const;

/** Only the fields we check; everything else is forwarded untouched. */
export const idkitResultSchema = z.looseObject({
  protocol_version: z.enum(["3.0", "4.0"]),
  nonce: z.string().min(1),
  action: z.string().optional(),
  environment: z.string().optional(),
  session_id: z.string().optional(),
  responses: z.array(responseItem).min(1).max(8),
});

export type IdkitResult = z.infer<typeof idkitResultSchema>;

export type Reject = { ok: false; code: VerifyRejectCode; reason: string };

/** The signal every proof must commit to: the wallet address. */
export function expectedSignalHash(address: Hex): string {
  return hashSignal(address.toLowerCase()).toLowerCase();
}

/** Cheap checks that need no network. Returns null when the result may go to the Portal. */
export function precheckResult(result: IdkitResult, address: Hex, cfg: WorldIdConfig): Reject | null {
  if (result.session_id !== undefined) {
    return { ok: false, code: "session_proof_not_allowed", reason: "Session proofs can't be used to verify a wallet." };
  }
  if (result.protocol_version === "3.0" && !cfg.allowLegacyProofs) {
    return {
      ok: false,
      code: "legacy_proof_not_allowed",
      reason: "This proof uses legacy World ID 3.0. Update World App and verify again with World ID 4.0.",
    };
  }
  if (result.responses.length !== 1) {
    return {
      ok: false,
      code: "unexpected_proof_shape",
      reason: `Expected exactly one proof-of-human response, got ${result.responses.length}.`,
    };
  }
  const item = result.responses[0];
  if (
    item.identifier !== EXPECTED_CREDENTIAL.identifier ||
    (result.protocol_version === "4.0" && item.issuer_schema_id !== EXPECTED_CREDENTIAL.issuerSchemaId)
  ) {
    return {
      ok: false,
      code: "unexpected_proof_shape",
      reason: `Only World ID proof of human is accepted (got "${item.identifier}", issuer ${item.issuer_schema_id ?? "none"}).`,
    };
  }
  if (result.action !== cfg.action) {
    return { ok: false, code: "wrong_action", reason: `Proof was made for a different action ("${result.action ?? ""}").` };
  }
  const env = result.environment ?? "production";
  if (env !== cfg.environment) {
    return {
      ok: false,
      code: "wrong_environment",
      reason: `Proof comes from the ${env} environment, but this server only accepts ${cfg.environment} proofs.`,
    };
  }
  const expected = expectedSignalHash(address);
  for (const item of result.responses) {
    if (item.signal_hash?.toLowerCase() !== expected) {
      return {
        ok: false,
        code: "signal_mismatch",
        reason: "This proof isn't bound to your connected wallet. Verify again from this wallet.",
      };
    }
  }
  return null;
}

const portalResponse = z.looseObject({
  success: z.boolean().optional(),
  code: z.string().optional(),
  detail: z.string().optional(),
  nullifier: z.string().optional(),
  results: z
    .array(
      z.looseObject({
        identifier: z.string().optional(),
        success: z.boolean().optional(),
        nullifier: z.string().optional(),
        code: z.string().optional(),
        detail: z.string().optional(),
      }),
    )
    .optional(),
});

export type PortalOk = { ok: true; nullifier: string; identifier: string };

export async function verifyWithPortal(
  result: IdkitResult,
  address: Hex,
  cfg: WorldIdConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<PortalOk | Reject> {
  const signalHash = expectedSignalHash(address);
  const body = {
    ...result,
    action: cfg.action,
    environment: cfg.environment,
    responses: result.responses.map((r) => ({ ...r, signal_hash: signalHash })),
  };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.environment === "staging" && cfg.stagingToken) {
    headers["x-staging-verification-token"] = cfg.stagingToken;
  }

  let res: Response;
  try {
    res = await fetchImpl(`${cfg.verifyBaseUrl}/api/v4/verify/${encodeURIComponent(cfg.rpId)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    return {
      ok: false,
      code: "portal_unreachable",
      reason: `Couldn't reach World's verification API (${err instanceof Error ? err.message : "network error"}). Try again.`,
    };
  }

  const parsed = portalResponse.safeParse(await res.json().catch(() => ({})));
  const payload = parsed.success ? parsed.data : {};
  if (!res.ok || payload.success !== true) {
    const failed = payload.results?.find((r) => r.success === false);
    const code = payload.code ?? failed?.code ?? `http_${res.status}`;
    const detail = payload.detail ?? failed?.detail ?? res.statusText;
    const hint =
      code === "environment_not_allowed"
        ? " Staging proofs need an open staging window and WORLD_STAGING_VERIFICATION_TOKEN."
        : "";
    return { ok: false, code: "proof_rejected", reason: `World ID rejected the proof: ${detail} (${code}).${hint}` };
  }

  // Bind only what the Portal itself says it verified: the result for our
  // credential with success === true. Never fall back to the client's copy.
  const verified = (payload.results ?? []).filter(
    (r) => r.identifier === EXPECTED_CREDENTIAL.identifier && r.success === true && typeof r.nullifier === "string",
  );
  if (verified.length !== 1) {
    return {
      ok: false,
      code: "proof_rejected",
      reason: "World ID didn't confirm a proof-of-human result for this request.",
    };
  }
  let nullifier: string;
  try {
    nullifier = normalizeNullifier(verified[0].nullifier!);
  } catch {
    return { ok: false, code: "proof_rejected", reason: "World ID returned an unreadable nullifier." };
  }
  // Sanity check: the Portal verified the proof we sent, so its nullifier must be the one in that proof.
  let claimed: string | null = null;
  try {
    claimed = normalizeNullifier(result.responses[0].nullifier);
  } catch {
    claimed = null;
  }
  if (claimed !== nullifier) {
    return { ok: false, code: "proof_rejected", reason: "World ID's nullifier doesn't match the submitted proof." };
  }
  return { ok: true, nullifier, identifier: EXPECTED_CREDENTIAL.identifier };
}
