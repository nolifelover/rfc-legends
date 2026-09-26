# RFC Legends contracts — real roosters as RWAs, a voucher-gated drop economy, and a 90/10 onchain market

**Summary (one sentence):** RFC Legends turns each real rooster at Ninlanee Farm into a verifiable onchain asset, so rare drops minted from World ID-verified gameplay carry provenance no virtual pet can. *(23 words)*

## What holding a RoosterRWA token means

One ERC-721 token = one living rooster in the custody of Ninlanee Farm (RFC Club's partner farm).

- **Custody stays at the farm.** The bird never leaves; the token records *who the bird belongs to*, plus its ring id, sire line (5 Thai native breeds) and onchain pedigree (sire/dam tokens).
- **Two parties vouch at mint.** RFC Club (issuer) submits the registration, and Ninlanee Farm (custodian) co-signs an EIP-712 `Registration` covering ring id, bloodline and hatch date — neither party can invent a bird alone. One ring id can ever map to one token.
- **Weekly health records.** The farm signs `Attestation`s (weight, health score, note); anyone can relay them onchain, and the latest one is always readable (`latestAttestation`) and mirrored to ENSv2 text records.
- **In production, redemption would be**: transfer of the token = transfer of the bird's registered ownership; the farm honors whoever holds the token when they visit, and an eventual buy-back/visit program would be a separate, farm-signed flow. **This hackathon build grants no legal claim** — it is a provenance and pedigree demo on Sepolia testnet.

## Trust model

| Who | Key | Can do | Cannot do |
|---|---|---|---|
| **RFC Club** (issuer) | contract owner | submit a rooster registration, rotate keys, pause | mint without the farm's co-signature; touch sales proceeds |
| **Ninlanee Farm** (custodian) | `farmSigner` | co-sign every mint, sign weekly attestations | mint or list anything by itself |
| **Game server** | `GAME_SIGNER` | record a World ID verification, sign drop vouchers | mint to a wallet that isn't a verified human |
| **Player** | any wallet | hold items, buy, relay mints/attestations | list unless World ID verified; re-spend a `dropId` or nullifier |

One bird = one token, one human = one account, one drop = one mint. Sales settle **90% seller / 10% RFC treasury** inside the contract (rounding dust to the seller) — proven on Sepolia by the [e2e receipt](#end-to-end-demo-beat).

## Deployments (Sepolia, chain 11155111)

Deployer `0x741Ab117d67ecA72a54d3669fb84e399bfE5Ed98`, start block 11784988. All five verified on Etherscan + Sourcify (`exact_match`). Addresses also in [`deployments/sepolia.json`](deployments/sepolia.json), exported to the app by [`../apps/web/src/lib/contracts/addresses.ts`](../apps/web/src/lib/contracts/addresses.ts).

| Contract | What it does | Address |
|---|---|---|
| [`MockUSDC`](src/MockUSDC.sol) | 6-decimal test USDC, 10k/call faucet | [`0x28B851fd…`](https://sepolia.etherscan.io/address/0x28B851fd1b0DFD6fD820FF5305e8b9D74338624C) |
| [`HumanRegistry`](src/HumanRegistry.sol) | onchain World ID mirror; one human → one account | [`0x60e6d8aE…`](https://sepolia.etherscan.io/address/0x60e6d8aE3B3444f6E616634B6D8fA69FFb9619e5) |
| [`RareItems`](src/RareItems.sol) | ERC-1155 rare drops, voucher-only mint | [`0x35f5d118…`](https://sepolia.etherscan.io/address/0x35f5d11878F820B9fd69712Dea9387a54afD2144) |
| [`RareMarket`](src/RareMarket.sol) | escrowed market, 90/10 split in-contract | [`0xC05Dd64c…`](https://sepolia.etherscan.io/address/0xC05Dd64c0B4e2fd1722E12B40d80044cF7963d3a) |
| [`RoosterRWA`](src/RoosterRWA.sol) | ERC-721 real roosters + farm attestations | [`0x99Cc8889…`](https://sepolia.etherscan.io/address/0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7) |

## Where the important bits are (file:line)

- **EIP-712 mint voucher** — typehash [`src/RareItems.sol:35`](src/RareItems.sol#L35), verification + single-use `dropId` at [`src/RareItems.sol:84`](src/RareItems.sol#L84). TS twin: [`../apps/web/src/lib/contracts/eip712.ts`](../apps/web/src/lib/contracts/eip712.ts); a viem-generated signature is verified inside Solidity by `test_ViemFixedSignature_Verifies` in [`test/RoosterRWA.t.sol`](test/RoosterRWA.t.sol).
- **Farm co-signature (custodian vouches the bird)** — `Registration` typehash [`src/RoosterRWA.sol:51`](src/RoosterRWA.sol#L51), two-party mint [`src/RoosterRWA.sol:127`](src/RoosterRWA.sol#L127), weekly records [`src/RoosterRWA.sol:206`](src/RoosterRWA.sol#L206).
- **90/10 split** — `FEE_BPS` [`src/RareMarket.sol:22`](src/RareMarket.sol#L22); `fee = total * 1000 / 10000`, seller keeps the remainder, at [`src/RareMarket.sol:119-120`](src/RareMarket.sol#L119-L120), settled atomically in [`buy`](src/RareMarket.sol#L113) (state before transfers + `nonReentrant`).
- **One human, one account** — [`src/HumanRegistry.sol:47`](src/HumanRegistry.sol#L47), replay rejection [`src/HumanRegistry.sol:30`](src/HumanRegistry.sol#L30).

## MultiBaas

Status: **LIVE.** All five contracts are uploaded and linked with event indexing, and the market sale history is served through MultiBaas event queries — `/api/market/sales` currently returns `source: "multibaas"` with the real Sepolia sale (tx [`0xfb5d…60f04`](https://sepolia.etherscan.io/tx/0xfb5dccc04df2c16d291689680a1664d0c1dbb4a819c5c9f4314dd226ba106f04), decoded `Sold` with the exact 1.80/0.20 split). Verify yourself: `curl '.../api/market/sales'` (field `source`), or `?query=rfc-rare-minted` for the other feeds.

- Setup (idempotent, one command): [`scripts/multibaas-setup.mjs`](scripts/multibaas-setup.mjs) — creates the five contracts (label+ABI+bytecode), links each Sepolia address with event indexing, and saves four queries: `rfc-sold` ([`Sold`](src/RareMarket.sol#L74)), `rfc-rare-minted` ([`RareMinted`](src/RareItems.sol#L52)), `rfc-attestation-recorded` + `rfc-rooster-minted` ([`RoosterRWA`](src/RoosterRWA.sol#L96-L101)).
- REST helper: [`../apps/web/src/lib/contracts/multibaas.ts`](../apps/web/src/lib/contracts/multibaas.ts) — `getSaleHistory()` (line 60) executes the saved `rfc-sold` query over `GET /api/v0/queries/rfc-sold/results`; `runEventQuery()` runs any of the four.
- Visible integration: [`../apps/web/src/app/api/market/sales/route.ts`](../apps/web/src/app/api/market/sales/route.ts) — the market UI reads the 90/10 feed here, with a direct-RPC fallback for pre-indexing history and `?raw=1` for the unprocessed rows.
- Full timeline and friction notes (required feedback): [`../docs/feedback/multibaas.md`](../docs/feedback/multibaas.md). The short version: the event-query model is excellent — decoded, alias-named rows straight into the UI — but the endpoint reference renders empty without JavaScript and several schema rules (lowercase labels, required bytecode, `inputIndex` on fields, operator `equal`) only surface as raw SQL errors, so first contact took ~15 minutes instead of ~5.

## Tests & coverage

```sh
forge test          # 105 tests, 5 suites — all green
forge coverage      # 100% line coverage on every file in src/
```

Negative paths covered: expired/tampered/wrong-signer/high-s signatures, cross-chain domain replay, `dropId` and registration-nonce replay, duplicate ring ids, impossible pedigrees (same parent, parent hatched after child), unverified humans at mint and list, fee rounding (price floor keeps the fee nonzero), insufficient allowance/balance, reentrancy against a real listing (blocked), pause and key rotation on all three key roles.

## End-to-end demo beat

The prize flow — bot rejected → human verified → nullifier replay rejected → voucher mint → list → buy → exact 90/10 — runs against a real chain and prints a receipt with an Etherscan link:

```sh
cd ../e2e && npm install
npm run demo                               # anvil, zero env
set -a; source ../contracts/.env; source ../apps/web/.env.local; set +a
npm run demo -- --rpc "$SEPOLIA_RPC_URL"   # Sepolia, fresh funded wallets
```

- Monster Card sale (90/10 proof): [tx `0xcd9b…6356`](https://sepolia.etherscan.io/tx/0xcd9b0a42baf8a9a4db9726abbb90ba17810f0cee02d7bce3801cf3d0756a6356)
- RWA mints (farm co-signed, sample birds with placeholder ring IDs): khunphaen [`0xa851…0106`](https://sepolia.etherscan.io/tx/0xa851ef1d226bc80104e4c79ccc4ceef21a2fc9e78d2c63c0e558c5d610390106), yodmuang [`0x45fd…762f`](https://sepolia.etherscan.io/tx/0x45fd07e40e284e368a880a7f8e73e2ca2f2033b54ac24b696c98a0480e53762f), sirithong [`0x4e5c…02de`](https://sepolia.etherscan.io/tx/0x4e5ca336bdb612fbf772e670c877ec3b24c1ff7081c3de34637cb5bf2e5602de), theprawang [`0x9627…88c`](https://sepolia.etherscan.io/tx/0x9627e4bdeb0104dc2fc5af92f5f73e1b5eaf9c5101940d4e018c280aae9ce88c), falconthong [`0xe9df…388`](https://sepolia.etherscan.io/tx/0xe9dfa4b6d0b7c12666abb028fb015ee55a7826cafc87cc54154e5950e3454388), and chick01 (sire = theprawang, token 4 → 6, the pedigree link) [`0x1957…aeea`](https://sepolia.etherscan.io/tx/0x1957cd91e64adc39cc245a1d46424ca61fb403767986e19915d3742601f9aeea). Farm attestation relay on theprawang (EIP-712 farm sig, nonce 2): [`0xd4c7…1ac4`](https://sepolia.etherscan.io/tx/0xd4c79038486075afa7d04176945303e75432733a274d26bd70d61dc600a61ac4), mirrored to ENS by the farm key (`rfc.weight`/`rfc.health`/`rfc.attestedAt`; contract and ENS agree at 4350 g, health 98).

Metadata: `RareItems.uri(id)` → `<host>/api/items/{id}` and `RoosterRWA.tokenURI(id)` → `<host>/api/roosters/{id}` (currently the dev host via `setBaseURI`; flips to `https://rfclegends.rfcclub.app` in the production deploy), served by [`../apps/web/src/app/api/items/[id]/route.ts`](../apps/web/src/app/api/items/[id]/route.ts) and [`../apps/web/src/app/api/roosters/[id]/route.ts`](../apps/web/src/app/api/roosters/[id]/route.ts).

## Full setup

```sh
git clone <repo> && cd rfc-legends
# contracts
cd contracts && forge build && forge test
cp .env.example .env            # fill the names below
./scripts/export-web.sh         # typed ABIs + addresses for the web app
# web app
cd ../apps/web && npm install && cp .env.example .env.local   # fill names
npx next dev                    # http://localhost:3000
# backend (player state, guild chat/boss)
cd ../../pocketbase && ./fetch.sh && ./run.sh   # 127.0.0.1:8090
# e2e
cd ../e2e && npm install && npm run demo
```

Environment variables (names only; `.env.example` files carry them):

| File | Names |
|---|---|
| `contracts/.env` | `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `GAME_SIGNER_ADDRESS`, `FARM_SIGNER_ADDRESS`, `TREASURY_ADDRESS`, `ETHERSCAN_API_KEY`, `RARE_ITEMS_BASE_URI`, `ROOSTER_BASE_URI`, `MULTIBAAS_DEPLOYMENT_URL`, `MULTIBAAS_API_KEY` |
| `apps/web/.env.local` | `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_SEPOLIA_RPC_URL`, `SEPOLIA_RPC_URL`, `GAME_SIGNER_PRIVATE_KEY`, `NEXT_PUBLIC_WORLD_APP_ID`, `NEXT_PUBLIC_WORLD_ACTION`, `NEXT_PUBLIC_ENS_PARENT_NAME`, `NEXT_PUBLIC_POCKETBASE_URL`, `POCKETBASE_URL`, `POCKETBASE_SUPERUSER_EMAIL`, `POCKETBASE_SUPERUSER_PASSWORD`, `MULTIBAAS_DEPLOYMENT_URL`, `MULTIBAAS_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `DEMO_MODE` |
| `ens/.env` | `SEPOLIA_RPC_URL`, `FARM_SIGNER_PRIVATE_KEY`, `ENS_OWNER_PRIVATE_KEY` |

Deploy to Sepolia: `cd contracts && forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify`.

## Team

| Member | Role | Handle |
|---|---|---|
| Jakkarin Sanguanwong | Other | — |
| Tanabut Krinoonsingha | Other | — |
| Todsaporn Sangboon | Fullstack development | — |
