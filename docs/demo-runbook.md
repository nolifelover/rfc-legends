# Demo runbook: drop economy beat (video 2:30–3:30)

Beat: an MVP boss drops a rare card, the player proves they're human with World ID and mints it on Sepolia, then lists it. A buyer pays in test USDC, and the 90/10 split shows onchain. A bot wallet, a second wallet of the same human, and a low-level player all get clear rejections.

Everything below was rehearsed end to end through the real UI on Sepolia on 2026-09-26 (see [Rehearsal evidence](#rehearsal-evidence)).

## Presenter checklist (5 min before recording)

- [ ] **MetaMask is on Sepolia**, in both browser profiles.
- [ ] **Accounts imported and renamed.** Keys are in `apps/web/.data/demo-wallets.json`; import each with Import account → private key.
  - Profile 1 (seller): **Demo A** = `prodA` `0xa29e…e5e7` (the active account when you start) and **Demo A2** = `prodA2` `0x57Dc…CdEF6`.
  - Profile 2 (buyer/bot): **Demo B** = `buyerB` `0x3A8A…deAB` and **Demo C** = `botC` `0xB8EB…529b`.
- [ ] **World App is open** on the presenter's phone: unlocked, up to date, signed in, with the **Orb-verified** World ID, on a good connection, notifications silenced.
- [ ] **Demo mode badge is visible.** "⚡ Demo mode: boosted rates" shows under the nav on /game and /market.
- [ ] **Production World ID.** Opening the verify widget shows a QR code but **no** "Testing in staging? Use the simulator" line. If that line appears, `WORLD_ENVIRONMENT` is still `staging` (see §1).
- [ ] **Browser is 1920×1080 at 100% zoom.** Maximize the window on a 1920×1080 display. On a bigger screen, set the window to exactly 1920×1080 with a window-resizer extension or the OS; DevTools device mode doesn't work here because it switches off when DevTools closes. Reset zoom with Ctrl/Cmd + 0. Hide the bookmarks bar and close other tabs.
- [ ] **Clean start.** Demo A has no character yet and isn't verified (see §6 if you're re-taking). Demo B holds test USDC. Demo C shows its unminted MVP Card #3001 on /market.

## 1. Environments

| | Video (primary) | Rehearsal / fallback |
|---|---|---|
| `WORLD_ENVIRONMENT` in `apps/web/.env.local` | `production` | `staging` |
| Who proves "human" | Presenter's real World App (phone). It needs the **Orb** proof-of-human credential and World ID 4.0. | World ID simulator in a browser tab |
| Seller wallet | **A** (`prodA`) | **A-staging** (`walletA`) |
| Second-wallet rejection | **A2** (`prodA2`), same phone | **A2-staging** (`walletA2`), same simulator |

Changing `WORLD_ENVIRONMENT` takes effect on the next request; the dev server reloads `.env.local` by itself. Staging also needs `WORLD_STAGING_VERIFICATION_TOKEN`, which is set and valid until **2026-09-27 08:19 UTC**.

> **Staging caveat:** the simulator has **one identity worldwide**, and it's bound forever (onchain) to A-staging `0x4f6b…F395`. In staging, only A-staging can be accepted. Every other wallet gets the second-wallet rejection.

> **Production caveat:** the presenter's World ID gets bound to the first wallet that verifies in production. **Don't rehearse the production verify.** Do the first production verify on camera with wallet A. Re-takes still work (see [Reset](#6-reset-for-re-takes)), but the card then says "Recorded in HumanRegistry onchain" instead of showing a fresh tx link.

## 2. Wallets

Private keys are in `apps/web/.data/demo-wallets.json` on the dev machine. That file is gitignored, mode 600, testnet only. Never paste the keys into the repo, chat or video.

| Id in the file | Role | Address | Sepolia ETH | State now |
|---|---|---|---|---|
| `prodA` | A: seller in the video | `0xa29edaa4cfe1D97dE5d05fb3cd097D9F5a7dE5e7` | 0.03 | fresh: no character, not verified |
| `prodA2` | A2: same presenter, second wallet | `0x57Dc7bA401ADc467d01224Eb84d5975E678CdEF6` | 0 (verify is server-paid) | fresh |
| `buyerB` | B: buyer | `0x3A8AFA4AAe276E0887D977649C5a4d008cDfdeAB` | ~0.029 | 90 test USDC, holds 1 Monster Card, **not verified** |
| `botC` | C: bot | `0xB8EB96af3aE58912B5b7b275258485523930529b` | 0.01 | character "Farm Bot 9000" Lv 55 with an unminted **MVP Card #3001**, never verified |
| `walletA` | A-staging | `0x4f6bAe095982b9C9c57d4A311634e1189d56F395` | ~0.029 | verified (staging), character "Khun Gai" Lv 35 with unminted drops |
| `walletA2` | A2-staging | `0x41410b26cbdA4c4caA2548DD5F7D5ab2c27d8673` | 0 | refused as a second wallet |

Top up from the deployer (`contracts/.env` `DEPLOYER_PRIVATE_KEY`) with at most 0.05 ETH per wallet.

**Import into MetaMask:** open MetaMask → account menu → **Add account or hardware wallet** → **Import account** → paste the `privateKey` → **Import**. Rename it (for example "Demo A") so the right account is on screen. Switch the network to **Sepolia**. Use a separate browser profile for B and C, so switching accounts never shows up on camera.

## 3. Pre-flight (T−15 min)

1. `curl -s http://127.0.0.1:8090/api/health` shows `API is healthy`. There must be exactly one `pocketbase serve` process.
2. The app loads at https://rfc-legends.earn.dev.rawinlab.com/market (or http://localhost:3000/market) and shows the **Demo mode: boosted rates** badge.
3. `apps/web/.env.local` has `WORLD_ENVIRONMENT=production`, `DEMO_MODE=true` and `NEXT_PUBLIC_DEMO_MODE=true`.
4. Presenter's phone: World App is up to date, and the World ID holds the Orb credential.
5. MetaMask: A, B and C are imported, on Sepolia, and each has ETH as listed above.
6. To show a fresh character, wallet A must not have one yet (see [Reset](#6-reset-for-re-takes)).

## 4. Shot list (production)

Expected on-screen text is quoted exactly as rehearsed.

### Scene 1: play to Base Lv 30 (wallet A)
1. Open **/game** and click **Connect wallet**, then pick A in MetaMask.
2. Type a trainer name (for example "Khun Gai"), pick a sire line (for example **Thep**), and click **Begin the journey**.
   Expected: the play screen with "Demo mode: boosted rates", "Sync now" and "SPEND STAT POINTS 48 left".
3. Spend points by clicking **+** on **STR, AGI and DEX** (about 8/6/6). That clearly speeds up kills. Keep the tab visible so live combat runs ("auto-syncs every few seconds"); a hidden tab only earns the slower offline rate. Rehearsal: Lv 1 to Lv 30 took about 4 minutes with points spent.
4. *(Optional, shows rejection c)* before Lv 30, open **Market** and press **Mint as NFT** on any drop.
   Expected: "⛔ Rejected `base_level_too_low` Base Lv 1: reach Base Lv 30 to mint rare drops."

### Scene 2: the drop, then Mint & sell
5. When a Monster Card or MVP Card drops, click the game's **Mint & sell →** popup. It opens `/market?dropId=0x…`. *(The game lane is adding this popup. Until it ships, click **Market** in the nav: every mintable drop is listed there.)*
   Expected: the drop card highlighted in yellow, "From your latest boss drop".

### Scene 3: World ID verify (wallet A)
6. In the **World ID · proof of human** card, click **Verify with World ID**.
7. MetaMask asks for a signature ("RFC Legends: confirm this is your wallet. Action: verify-world-id …"). Click **Sign**. It costs no gas.
8. The IDKit modal shows "Connect your World ID" with a QR code. Scan it with World App and approve.
9. Expected: the button reads "Verifying proof & recording onchain…", then the card turns green: "Verified human ✓ Wallet 0xa29e…e5e7 is bound to one World ID. It can mint and sell rare drops." with a **HumanRegistry.markVerified tx ↗** link. Step 1 of the progress row gets a ✓.

### Scene 4: mint and list (wallet A)
10. On the highlighted drop, click **Mint as NFT**. MetaMask first asks for a signature ("Action: mint-rare-drop … Drop: 0x…"); sign it. Then it asks you to confirm the `mintWithVoucher` transaction; confirm it.
    Expected: "Minted as ERC-1155 ✓ view tx ↗".
11. Under **Your minted items**, set a price (for example `10`) and click **List 1**. Confirm **setApprovalForAll** (only the first time), then the **list** transaction.
    Expected: "Listed ✓ Monster Card #1001 is in escrow and shows up in the listings below. view tx ↗". The listing shows "seller you" under **Rare Market listings**.

### Scene 5: buy and the 90/10 receipt (wallet B, second browser profile)
12. Open **/market** as B and click **+100 test USDC**. Confirm the transaction. Expected: "Balance: 100.00 USDC" (B already has 90, so it goes to 190).
13. On A's listing, click **Buy for 10.00 USDC**. Confirm **approve** (USDC), then **buy**.
14. Expected: the receipt card "SOLD ✓ · SPLIT ONCHAIN Monster Card #1001 × 1 for 10.00 USDC". It shows a 90% / 10% bar, "Seller receives (90%) 9.00 USDC … USDC transfer 9.00 ✓" and "RFC Club treasury (10%) 1.00 USDC to 0x845b…F4B2 … USDC transfer 1.00 ✓". Open **Decoded Sold event**, then click **View on Sepolia Etherscan ↗**.

### Scene 6: the rejections
15. **(a) Bot, wallet C:** open `/market` as C, then **Mint as NFT** on **MVP Card #3001**, then sign.
    Expected: "⛔ Rejected `not_verified_human` Wallet 0xb8eb…529b hasn't verified with World ID. Only verified humans can mint rare drops, so bot farms can't cash out."
    Selling is locked too. As **B** (holds a card, never verified), **Your minted items** shows "Selling is locked for this wallet…". Clicking **Verify with World ID to list** gives "⛔ Rejected `NotVerifiedHuman` … Refused onchain by the contract". That's RareMarket's own revert, simulated before any wallet prompt.
16. **(b) Same human, second wallet A2:** as A2, click **Verify with World ID**, sign, and scan with the **same phone**.
    Expected: "Rejected `nullifier_bound_to_other_wallet` This World ID is already linked to wallet 0xa29e…e5e7. One human, one wallet: a second wallet can't verify with the same World ID."
    Worth saying on camera: World's API accepts the repeat verification; our server and `HumanRegistry` refuse it.
17. **(c) Low level:** shown in step 4.

## 5. Staging fallback (World App misbehaves)

1. Set `WORLD_ENVIRONMENT=staging` in `apps/web/.env.local`.
2. Use **A-staging** instead of A. It's already verified and at Lv 35 with drops, so skip Scene 3, or show that it's already verified.
3. For 16(b), use **A2-staging**. After **Verify with World ID** and **Sign**, open https://simulator.worldcoin.org in another tab.
   - The widget's "Use the simulator" link didn't auto-load the request in our runs. In the simulator, click **Paste code**, paste the connection link (click the QR code in the widget to copy it), then click **Continue**.
   - Expected: the same 409 message, naming `0x4f6b…f395`.
4. Afterwards, set `WORLD_ENVIRONMENT` back to `production`.

## 6. Reset for re-takes

Use the PocketBase admin at http://127.0.0.1:8090/_/ (superuser credentials are in `apps/web/.env.local`). Filter by the wallet in **lowercase**.

| To redo… | Do this |
|---|---|
| Character creation | Delete the wallet's row in `players` and its rows in `drops` (game lane collections). |
| World ID verify on camera | Delete the wallet's row in `worldid_bindings`. The card goes back to "Not verified". Onchain, `HumanRegistry` keeps the record, so a re-verify passes with "Recorded in HumanRegistry onchain" and no new tx link. A different wallet with the same World ID is still refused. |
| Mint (daily limit 3 per wallet) | Delete today's rows for the wallet in `worldid_vouchers`, or raise `MINT_DAILY_LIMIT`. Each drop can only be minted once, so pick a fresh drop (demo mode drops plenty). |
| Listing | Click **Cancel listing** on your own listing to return the item from escrow. |
| Buyer funds | Click **+100 test USDC** again (the faucet caps each call at 10,000). |

## 7. Rehearsal evidence

Rehearsed through the real UI with an injected wallet in headless Chromium, on staging.

| Step | Result | Tx / evidence |
|---|---|---|
| A-staging verify | Verified, onchain | [`0xa081ee7f…858ff`](https://sepolia.etherscan.io/tx/0xa081ee7fd146ed9437061e71af91a39348a1f1c18ff28ee4985588388f0858ff) `markVerified` |
| (c) A-staging at Lv 1 mints | 403 `base_level_too_low` | 08:54:04Z |
| A-staging mints Monster Card #1001 | RareMinted | [`0x9b29e229…c5de0d`](https://sepolia.etherscan.io/tx/0x9b29e2294c3d1d712d72a64a16fddb940f99ce1fe614638a30d6b6fc61c5de0d) |
| A-staging approves the market | ApprovalForAll | [`0x2761d285…f4d8`](https://sepolia.etherscan.io/tx/0x2761d28589ed17fd8f9f07b13b96111d9253c6ffa12bc29b60f4385f3104f4d8) |
| A-staging lists #3 at 10 USDC | Listed | [`0xfcdc9756…c631b`](https://sepolia.etherscan.io/tx/0xfcdc9756305a802e18a847bbe625acff781d765b15a40d97b2e2d558e87c631b) |
| B faucet / approve / buy | Sold, 9.00 to seller / 1.00 to treasury | [`0xf6064a31…4732`](https://sepolia.etherscan.io/tx/0xf6064a31ae3c8ec324c91267e4dcc0a170fe651f9b0eef6c94f096d49f214732) · [`0xe3c1b9c3…49d0`](https://sepolia.etherscan.io/tx/0xe3c1b9c31953fb4b97a5ddceccd7c775113fc62d8f123aabb46426eedba249d0) · [`0xe8589a7e…e8b2`](https://sepolia.etherscan.io/tx/0xe8589a7eac98b042da03ed5375f42d99c2ab884f59f9ebb59ae6c7684fb0e8b2) |
| (a) C mints MVP Card #3001 | 403 `not_verified_human` | 09:05:26Z |
| (a) B (unverified) tries to resell | contract `NotVerifiedHuman`, no wallet prompt | 09:05:46Z |
| (b) A2-staging verifies | 409 `nullifier_bound_to_other_wallet` | 08:40:27Z |
