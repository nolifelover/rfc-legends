# Production functional matrix — RFC Legends

**Target:** https://rfclegends.rfcclub.app @ `7a902cd` (freeze-candidate)
**Run:** 2026-09-26 ~16:0x UTC by eth-dev2 (G-QA) with throwaway wallets only. No prodA/prodA2/bot-C/recording wallets touched; no production World ID verify.
**Harness:** `/tmp/qa/` (api-probe, prod-gameflow, guild-2w, roosters-page, edge-stubs, walletstub) — rerunnable against any base URL.

## Result: 20 of 22 checks PASS. 0 demo-breakers. 1 P1, 1 P2, 2 P3.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | API: bad inputs → 400 not 500 | ✅ | 22/22 probes (no-address, bad hex, bad enum, unknown player, dup create 409, overspend…) |
| 2 | Game: fresh wallet → connect → create → idle | ✅ | loaded 2.5s → connected 5.9s → canvas 9.5s |
| 3 | Lv 30 in demo timeframe | ✅ | ~87s server-truth (runbook ~1.2 min) |
| 4 | Zone-2 ribbon at Lv 30 | ✅ | "NEW ZONE" ribbon 87.5s; server zoneId บึงบัวหลวง, baseLevel 31 |
| 5 | Pity Monster Card at Lv-30 kill | ✅ | (local verification: single drop exactly at crossing; prod run: 3 drops incl. MVP card 3001) |
| 6 | Rare-drop toast | ✅ | visible ≤3s after server drop (89.9s vs server 87-88s) |
| 7 | Mint & sell handoff | ✅ | → `/market?dropId=0xa33e4a6e…` (bytes32 verbatim) |
| 8 | Welcome-back after 65s away | ✅ | "WELCOME BACK / While you were away (1m)" modal on reload (fix 02dd981 live) |
| 9 | Guild chat 2 wallets ≤5s | ✅ | W1→W2 0.8s, W2→W1 1.1s (prod SSE; no silent drops) |
| 10 | Guild boss hit | ✅ | accepted, no errors |
| 11 | Two tabs don't freeze | ✅ | (local HEAD) lv 13→32 across 30s dual polling — cadence fix solid |
| 12 | Refresh mid-fight resumes | ✅ | lv 13→16 across reload (level-up-aware comparison) |
| 13 | /roosters detail pages (ENS URLs) | ✅ | 5/5 render with pedigree + proof panel hints |
| 14 | /roosters/1..6 numeric pages | ✅ | all 200 |
| 15 | /api/roosters/N, /api/items/N | ✅ | valid JSON for 1..6, 101, 1001, 3001 |
| 16 | Unverified mint gate (UI) | ✅ | clear "Verify human · World ID" gate + honest copy ("needs Base Lv 30+ and a drop you actually own"), no errors |
| 17 | Unverified mint (API) | ✅ | 400 `invalid_request` missing wallet signature — **accepted as-is** (correct rejection; lead decision) |
| 18 | Tx-reject recovery | ✅ | page alive, zero page errors after wallet-denied click |
| 19 | Market page load | ✅ | renders, copy present |
| 20 | Mobile 390px | ✅ | 0px horizontal overflow (local HEAD) |
| 21 | Wrong chain (non-Sepolia) → switch prompt | ❌ **P1** | no network/switch/chain messaging anywhere on /game or /market with chain 0x1 |
| 22 | /roosters lists all 6 | ⚠️ **P2** | only 5 sires listed; offspring "ลูกไก่ 01 #6" is an orphan page (renders at /roosters/6, but no link from the list or the sire's pedigree) |

## Findings

**P1 — no wrong-chain UX.** Connecting on chain 0x1 (mainnet): no "switch to Sepolia" prompt, banner, or disabled state on /game or /market. A judge on the wrong network gets silent confusion; any contract write would fail opaquely. Repro: stub with `chainId 0x1` → load /market → observe no chain messaging. Suggested fix: wagmi `useConnection().chainId !== 11155111` → banner + `wallet_switchEthereumChain` button. Owner: market/HUD (eth-dev1).

**P2 — offspring rooster orphaned.** The list shows the 5 sires only; the offspring exists (API #6, page /roosters/6 renders 200) but nothing links to it — not the list page, not the sire's pedigree (text mentions the offspring but without a link). Repro: scrape `/roosters` for detail hrefs (5 found); inspect khunphaen page (no /roosters/ hrefs). Fix: include offspring in the list (or link it from the pedigree block). Owner: eth-dev3.

**P3 — one console 400 during the game-flow run** (unidentified resource; flow completed, no user-visible impact). Worth a one-off look at prod logs if convenient.

**P3 — guild delivery margin (local only):** with SSE down, delivery rides the 5s poll → worst case can brush/exceed 5s (measured 4.1–4.6s local). Prod SSE was fast (≤1.1s). The 3s poll (e72b373) improves this; no action needed beyond that.

**Accepted / known (not filed):** voucher-mint 400-missing-sig (lead decision); zone-2 fight stall right after Lv 30 (eth-dev3, fix window ~17:30); Canvas level-up pillar flat white (frozen cosmetic); Cloudflare error 1010 blocks default python UAs — QA harnesses must send a browser UA (noted for anyone re-running).

## Notes for the demo
- Demo-mode rates verified honest-but-fast end to end on prod: Lv 31 + MVP card + handoff in ~95s with the pity guarantee intact.
- The market gate copy is exactly the rejected-path story World wants on camera.

## Retest e5334c4 (after P1/P2/P3 fixes)

Fresh throwaway wallets, same guardrails. 10 of 12 checks PASS.

| Check | Result | Evidence |
|---|---|---|
| /roosters lists 6/6 | ✅ (was 5) | chick01.theprawang.rfclegends.eth now listed |
| Pedigree links both ways | ✅ | offspring→sire (ENS name) and theprawang→/roosters/6 both resolve. NOTE: khunphaen legitimately has no offspring — first-ever check used the wrong sire |
| No first-visit 400 | ✅ (was P3) | zero 4xx across a full fresh visit incl. creation (boot-sync no longer fires for playerless wallets) |
| Wrong-chain banner (post-creation) | ✅ (was P1) | "Wrong network. Your wallet is on chain 1; the Rare Market runs on Sepolia (11155111)… Switch to Sepolia" |
| Accept switch clears banner | ✅ | after wallet_switchEthereumChain → banner gone (required a correctly-switching stub; the earlier FAIL was the stub returning a constant chainId) |
| Reject switch | ✅ | banner persists, page alive, zero errors |
| Zone-2 ribbon at Lv 30 | ✅ | ribbon + server zoneId บึงบัวหลวง |
| Zone-2 fight progresses after Lv 30 | ✅ (was known stall) | lv 30→34, exp climbing over 45s — comfortably faster than the ~15s/pest target |
| Rare-drop toast | ✅ | +86.8s after creation |
| Welcome-back after 65s | ❌ **N2** | see below — reproduced 2/2 |

**N1 (P2) — wrong-chain banner missing on the creation screen.** `game-client.tsx:283` returns `<CreateCharacter/>` before the banner render at `:307`, so a judge connecting on the wrong chain sees no warning until after they've created a character. One-line fix: render the banner in the creation branch too. Owner: eth-dev1.

**N2 (P2) — welcome-back suppressed by away-settlement drops.** Repro 2/2 on prod: player away 65s → reload → the away-settled sync rolls a mintable drop (common in demo mode) → the drop celebration/toast takes the screen and the "While you were away" card never appears. Passed at 7a902cd when no drop happened to land. Fix shape: welcome-back should queue above/after the drop celebration rather than yield to it (research #10 + the no-stacking rules at 7a902cd need to prefer the summary, or show it after the celebration closes). Owner: eth-dev1.

QA-harness notes: Cloudflare still rejects non-browser UAs; the QA stub now performs real `wallet_switchEthereumChain` (mutable `cur`) — old stubs returning a constant chainId false-FAIL the accept-switch check.

