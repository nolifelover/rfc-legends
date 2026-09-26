# ETHGlobal submission — RFC Legends

## Status (2026-09-26, updated by eth-dev1 to match reality)

Project page: https://ethglobal.com/events/tokyo2026/project

- [x] Project created: name "RFC Legends", category Gaming, emoji 🐓
- [x] Public repo: https://github.com/nolifelover/rfc-legends (linked via GitHub Permissions)
- [x] Live demo (primary): https://rfclegends.rfcclub.app — production build, demo-mode badge visible. Mirror: https://rfc-legends.earn.dev.rawinlab.com
- [ ] Demo video: record 2–4 min, ≥720p, clear voice — script follows the e2e demo beat
- [ ] Images / screenshots
- [ ] Final submit — only after the video link is in

Deadline: **Sun 27 Sep 2026 09:00 JST** (Sat 24:00 UTC). Do not claim anything not in the repo.

### Live vs pending (keep the form aligned with this)

**Live on Sepolia:** all 5 contracts (verified on Etherscan+Sourcify), World ID verify → `HumanRegistry.markVerified` (0xa081…58ff), voucher mint → `RareItems`, list/buy → 90/10 `Sold` (0xcd9b…6356, 0xfb5d…06f04, both MultiBaas-indexed), ENSv2 `rfclegends.eth` + permissioned resolver + sire subname, item metadata routes, guild chat + guild boss (PocketBase realtime), idle game with demo mode, market sale feed through MultiBaas.

**Pending (do NOT claim until landed):** demo video link. Everything else listed as live has been verified on Sepolia.

---

## Form copy

**Project name**
RFC Legends

**Short description** (97 chars)
Idle MMORPG: level up with your rooster companion. Real roosters live onchain as verifiable RWAs.

**Description** (trim to what's live — paste-ready)

RFC Legends is an idle MMORPG with classic job/stat/card progression, themed around Thai native rooster breeds. You play as a trainer adventuring with a rooster companion; both level up automatically, even offline (demo mode boosts rates for the video — always badged).

The game is backed by real animals. Each real rooster at Ninlanee Farm is an onchain RWA: the farm co-signs every mint (ring id, bloodline, hatch date), one ring id can only ever be one token, and the farm signs weekly health attestations anyone can relay onchain. Each bird gets an ENSv2 name; offspring are subnames of their sire, so a bloodline is verifiable by anyone.

Rare drops are the heart of the economy. Legendary items and monster cards mint from gameplay only — with a server-signed EIP-712 voucher and only to a World ID-verified wallet — and trade in an onchain Rare Market that splits every sale 90% seller / 10% platform inside the contract. One human, one account: a second wallet replaying the same World ID nullifier is rejected onchain.

No gambling, no betting, no real-world fight results. Everything is cartoon-art breeding, collecting and community.

**How it's made** (paste-ready for the showcase form)

The game is a Next.js 16 + React 19 app with a Phaser 3 canvas for the idle farm scene. A server-authoritative TypeScript engine simulates combat tick by tick and settles offline progress rate-based, so nothing about your progression is trusted to the client. State, guild chat and the guild boss live in PocketBase behind our API; wagmi and viem talk to five Solidity 0.8.28 contracts on Sepolia (a test-USDC, a World ID registry, an ERC-1155 for rare drops, a 90/10 marketplace, and an ERC-721 for the real roosters), all verified on Etherscan and covered by 105 Foundry tests at 100% line coverage.

Three sponsor pieces do the heavy lifting. World ID gates the economy: the IDKit widget proves personhood, our server verifies the proof against World's API with the wallet as the signal (apps/web/src/server/worldid/verify.ts), then records the nullifier onchain in HumanRegistry — a second wallet replaying the same nullifier is rejected by the contract itself. ENSv2 carries the pedigree: each rooster has a name under rfclegends.eth and offspring are subnames of their sire (e.g. chick01.theprawang.rfclegends.eth), with a permissioned resolver where only the farm's key can write weight/health records (ens/src/ensv2.ts, ens/scripts/attest.ts), and the rooster pages resolve those records live. Curvegrid MultiBaas indexes the contracts' events and powers the market's sale history through saved event queries (contracts/scripts/multibaas-setup.mjs, apps/web/src/lib/contracts/multibaas.ts) — the 90/10 split of every sale is readable straight from indexed Sold events.

Demo mode honesty: the live site runs with boosted EXP and drop rates so the full loop — leveling to 30, earning an MVP card, World ID verification, minting, listing, selling with the onchain 90/10 split — can be shown in minutes. The badge is always visible in the UI and the boosted rates are never presented as real. Everything onchain (contracts, verifications, sales, attestations) is real Sepolia activity; the birds shown are sample roosters with placeholder ring IDs until Ninlanee Farm's real records land.

**Tech stack** (for the form's list)

Solidity, Foundry, OpenZeppelin, Etherscan/Sourcify, TypeScript, Next.js 16, React 19, wagmi, viem, Phaser 3, PocketBase, PM2, ENSv2, World ID (IDKit), Curvegrid MultiBaas, Node.js.

**Partner prizes** (3 picks, one line each)

1. **World — Best Use of IDKit:** IDKit widget → server-side Portal verify (signal pinned to the wallet, one-time RP nonces, nullifier bound to one wallet) → onchain `HumanRegistry.markVerified`; unverified bots are rejected at mint and at listing, shown live in the demo.
2. **ENS — Best Use of ENSv2:** hierarchical pedigree — sire subnames under `rfclegends.eth` with a permissioned resolver where only the farm key can write health text records, resolved live on the rooster pages.
3. **Curvegrid — Best RWA Tokenization:** all five contracts linked in MultiBaas with event indexing; the market sale history page is served from MultiBaas event queries, and the RoosterRWA trust model (farm co-signature, one ring = one token) is documented for judges.

**World integration feedback** (mandatory — answers taken from docs/feedback/world.md)

- Minutes to first successful verify: **62** wall-clock (07:37Z → 08:39Z; ~20 min after Portal credentials + staging window existed).
- Blockers: staging verification now needs a 24h window + `x-staging-verification-token` header (developer-portal #2307, not in docs); the simulator ignored `connect_url`; the simulator has a single global identity.
- What was missing: docs don't cover the staging window/token; no testing page (404); docs never say `signal_hash` is caller-controlled and the examples forward the widget payload verbatim.
- Top improvement request: Portal-side rejection of nullifier reuse per action, plus a Portal-checked `expected_signal_hash` parameter (and server-pinned examples).

---

## Pre-submit checklist

- [x] RoosterRWA seed tx hashes cited (six mints + attestation + ENS writes, in README)
- [x] ENS register + resolver hashes cited
- [ ] Demo video recorded and linked
- [ ] Screenshots uploaded
- [ ] Repo README reviewed against repo reality one last time
- [ ] Final submit before 09:00 JST
