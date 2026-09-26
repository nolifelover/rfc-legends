# World ID (IDKit) integration feedback

Mandatory feedback for the World "Best Use of IDKit" prize. Written as it happened.

## Timeline

- **IDKit work started:** 2026-09-26T07:37:08Z
- **First successful verify round-trip:** _pending_

## Blockers (logged as they happen)

1. **07:55Z — Staging verification now needs a token that the docs don't mention.**
   `worldcoin/developer-portal#2307` (merged 2026-09-25, the day before the
   event) makes `POST /api/v4/verify/{rp_id}` refuse `environment: "staging"`
   with `403 environment_not_allowed` unless (a) the app team opened a 24h staging
   window with the Developer Portal MCP tool `set_world_id_staging_verification`,
   and (b) the verify call carries the issued `x-staging-verification-token`
   header. docs.world.org still says "set `environment: "staging"` and use the
   simulator". We only found this by reading the portal's merged PRs. The fix is
   right (it closes a real sybil hole), but the docs need a line about it.
2. **07:50Z — No testing page.** `docs.world.org/world-id/idkit/testing` is a 404.
   Simulator guidance is scattered across the integrate page and `SKILL.md`.

## W1 research: IDKit 4.x (primary sources)

Sources: `node_modules/@worldcoin/idkit@4.3.0` (README + `.d.ts`),
`@worldcoin/idkit-core@4.3.0`, `@worldcoin/idkit-server@1.1.1`,
docs.world.org (integrate, react, API reference `verify`), the official
`worldcoin/idkit` Next.js example (`js/examples/nextjs`), and
`worldcoin/developer-portal#2307`.

### Widget API (React, `@worldcoin/idkit`)

- `IDKitRequestWidget` (controlled: `open` + `onOpenChange`) or the headless
  `useIDKitRequest` hook. Both need `app_id`, `action`, `rp_context`,
  `allow_legacy_proofs`, and either `preset` or `constraints`.
- Presets: `proofOfHuman({ signal })` (World ID 4.0, falls back to v3 Orb only
  if `allow_legacy_proofs: true`), `orbLegacy`, `deviceLegacy`, `selfieCheck`,
  `passport`, `mnc`, `identityCheck`, … or raw `CredentialRequest` trees with
  `any/all/enumerate`.
- Callbacks: `handleVerify(result)` runs our backend check before the success
  screen and fails the widget if it throws; `onSuccess(result)` runs after it;
  `onError(errorCode, debugReport?)` gets an `IDKitErrorCodes` value
  (`user_rejected`, `cancelled`, `timeout`, `failed_by_host_app`, …).
- `language` accepts `"en" | "es" | "th"`. Thai is supported, which fits our players.
- `environment?: "production" | "staging" | "sandbox"` (default production).

### Does World ID 4 need a relying-party signature? **Yes.**

- `rp_context = { rp_id, nonce, created_at, expires_at, signature }` is
  **required** on every request.
- Generated server-side only: `signRequest({ signingKeyHex: RP_SIGNING_KEY, action, ttl? })`
  from `@worldcoin/idkit/signing` (pure JS, no WASM). It returns
  `{ sig, nonce, createdAt, expiresAt }`. The signature is EIP-191 over
  `version || nonce || createdAt || expiresAt || hash(action)`.
- The signing key is shown once when the RP is registered in the Developer Portal.

### Server-side verify

- `POST https://developer.world.org/api/v4/verify/{rp_id}` (the legacy host is
  `developer.worldcoin.org`). No API key. The body is the IDKit result as-is:
  `{ protocol_version: "4.0", nonce, action, environment, responses: [{ identifier,
  signal_hash, proof: [5 hex], nullifier, issuer_schema_id, expires_at_min }] }`.
- `200 { success: true, results: [{ identifier, success, nullifier }], nullifier, action, environment }`
  or `400 { success: false, code, detail }`.
- **Gotcha:** `signal_hash` is taken from the body (defaults to `0x0`). A
  backend that forwards the client payload unchanged never checks *which*
  signal the proof was made for. We overwrite `signal_hash` with
  `hashSignal(walletAddress)` ourselves, so a proof made for another wallet fails.
- We also pin `action` and `environment` server-side instead of trusting the
  payload. An attacker-chosen action would mint a fresh nullifier. See #2307
  for the environment confused-deputy problem.
- Nullifiers are 256-bit field elements. We store them as normalized decimal
  strings, and they map directly to `uint256` for `HumanRegistry.markVerified`.
- v3 and v4 nullifiers for the same human differ. With `allow_legacy_proofs: true`
  one human could bind two wallets (one v3, one v4), so we default it to `false`.

### Staging simulator

- Set IDKit `environment: "staging"` and scan the QR code with
  https://simulator.worldcoin.org. A real World App only works with production.
  A mismatch fails silently (zero proofs, no error).
- The simulator always returns the same identity. That's useful for us:
  verifying a second wallet with it reproduces the "same human, second wallet"
  rejection.
- Since #2307, staging verify calls also need the `x-staging-verification-token`
  header from a 24h window (see Blocker 1).

### Env vars

| Name | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_WORLD_APP_ID` | client + server | `app_…` from the Developer Portal |
| `NEXT_PUBLIC_WORLD_ACTION` | client + server | action id, e.g. `mint-rare-drop` |
| `WORLD_RP_ID` | server | `rp_…`; returned to the widget inside `rp_context` |
| `WORLD_RP_SIGNING_KEY` | server, secret | RP signing key (hex) |
| `WORLD_ENVIRONMENT` | server | `production` (default) or `staging` (simulator); pinned server-side |
| `WORLD_STAGING_VERIFICATION_TOKEN` | server, secret | only for staging; sent as `x-staging-verification-token` |
| `WORLD_VERIFY_BASE_URL` | server, optional | defaults to `https://developer.world.org` |

## How we integrated it (for the README's file pointers)

| Piece | File |
|---|---|
| RP signature (backend), nonce bound to the wallet | `apps/web/src/server/worldid/rp-context.ts`, route `apps/web/src/app/api/worldid/rp-context/route.ts` |
| IDKit widget, `proofOfHuman({ signal: wallet })`, states | `apps/web/src/components/worldid/WorldIdWidget.tsx`, `apps/web/src/components/worldid/VerifyHuman.tsx` |
| Server-side verify: pin action/env/signal, call `/api/v4/verify/{rp_id}` | `apps/web/src/server/worldid/portal.ts` |
| Nonce check, nullifier to one wallet, onchain mirror | `apps/web/src/server/worldid/verify.ts`, `apps/web/src/server/worldid/nullifier.ts`, `apps/web/src/server/worldid/store.ts` |
| `HumanRegistry.markVerified` with GAME_SIGNER | `apps/web/src/server/worldid/registry.ts` |
| Mint gate (verified human → Base Lv 30 → drop → daily limit) | `apps/web/src/server/worldid/voucher.ts` |
| Tests (41) | `apps/web/src/server/worldid/verify.test.ts`, `apps/web/src/server/worldid/voucher.test.ts` |

What we do beyond the official example (which forwards the widget result verbatim):

- We overwrite `signal_hash` with `hashSignal(wallet)` and reject a mismatch before calling World, so a proof made for wallet A can't verify wallet B.
- `action` and `environment` come from server config, never from the body.
- Every RP nonce is issued for one wallet and consumed on first use, so a proof can't be replayed.
- The nullifier is taken from the Portal's response, stored as a canonical decimal, and bound to one wallet. The binding is reserved under a lock before the onchain write, so two wallets racing with the same World ID can't both win. `HumanRegistry` enforces the same rule onchain.
- Every rejection is non-2xx with a `code` and a readable `reason`, which the UI shows as is.

## Feedback for World (draft, final numbers pending the first live verify)

- **What was missing:** the docs don't cover the staging-verification window and token (#2307). A testing page is also missing (404). And the docs never say that `signal_hash` in the verify body is caller-controlled. The examples forward the client payload verbatim, which never checks the signal.
- **What worked well:** the `.d.ts` files in `@worldcoin/idkit` are excellent and read like documentation. `signRequest` is pure JS (no WASM on the server). The widget runs `handleVerify` automatically and fails cleanly when it throws. Thai (`language: "th"`) is built in.
- **Top improvement request:** add a `signal` (or `expected_signal_hash`) parameter to `POST /api/v4/verify` that the Portal checks. Also make the Next.js example pin `action`/`environment`/`signal` server-side instead of forwarding the widget result.
