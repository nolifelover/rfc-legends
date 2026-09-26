# World ID (IDKit) integration feedback

Mandatory feedback for the World "Best Use of IDKit" prize. Written as it happened.

## Timeline

- **IDKit work started:** 2026-09-26T07:37:08Z
- **First successful verify round-trip:** 2026-09-26T08:39:27Z, **62 minutes** after we started
  (wall clock). Portal credentials and the staging window only existed from about 08:19Z,
  so the first verify came about 20 minutes after credentials, and the integration was already built. Flow: our `/market` UI,
  then the IDKit widget (staging), then the World ID simulator, then `POST /api/worldid/verify`,
  then the Portal v4 verify, then `HumanRegistry.markVerified` on Sepolia:
  [`0xa081ee7f…858ff`](https://sepolia.etherscan.io/tx/0xa081ee7fd146ed9437061e71af91a39348a1f1c18ff28ee4985588388f0858ff)
  (block 11785102, `HumanVerified` for test wallet `0x4f6b…f395`).

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
2. **08:10Z — Widget smoke test passed, but no live verify yet.** In a headless
   browser, with placeholder env and a mock wallet, `IDKitRequestWidget` opened
   the bridge: QR code shown, staging "Use the simulator" callout shown, and
   closing it gave our "cancelled" state. We can't do a real verify until we
   have `app_id`/`rp_id`/signing key from the Developer Portal.
3. **08:38Z — The simulator ignored the `connect_url` link from the widget.** The staging
   callout in the IDKit widget links to `simulator.worldcoin.org?connect_url=…`, but
   in our headless runs the simulator opened on its credentials screen and never
   picked the request up. Pasting the connector URL through "Paste code" worked
   right away.
4. **08:41Z — The staging simulator has one identity worldwide.** A fresh browser
   profile gets the same nullifier. Our first live verify therefore bound the
   simulator's only identity to our test wallet onchain for good (HumanRegistry
   never frees a nullifier). On this deployment, any other wallet verified through
   the simulator is refused as a second wallet. That's correct behaviour, but it
   means staging can show the rejected path and not a fresh accepted one. The demo
   uses production with a real World App.
5. **07:50Z — No testing page.** `docs.world.org/world-id/idkit/testing` is a 404.
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

## Live evidence (2026-09-26, staging, simulator)

| Wallet | Result | Evidence |
|---|---|---|
| `0x4f6b…f395` (first) | **Verified**, `HumanRegistry.markVerified` sent | [tx 0xa081ee7f…858ff](https://sepolia.etherscan.io/tx/0xa081ee7fd146ed9437061e71af91a39348a1f1c18ff28ee4985588388f0858ff); `isVerified` = true |
| `0x4141…8673` (same simulator human) | **Rejected** 409 `nullifier_bound_to_other_wallet` | World's Portal returned success for the reused nullifier; our binding refused it |
| `0x2862…a79b` (fresh browser profile) | **Rejected** 409, same nullifier | shows the simulator's identity is global |

**Portal v4 accepts nullifier reuse:** a repeat verification succeeds, with a message
noting the reuse. We confirmed this live (row 2). World's API alone won't stop one
human verifying many wallets. **Our server-side binding is the only sybil guard:**
a UNIQUE index on the nullifier and on the wallet in PocketBase, mirrored onchain
by `HumanRegistry.nullifierOwner`.

## How we integrated it (for the README's file pointers)

| Piece | File |
|---|---|
| RP signature (backend), nonce bound to the wallet | `apps/web/src/server/worldid/rp-context.ts`, route `apps/web/src/app/api/worldid/rp-context/route.ts` |
| IDKit widget, `proofOfHuman({ signal: wallet })`, states | `apps/web/src/components/worldid/WorldIdWidget.tsx`, `apps/web/src/components/worldid/VerifyHuman.tsx` |
| Server-side verify: pin action/env/signal, call `/api/v4/verify/{rp_id}` | `apps/web/src/server/worldid/portal.ts` |
| Nonce check, nullifier to one wallet, onchain mirror | `apps/web/src/server/worldid/verify.ts`, `apps/web/src/server/worldid/store.ts` |
| Sybil guard in the database (UNIQUE nullifier + UNIQUE wallet) | `pocketbase/pb_migrations/1790410000_worldid_bindings.js`, `apps/web/src/server/worldid/store-pb.ts` |
| Wallet ownership (EIP-191 signature over wallet + nonce + expiry) | `apps/web/src/lib/worldid/ownership.ts`, `apps/web/src/server/worldid/ownership.ts` |
| `HumanRegistry.markVerified` with GAME_SIGNER | `apps/web/src/server/worldid/registry.ts` |
| Mint gate (verified human → Base Lv 30 → drop → daily limit) | `apps/web/src/server/worldid/voucher.ts` |
| Tests (76: 61 unit + 15 store-contract tests, 8 of them against a real PocketBase started from the repo migrations; run `pocketbase/fetch.sh` first or those 8 are skipped) | `apps/web/src/server/worldid/{verify,voucher,store}.test.ts` |

What we do beyond the official example (which forwards the widget result verbatim):

- We overwrite `signal_hash` with `hashSignal(wallet)` and reject a mismatch before calling World, so a proof made for wallet A can't verify wallet B.
- `action` and `environment` come from server config, never from the body.
- Every RP nonce is issued for one wallet and consumed on first use, so a proof can't be replayed.
- We accept exactly one proof-of-human response (issuer 1). We bind only the nullifier the Portal reports as `success: true` for that credential, and it must match the proof. There's no fallback to client values.
- The nullifier is stored as a canonical decimal and bound to one wallet by a UNIQUE-index insert, before the onchain write, so two wallets racing with the same World ID can't both win. `HumanRegistry` enforces the same rule onchain.
- The caller proves it owns the wallet with an EIP-191 signature over wallet + RP nonce + expiry, so nobody can bind their World ID to someone else's wallet or spend their daily mints.
- Every rejection is non-2xx with a `code` and a readable `reason`, which the UI shows as is.

## Feedback for World

- **Minutes to first successful verify:** 62 wall-clock minutes from the first IDKit line (07:37Z) to a live verify (08:39Z). About 20 of those came after the Portal credentials and staging window existed (about 08:19Z); before that the integration was built against the typings and unit tests.
- **Blockers:** the staging window and token (#2307, not in the docs); the simulator ignored `connect_url` in our runs (we pasted the code instead); the simulator's single global identity.
- **What was missing:** the docs don't cover the staging-verification window and token (#2307). A testing page is also missing (404). And the docs never say that `signal_hash` in the verify body is caller-controlled. The examples forward the client payload verbatim, which never checks the signal.
- **What worked well:** the `.d.ts` files in `@worldcoin/idkit` are excellent and read like documentation. `signRequest` is pure JS (no WASM on the server). The widget runs `handleVerify` automatically and fails cleanly when it throws. Thai (`language: "th"`) is built in.
- **Top improvement request:** a Portal option to reject nullifier reuse per action (today a repeat verification succeeds), and add a `signal` (or `expected_signal_hash`) parameter to `POST /api/v4/verify` that the Portal checks. Also make the Next.js example pin `action`/`environment`/`signal` server-side instead of forwarding the widget result.
