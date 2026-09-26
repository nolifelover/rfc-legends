# RFC Legends — demo video script (≤3:45, English voiceover)

Pace ≈ 135 wpm; total spoken ≈ 500 words. Actions match `docs/demo-runbook.md`
(wallets A/B/C, quoted on-screen text). Everything shown runs live on
Sepolia through the real UI — nothing staged, nothing sped up. Demo mode is
named aloud once. Never expand the "RFC" acronym. It's "Thai native breeds +
transparent pedigree", never a fighting reading.

> **Direction:** during segment 3, keep `/roosters` open in a SEPARATE
> browser window. Navigating the `/game` tab away remounts the drop toasts
> and swallows the Lv-30 toast.
>
> **VO timing:** record the voiceover AFTER picture lock — segment 3 must
> name the card that was actually clicked (Monster or MVP) in the final
> take.

Recording: 1920×1080, 100% zoom, prod build at https://rfclegends.rfcclub.app
(no dev badge), MetaMask on Sepolia, World App on the presenter's phone.

---

## 0:00–0:30 — Cold open: rejected bot, verified farm signature

**On screen (in order):** as wallet C, `/market` → **Mint as NFT** on MVP
Card #3001 → the red panel "⛔ Rejected `not_verified_human` Wallet
0xb8eb…529b hasn't verified with World ID…" — hold 3 s. Hard cut to
`/roosters/4`: scroll to the green strip "✓ attestation signature recovered
to 0x7E28…Ac39 — VERIFIED IN YOUR BROWSER VIA EIP-712" — hold 3 s. End on
the `/roosters` card grid (stay here; do not cut to the landing page).

> That's a bot being refused, and that's a farm signature checked against
> an onchain rooster record. RFC Legends is an idle RPG with one rule:
> anything valuable has to prove where it came from. Each rooster card is
> farm co-signed, and its ENSv2 name carries health records only the farm
> can write. Rare loot cashes out only through a World ID–verified human,
> and every sale splits 90/10 in the contract.

(~62 words, verbatim per critic)

## 0:30–1:05 — Gameplay (short)

**On screen:** runbook Scene 1 compressed: connect wallet A, create trainer
"Khun Gai", pick the Thep sire line, spend stat points, live combat running.
Burn a caption at the cut with the MEASURED time of the take — the runbook
rehearsal hit Lv 30 in 1:12, so unless the take measures otherwise:
**"+1:12 of live play, not sped up"**. A wrong number in a "not sped up"
caption is the one claim a judge can time; read it off the recording.

> This is the game. You create a trainer and pick a companion from one of
> five Thai native breed lines — I'm taking Thepbut, the same line as the
> sire we'll verify onchain next. Combat is server-authoritative and
> idle-style — it keeps going while you're away. I'm spending stat points,
> and the XP bar starts racing. One honest note: this build runs in demo
> mode with boosted rates, so we reach the levels that matter in minutes.
> Every transaction you're about to see is live on Sepolia.

(~75 words)

## 1:05–2:05 — RWA + ENSv2 pedigree + farm-only writes

**On screen:** `/roosters` in a SEPARATE browser window (see direction
note below), click **Thep Rawang** (token #4). Show the hero proof panel
rows, the attestation tiles, and OUR pedigree tree (sire ↑, chick01 ↓) —
stay on our UI; don't cut to explorer.ens.dev (unrehearsed). Then a
terminal split-screen — PASTE both commands (don't type them); each is a
simulation against the live resolver, no transaction is sent (verified to
produce exactly these outcomes):

```bash
# the studio's key tries to write the weight record
cast call 0x225774306d9ca8c79106b1b130E26BF26e90e9Af \
  "setText(bytes32,string,string)" $(cast namehash theprawang.rfclegends.eth) \
  "rfc.weight" "9999" \
  --from 0xBDF7E8605F71063368d2284d613D4A5d2Cbcc48f \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com
# → Error: execution reverted: EACUnauthorizedAccountRoles(...)

# the farm's key writes the same record (simulated, no tx sent)
cast call 0x225774306d9ca8c79106b1b130E26BF26e90e9Af \
  "setText(bytes32,string,string)" $(cast namehash theprawang.rfclegends.eth) \
  "rfc.weight" "9999" \
  --from 0x7E280F0698834631B468650aB791419A17B2Ac39 \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  && echo "accepted (simulated, no tx sent)"
# → prints: accepted (simulated, no tx sent)
```

Then open the farm's real write on Etherscan: tx `0xdcd08538…3f87`.

> Here's the core. The club mints each rooster as an RWA card, and the
> farm's key co-signs that the bird exists — one ring ID, one token. These
> ring IDs are samples until the farm's records arrive; the contracts,
> signatures and permissions are already live on Sepolia.
>
> The pedigree is ENSv2 itself: this chick really is a subname of its sire.
> Now watch the permissions. In this terminal — simulated against the live
> resolver — the studio's key tries to write the weight record: reverted.
> The farm's key: accepted. And here's a real one the farm signed earlier —
> the same record, changed onchain. The studio could only change that with
> a public, onchain grant.

(~112 words; the cast runs fill the rest)

## 2:05–3:15 — Drop, World ID, mint, sell — and who gets refused

**On screen:** runbook Scenes 2–6 compressed: the MVP Card drop toast → World ID QR
scan → green "Verified human ✓ … bound to one World ID" → mint → list at
10 → profile B buys → the SOLD receipt with the 90/10 bar and decoded
event → the MultiBaas panel ("indexed by Curvegrid MultiBaas") → back to
the bot C rejection (already seen cold — one beat, quick) → then wallet A2
verifying with the same phone → the red "Rejected
`nullifier_bound_to_other_wallet` … already linked to wallet 0xa29e…e5e7"
panel.

> Back in the game, the boss drops an MVP Card. First, proof of human: I
> scan with World App, and the proof is recorded onchain — one human, one
> wallet. I mint the card, list it at ten test USDC, and a second player
> buys.
> The receipt: ninety percent to the seller, ten to the club treasury in
> test USDC, split by the contract — and the sale is already indexed by
> Curvegrid MultiBaas.
>
> Who can't cash out? The bot — not a verified human. And this second
> wallet of mine: the same World ID is already bound to my first wallet,
> so it's refused too — enforced by the HumanRegistry contract, not just
> our database. Bots can grind all they want — they just can't cash out.

(~120 words)

## 3:15–3:45 — Vision (with proof holds)

**On screen:** slow pan across `/roosters`, end on the logo. The ~12 s the
vision used to spend on roadmaps is now deliberate holds instead: **3 s on
the 90/10 receipt**, **3 s on the "source: MultiBaas ✓" chip**, **4 s on
the second-wallet red panel** — let the proofs breathe before the close.

> This weekend is a vertical slice, but the pieces are the real system: a
> game worth playing, a pedigree you can verify yourself, and an economy
> gated by personhood.
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

## Staging-fallback VO variant

If production World App misbehaves (runbook §5), swap these lines:

- Segment 4: "I scan with World App" → "I verify with the World ID
  simulator" (the simulator tab is shown instead of the phone).
- Segment 4, second-wallet rejection: the bound address shown is the
  staging one (`0x4f6b…F395`, bound to A-staging) — read whichever
  address the red panel actually shows, don't memorize a number.

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
