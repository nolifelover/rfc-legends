# ETHGlobal submission — RFC Legends

## Status (2026-09-26, updated by eth-dev1 to match reality)

Project page: https://ethglobal.com/events/tokyo2026/project

- [x] Project created: name "RFC Legends", category Gaming, emoji 🐓
- [x] Public repo: https://github.com/nolifelover/rfc-legends (linked via GitHub Permissions)
- [x] Live demo (primary): https://rfclegends.rfcclub.app — production build, demo-mode badge visible. Mirror: https://rfc-legends.earn.dev.rawinlab.com
- [ ] Demo video: record 2–4 min, ≥720p, clear voice — script follows the e2e demo beat
- [ ] Images / screenshots
- [ ] Final submit — only after the video and the two pending tx hashes below are in

Deadline: **Sun 27 Sep 2026 09:00 JST** (Sat 24:00 UTC). Do not claim anything not in the repo.

### Live vs pending (keep the form aligned with this)

**Live on Sepolia:** all 5 contracts (verified on Etherscan+Sourcify), World ID verify → `HumanRegistry.markVerified` (0xa081…58ff), voucher mint → `RareItems`, list/buy → 90/10 `Sold` (0xcd9b…6356, 0xfb5d…60f04, both MultiBaas-indexed), ENSv2 `rfclegends.eth` + permissioned resolver + sire subname, item metadata routes, guild chat + guild boss (PocketBase realtime), idle game with demo mode, market sale feed through MultiBaas.

**Pending (do NOT claim until landed):** RoosterRWA farm co-signed mint + attestation tx hashes (eth-dev3's seed run), ENS register tx hash citation, demo video link.

---

## Form copy

**Project name**
RFC Legends

**Short description** (97 chars)
Idle MMORPG: level up with your rooster companion. Real roosters live onchain as verifiable RWAs.

**Description** (trim to what's live — paste-ready)

RFC Legends is an idle MMORPG with classic Ragnarok-style progression, themed around Thai native gamecock breeds. You play as a trainer adventuring with a rooster companion; both level up automatically, even offline (demo mode boosts rates for the video — always badged).

The game is backed by real animals. Each real rooster at Ninlanee Farm is an onchain RWA: the farm co-signs every mint (ring id, bloodline, hatch date), one ring id can only ever be one token, and the farm signs weekly health attestations anyone can relay onchain. Each bird gets an ENSv2 name; offspring are subnames of their sire, so a bloodline is verifiable by anyone.

Rare drops are the heart of the economy. Legendary items and monster cards mint from gameplay only — with a server-signed EIP-712 voucher and only to a World ID-verified wallet — and trade in an onchain Rare Market that splits every sale 90% seller / 10% platform inside the contract. One human, one account: a second wallet replaying the same World ID nullifier is rejected onchain.

No gambling, no betting, no real-world fight results. Everything is cartoon-art breeding, collecting and community.

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

- [ ] RoosterRWA seed tx hashes (mint + attestation) cited in README + here
- [ ] ENS register tx hash cited
- [ ] Demo video recorded and linked
- [ ] Screenshots uploaded
- [ ] Repo README reviewed against repo reality one last time
- [ ] Final submit before 09:00 JST
