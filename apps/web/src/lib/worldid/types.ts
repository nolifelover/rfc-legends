// Shared request/response shapes for the World ID + mint voucher API.
// Imported by both route handlers and client components, so keep it free of
// server-only imports.

export type Hex = `0x${string}`;

/** Why a World ID verification was refused. Each code maps to one UI message. */
export type VerifyRejectCode =
  | "invalid_request"
  | "not_configured"
  | "wrong_action"
  | "wrong_environment"
  | "legacy_proof_not_allowed"
  | "session_proof_not_allowed"
  | "nonce_unknown"
  | "nonce_expired"
  | "nonce_used"
  | "signal_mismatch"
  | "proof_rejected"
  | "portal_unreachable"
  | "nullifier_bound_to_other_wallet"
  | "onchain_failed";

export type VerifyResponse =
  | {
      verified: true;
      address: Hex;
      /** Onchain HumanRegistry.markVerified tx, or null if it was skipped / already set. */
      txHash: Hex | null;
      onchain: "marked" | "already_marked" | "skipped";
      /** Why onchain mirroring was skipped (e.g. contracts not deployed yet). */
      onchainNote?: string;
    }
  | {
      verified: false;
      code: VerifyRejectCode;
      reason: string;
      /** Masked address the World ID is already bound to (second-wallet case). */
      boundTo?: string;
    };

export type RpContextResponse = {
  app_id: `app_${string}`;
  action: string;
  environment: "production" | "staging";
  allow_legacy_proofs: boolean;
  /** Signal the widget must request: the lowercase wallet address. */
  signal: Hex;
  rp_context: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
};

export type HumanStatusResponse = {
  address: Hex;
  verified: boolean;
  verifiedAt?: string;
  txHash?: Hex | null;
  onchain?: boolean | null;
};

/** EIP-712 MintVoucher as JSON (uint256 fields as decimal strings). */
export type MintVoucherJson = {
  to: Hex;
  itemId: string;
  amount: string;
  dropId: Hex;
  deadline: string;
};

export type VoucherRejectCode =
  | "invalid_request"
  | "not_verified_human"
  | "player_not_found"
  | "base_level_too_low"
  | "drop_not_found"
  | "drop_already_minted"
  | "drop_not_mintable"
  | "daily_limit_reached"
  | "not_configured";

export type VoucherResponse =
  | {
      ok: true;
      voucher: MintVoucherJson;
      signature: Hex;
      rareItems: Hex;
      chainId: number;
      mintsToday: number;
      dailyLimit: number;
    }
  | { ok: false; code: VoucherRejectCode; reason: string };
