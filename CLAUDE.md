# RFC Legends — ETHGlobal Tokyo 2026

Hackathon project: an **idle MMORPG** (Ragnarok-style progression) where a player ("นายไก่", the trainer) adventures and levels up with a **rooster companion**. Real roosters sold as RWA cards by RFC Club and cared for by Ninlanee Farm live onchain with verifiable pedigree. Game name "RFC Legends" is provisional.

- **Deadline:** Sun 27 Sep 2026 **09:00 JST** (= Sat 26 Sep 2026 24:00 UTC). No extensions.
- **Track:** Classic. Everything must be written during the event. Do not copy existing RFC Club contracts or code. Business data and real rooster data are fine to use.
- **Chain:** Ethereum Sepolia (ENSv2 beta lives there; World ID, MultiBaas and Uniswap all work on EVM).
- **Target partner prizes (max 3):**
  1. World – Best Use of IDKit ($7.5k)
  2. ENS – Best Use of ENSv2 ($3k/$2k/$1k)
  3. Curvegrid – Best RWA Tokenization ($1k)

  Backups: Uniswap, Intercepta.

## Source of truth

- `docs/cowork-session/transcript.md` — the full planning conversation (prizes research, farm/RFC research, all design decisions, the user's answers). Read it before making product decisions.
- `docs/ethglobal-submission-draft.md` — form copy for the ETHGlobal project page, plus current submission status.
- `docs/ethglobal-tokyo-2026-prizes.md` — prize list and rules.
- `docs/RFC_Legends_GDD_v0.4.md` — **Game Design Document v0.4** (pandoc conversion of `docs/RFC_Legends_GDD_v0.4.docx`, 38 pages). It is the spec for stats, formulas, jobs, bloodlines, maps, cards, economy, the ENS naming scheme (§14.1), the hackathon plan (§19: vertical slice, demo script, team split, timeline), and long-term Ragnarok-derived mechanics (§22; the Rare Market sinks are §22.15). The `.docx` is the original. If the two disagree, the `.docx` wins. All balance numbers are provisional.

## Planned architecture (vertical slice for the demo)

- **Frontend:** Next.js (PWA) + Phaser for the isometric idle scene.
- **Idle engine:** Node.js/TypeScript, server-authoritative. Live combat is simulated tick by tick; offline rewards use rate-based settlement (capped at 12h).
- **Realtime:** Supabase Postgres + Realtime for guild chat and the guild boss.
- **Contracts (Solidity, Sepolia):**
  - ERC-721 real-rooster RWA with signed weekly farm attestations (weight, health)
  - ERC-1155 mintable rare drops
  - Rare Market that splits every sale **90% seller / 10% RFC** in-contract
- **ENSv2:** hierarchical subnames as the pedigree registry (sire → offspring). The permissioned resolver lets only the farm key write health records. No hard-coded names.
- **World ID (IDKit):** verified server-side before minting or selling rare items; also requires Base Lv 30. The demo must show both the accepted and the rejected (bot/unverified) path.
- **Curvegrid MultiBaas:** deployment, contract interaction, event indexing.

Demo beat (≈2:30–3:30 of a 4-min video): MVP boss drops a Monster Card → World ID verify → mint as NFT and list → buyer pays, 90/10 split visible onchain → unverified bot account rejected.

## Hard rules

- **No gambling, ever.** No betting, no wagering on fights, and real-world fight results never affect cards or prices. Pitch the concept as "Thai native breeds + transparent pedigree", not cockfighting.
- **Art is cartoon/collectible.** No blood, no injury, no animal harm.
- **No Ragnarok IP.** Don't use names, art or music such as Poring or Prontera. Borrow only the system mechanics, with Thai-themed content.
- **No real-money gacha** (Japan regulates it tightly).
- Premium items come **only from drops**, never sold directly by a shop. Common–Epic items trade in-game for soft currency, and the fees are burned. Legendary, Monster Card and MVP Card items (0.005–0.3% drop rate) can be minted and sold in the Rare Market.
- Daily tasks must take ≤ 10 minutes in total.

## Submission requirements (ETHGlobal + sponsors)

- A public GitHub repo with **frequent, incremental commits**. One big commit can get the project disqualified.
- Disclose AI tool usage (Claude was used for the GDD and scaffolding).
- Demo video: 2–4 min, ≥720p, clear voice audio (not music), never sped up.
- README must point to the exact files and lines where World ID, ENSv2 and MultiBaas are integrated.
- Curvegrid README format: one-sentence summary, team with social handles, setup steps, and MultiBaas feedback.
- World integration feedback (mandatory): minutes until the first successful verify, blockers, what was missing, and the top improvement request.
- Don't claim features in the submission text that aren't in the repo or demo. Judges check.

## Working notes

- The user writes in Thai. Reply in Thai and keep code and identifiers in English.
- Keep new domain names consistent with the transcript: Base/Job level, the 4 job lines (นักสู้, นักฟาร์ม, นักผสมพันธุ์, หมอไก่), the 5 sire lines (กุมารจีน, คิงคอง, เจ้าขุนทอง, เทพบุตร, แร๊พเตอร์), RWA Card vs Virtual Card, Rare Market, สมุดนายไก่, หอคอยพญาไก่.
