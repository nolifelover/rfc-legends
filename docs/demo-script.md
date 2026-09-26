# RFC Legends — demo video script (3:40 target, English voiceover)

Voiceover pace ≈ 140 wpm. Actions match `docs/demo-runbook.md` exactly
(wallets A/B/C, expected on-screen text quoted there). Never say anything
that isn't live: everything shown here runs on Sepolia through the real UI.

Recording: 1920×1080, 100% zoom, prod build at https://rfclegends.rfcclub.app
(no dev badge), MetaMask on Sepolia, World App on the presenter's phone.
The demo-mode badge will be visible — that's correct, keep it in frame and
mention it once (below).

---

## 0:00–0:30 — The problem

**On screen:** landing page (https://rfclegends.rfcclub.app) scrolling to the
"Real roosters from Ninlanee Farm" section; then a quick cut to
`/roosters` cards.

> Great bloodlines are worth money — and that makes them easy to fake. A
> paper pedigree can be copied, edited, or invented. And in online games,
> the same story: leaderboard and economy rewards get farmed by bot
> accounts, not people.
>
> RFC Legends ties both together. An idle MMORPG where your companion is a
> real rooster, from a real Thai farm — with a pedigree that lives onchain,
> so it can't be faked. And an item economy where only verified humans can
> cash out.

(~72 words)

## 0:30–1:30 — Gameplay

**On screen:** Scene 1 of the runbook: connect wallet A, create trainer
"Khun Gai", pick the Thep sire line, spend stat points, watch live idle
combat; the "Demo mode: boosted rates" badge stays in frame.

> This is the game. You create a trainer — I'll call him Khun Gai — and
> choose a rooster companion from one of five Thai native sire lines.
>
> Combat is server-authoritative and idle-style: your trainer adventures
> even while you're away. I'm spending stat points on strength, agility and
> dexterity, and you can see the kills speed up.
>
> One honest note: this build runs in demo mode with boosted rates, so we
> can reach the levels that matter for this video in minutes, not weeks.
> Everything else you'll see — every transaction, every record — is real
> Sepolia.

(~100 words; combat footage fills the remaining time)

## 1:30–2:30 — RWA + ENSv2 pedigree + farm attestation

**On screen:** open `/roosters`, click **Thep Rawang** (token #4): the hero
proof panel (Contract / Token / Attestation tx / Farm signer / ENS name
rows), the signature-recovery block, the attestation tiles, then scroll to
the pedigree tree showing `chick01` below and the sire above; open
`chick01.theprawang.rfclegends.eth` in the ENS app.

> Here's the core of the project. Each of these cards is one real bird at
> Ninlanee Farm — a real RWA, minted as an NFT where the club issues the
> card and the farm co-signs that the bird exists. One ring, one token.
>
> The proof panel at the top is all live: the contract, the token, the
> latest farm attestation, and the farm's signer address — and this green
> block means we just verified, in the browser, that the attestation's
> EIP-712 signature recovers to that farm key.
>
> The pedigree is ENSv2 itself. The family tree you're looking at is the
> name hierarchy: chick01-dot-theprawang really is a subname of its sire,
> each with its own onchain registry. And only the farm's key can write
> weight and health records — the game studio can't. Ninlanee Farm attests
> weekly: four thousand three hundred fifty grams, health ninety-eight.

(~150 words — if running long, drop the final sentence's numbers)

## 2:30–3:30 — Drop economy, World ID, the 90/10 split, and the bot

**On screen:** runbook Scenes 2–6, compressed: the drop lands; World ID
verify (QR scan with the phone, green "Verified human ✓"); mint; list at 10;
switch profile to B, buy; the SOLD receipt with the 90/10 bar and the
decoded event; then bot C's red rejection panel.

> Back in the game, our boss drops a Monster Card — rare loot that can
> become a real NFT.
>
> First, proof of human. I scan the QR with World App; the proof verifies
> and is recorded onchain — one human, one wallet.
>
> Now I mint the card and list it for ten test dollars. A second player
> buys it — and here's the receipt: ninety percent to the seller, ten to
> the RFC Club treasury, split by the contract itself, not by a promise.
>
> And the bot? It tries to mint the MVP Card — and gets rejected: not a
> verified human. A second wallet of the same person is rejected too,
> because one World ID binds to one wallet. Bot farms can't cash out here.

(~130 words)

## 3:30–4:00 — Vision

**On screen:** slow pan across `/roosters`, then back to the landing page
roadmap section; end on the logo.

> This weekend is a vertical slice, but the world behind it is real:
> ninety-nine real roosters at Ninlanee Farm, waiting for their pedigrees
> to go onchain. Next: more jobs, more maps, arena seasons, and every RWA
> across all of RFC Club's chains — one game where collecting means
> something, because the bloodline is real.
>
> RFC Legends — Thai native breeds, transparent pedigree, on Ethereum.

(~72 words)

---

## Timing budget

| Beat | Target | Words | Cumulative |
|---|---|---|---|
| Problem | 0:00–0:30 | ~72 | 0:30 |
| Gameplay | 0:30–1:30 | ~100 | 1:30 |
| RWA + ENSv2 | 1:30–2:30 | ~150 | 2:30 |
| Drop economy | 2:30–3:30 | ~130 | 3:30 |
| Vision | 3:30–4:00 | ~72 | 4:00 (≈3:40 spoken) |

If the RWA beat runs long on camera (QR scan etc.), trim the gameplay
voiceover — the combat footage speaks for itself.

## Never say / never show

- No betting, no fighting framing: it's "Thai native breeds + transparent
  pedigree" and idle adventuring, always.
- No Ragnarok names (no Poring, no Prontera, etc.).
- Don't call the boosted rates "the game's balance" — always name demo mode.
- Don't claim multiplayer guild chat/boss unless it is visible on screen in
  the final build; if absent, cut the vision mention of arena seasons
  accordingly.
