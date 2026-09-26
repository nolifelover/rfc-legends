// Issues the RP-signed context World ID 4 requires on every request, and
// remembers the nonce so /verify only accepts proofs we asked for, for the
// wallet we asked for, once.

import { signRequest } from "@worldcoin/idkit/signing";
import type { Hex, RpContextResponse } from "../../lib/worldid/types";
import type { WorldIdConfig } from "./config";
import type { WorldIdStore } from "./store";

/** Extra time after the RP signature expires for the proof to reach /verify. */
const VERIFY_GRACE_SECONDS = 120;

export async function issueRpContext(
  address: Hex,
  cfg: WorldIdConfig,
  store: WorldIdStore,
  sign: typeof signRequest = signRequest,
): Promise<RpContextResponse> {
  const sig = sign({ signingKeyHex: cfg.signingKey, action: cfg.action, ttl: cfg.nonceTtlSeconds });
  await store.update((state) => {
    state.nonces[sig.nonce] = { address, expiresAt: sig.expiresAt + VERIFY_GRACE_SECONDS };
  });
  return {
    app_id: cfg.appId,
    action: cfg.action,
    environment: cfg.environment,
    allow_legacy_proofs: cfg.allowLegacyProofs,
    signal: address,
    rp_context: {
      rp_id: cfg.rpId,
      nonce: sig.nonce,
      created_at: sig.createdAt,
      expires_at: sig.expiresAt,
      signature: sig.sig,
    },
  };
}
