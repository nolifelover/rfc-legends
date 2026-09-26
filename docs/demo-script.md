# RFC Legends — demo video script (≤3:45, English voiceover)

Pace ≈ 135 wpm; total spoken ≈ 500 words. Actions match `docs/demo-runbook.md`
(wallets A/B/C, quoted on-screen text). Everything shown runs live on
Sepolia through the real UI — nothing staged, nothing sped up. Demo mode is
named aloud once. Never expand the "RFC" acronym. It's "Thai native breeds +
transparent pedigree", never a fighting reading.

Recording: 1920×1080, 100% zoom, prod build at https://rfclegends.rfcclub.app
(no dev badge), MetaMask on Sepolia, World App on the presenter's phone.

---

## 0:00–0:30 — Cold open: rejected bot, verified farm signature

**On screen (in order):** as wallet C, `/market` → **Mint as NFT** on MVP
Card #3001 → the red panel "⛔ Rejected `not_verified_human` Wallet
0xb8eb…529b hasn't verified with World ID…" — hold 3 s. Hard cut to
`/roosters/4`: scroll to the green strip "✓ attestation signature recovered
to 0x7E28…Ac39 — VERIFIED IN YOUR BROWSER VIA EIP-712" — hold 3 s. Cut to
the landing page hero.

> That's a bot being refused, and that's a farm signature checked against
> an onchain rooster record. RFC Legends is an idle RPG with one rule:
> anything valuable has to prove where it came from. Your companion's
> pedigree is an ENSv2 name the farm signs. Rare loot cashes out only
> through a World ID–verified human, and every sale splits 90/10 in the
> contract.

(~62 words, verbatim per critic)

## 0:30–1:05 — Gameplay (short)

**On screen:** runbook Scene 1 compressed: connect wallet A, create trainer
"Khun Gai", pick the Thep sire line, spend stat points, live combat running.
Burn a caption at the cut: **"+4 min of live play, not sped up"**.

> This is the game. You create a trainer, choose a rooster companion from
> one of five Thai native breed lines, and head out. Combat is
> server-authoritative and idle-style — it keeps going while you're away.
> I'm spending stat points, and the kills speed up. One honest note: this
> build runs in demo mode with boosted rates, so we reach the levels that
> matter in minutes. Everything else you're about to see is real Sepolia.

(~75 words)

## 1:05–2:05 — RWA + ENSv2 pedigree + farm-only writes

**On screen:** `/roosters`, click **Thep Rawang** (token #4). Show the hero
proof panel rows, the attestation tiles, the pedigree tree (sire ↑,
chick01 ↓). Open `chick01.theprawang.rfclegends.eth` in the ENS explorer
(https://explorer.ens.dev). Then a terminal split-screen — run BOTH cast
commands live (verified to produce exactly these outcomes):

```bash
# the studio's key tries to write the weight record
cast call 0x225774306d9ca8c79106b1b130E26BF26e90e9Af \
  "setText(bytes32,string,string)" $(cast namehash theprawang.rfclegends.eth) \
  "rfc.weight" "9999" \
  --from 0xBDF7E8605F71063368d2284d613D4A5d2Cbcc48f \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
# → Error: execution reverted: EACUnauthorizedAccountRoles(...)

# the farm's key writes the same record
cast call 0x225774306d9ca8c79106b1b130E26BF26e90e9Af \
  "setText(bytes32,string,string)" $(cast namehash theprawang.rfclegends.eth) \
  "rfc.weight" "9999" \
  --from 0x7E280F0698834631B468650aB791419A17B2Ac39 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
# → 0x  (accepted)
```

Then open the farm's real write on Etherscan: tx `0xdcd08538…3f87`.

> Here's the core. The club mints each rooster as an RWA card, and the
> farm's key co-signs that the bird exists — one ring ID, one token. These
> ring IDs are samples until the farm's records arrive; the contracts,
> signatures and permissions are already live on Sepolia.
>
> The pedigree is ENSv2 itself: this chick really is a subname of its sire.
> Now watch the permissions. In this terminal, the studio's key tries to
> write the weight record — reverted. The farm's key — accepted. The studio
> could only change that with a public, onchain grant.

(~112 words; the cast runs fill the rest)

## 2:05–3:15 — Drop, World ID, mint, sell — and who gets refused

**On screen:** runbook Scenes 2–6 compressed: the drop lands → World ID QR
scan → green "Verified human ✓ … bound to one World ID" → mint → list at
10 → profile B buys → the SOLD receipt with the 90/10 bar and decoded
event → the MultiBaas panel ("indexed by Curvegrid MultiBaas") → back to
the bot C rejection (already seen cold — one beat, quick) → then wallet A2
verifying with the same phone → the red "Rejected
`nullifier_bound_to_other_wallet` … already linked to wallet 0xa29e…e5e7"
panel.

> Back in the game, our boss drops a Monster Card. First, proof of human:
> I scan with World App, and the proof is recorded onchain — one human,
> one wallet. I mint the card, list it at ten, and a second player buys.
> The receipt: ninety percent to the seller, ten to the club treasury,
> split by the contract — and the sale is already indexed by Curvegrid
> MultiBaas.
>
> Who can't cash out? The bot — not a verified human. And this second
> wallet of mine: the same World ID is already bound to my first wallet,
> so it's refused too. Bot farms can't farm this economy.

(~120 words)

## 3:15–3:45 — Vision

**On screen:** slow pan across `/roosters`, end on the logo.

> This weekend is a vertical slice, but the pieces are the real system: a
> game worth playing, a pedigree you can verify yourself, and an economy
> gated by personhood. Next: more jobs, more maps, and every RWA across
> all of the club's chains — one game where collecting means something,
> because the bloodline is real.
>
> RFC Legends — Thai native breeds, transparent pedigree, on Ethereum.

(~68 words)

---

## Timing budget (135 wpm)

| Beat | Target | Words | Cumulative |
|---|---|---|---|
| Cold open | 0:00–0:30 | 62 | 0:30 |
| Gameplay | 0:30–1:05 | ~75 | 1:05 |
| RWA + ENSv2 + cast | 1:05–2:05 | ~112 (+casts) | 2:05 |
| Drop economy + rejections | 2:05–3:15 | ~120 | 3:15 |
| Vision | 3:15–3:45 | ~68 | 3:45 |

~437 spoken words ≈ 3:14 at 135 wpm, leaving ~30 s of breathing room for
the cast runs, the QR scan and the receipts.

## Never say / never show

- Never expand the "RFC" acronym.
- No betting, no fighting framing: "Thai native breeds + transparent
  pedigree" and idle adventuring, always.
- No Ragnarok names (no Poring, no Prontera, etc.).
- Always name demo mode for the boosted rates; never call samples real —
  the ring IDs are samples, and the UI says so.
- Don't claim "attests weekly" (it signs attestations; weekly in
  production) or "every name has its own registry" (offspring resolve
  through the hierarchy).
- Only claim what's on screen: if the guild features aren't visible in the
  final build, they aren't mentioned.
