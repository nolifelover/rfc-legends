# RFC Legends 🐓

**Your adventure companion is a real rooster — and the whole world can verify it.**

RFC Legends is an idle MMORPG where you and a rooster companion level up together, even while you're offline. Each rooster is a real bird at Ninlanee Farm in Thailand, tokenized as an RWA with a farm-co-signed identity, an ENSv2 pedigree name, and weekly onchain health attestations. Rare drops mint from gameplay with a World ID-verified wallet and trade in a Rare Market that splits every sale 90% seller / 10% platform, enforced by the contract — one human, one account, no bots, no gambling.

- **Live demo:** https://rfc-legends.earn.dev.rawinlab.com *(demo mode: boosted rates — the badge is visible in the UI; boosted rates are never presented as real)*
- **Demo video:** _placeholder — recorded before submission, 2–4 min, 720p+_
- **Contracts:** [contracts/README.md](contracts/README.md) — everything deployed and verified on Sepolia

## What's live on Sepolia (chain 11155111)

| Contract | Address | Etherscan |
|---|---|---|
| `MockUSDC` (test settlement token) | `0x28B851fd1b0DFD6fD820FF5305e8b9D74338624C` | [link](https://sepolia.etherscan.io/address/0x28B851fd1b0DFD6fD820FF5305e8b9D74338624C) |
| `HumanRegistry` (World ID mirror) | `0x60e6d8aE3B3444f6E616634B6D8fA69FFb9619e5` | [link](https://sepolia.etherscan.io/address/0x60e6d8aE3B3444f6E616634B6D8fA69FFb9619e5) |
| `RareItems` (ERC-1155 drops) | `0x35f5d11878F820B9fd69712Dea9387a54afD2144` | [link](https://sepolia.etherscan.io/address/0x35f5d11878F820B9fd69712Dea9387a54afD2144) |
| `RareMarket` (90/10 escrow market) | `0xC05Dd64c0B4e2fd1722E12B40d80044cF7963d3a` | [link](https://sepolia.etherscan.io/address/0xC05Dd64c0B4e2fd1722E12B40d80044cF7963d3a) |
| `RoosterRWA` (ERC-721 real roosters) | `0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7` | [link](https://sepolia.etherscan.io/address/0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7) |
| ENSv2 resolver / subname registry | `0x705c7f9f59eA8cFd87728BfAddC17121288f55FF` / `0x02a8349cbFee861260af5c4D1f3464B56Ec8EB70` | [resolver](https://sepolia.etherscan.io/address/0x705c7f9f59eA8cFd87728BfAddC17121288f55FF) · [registry](https://sepolia.etherscan.io/address/0x02a8349cbFee861260af5c4D1f3464B56Ec8EB70) · [theprawang subname registry](https://sepolia.etherscan.io/address/0x233133d68c5ad3Ef742846df8D09A788889D68c0) |

Key transactions:

- **Demo beat (the prize flow, end-to-end script):** bot rejected → human verified → nullifier replay rejected → voucher mint → list → buy → exact 1.80/0.20 split: [`0xcd9b…6356`](https://sepolia.etherscan.io/tx/0xcd9b0a42baf8a9a4db9726abbb90ba17810f0cee02d7bce3801cf3d0756a6356) and a MultiBaas-indexed second sale [`0xfb5d…60f04`](https://sepolia.etherscan.io/tx/0xfb5dccc04df2c16d291689680a1664d0c1dbb4a819c5c9f4314dd226ba106f04). Re-run it yourself: [e2e/demo-beat.ts](e2e/demo-beat.ts).
- **First World ID verification onchain** (`HumanVerified`): [`0xa081…58ff`](https://sepolia.etherscan.io/tx/0xa081ee7fd146ed9437061e71af91a39348a1f1c18ff28ee4985588388f0858ff)
- **ENSv2:** `rfclegends.eth` registered (commit–reveal, tx [`0x3254…bb14`](https://sepolia.etherscan.io/tx/0x3254a5054f2a3c884ba466921e46155f30a95ad41f8a4603d4a9235f01bbbb14)); PermissionedResolver proxy deployed ([`0xb8f4…2b8c`](https://sepolia.etherscan.io/tx/0xb8f434538e214d8ae0982d77f67f31a5e2e27961856e6089af774e161f22b8c0), live at [`0x705c7f9f…`](https://sepolia.etherscan.io/address/0x705c7f9f59eA8cFd87728BfAddC17121288f55FF)); UserRegistry proxy deployed ([`0x454d…fd37`](https://sepolia.etherscan.io/tx/0x454d28cc73b43b513cd88c210269e3367b5ef9ba3cfda0e3ec69910833b0fd37)); farm-scoped text-record authorization for `rfc.weight` ([`0xbc4d…300b`](https://sepolia.etherscan.io/tx/0xbc4d1fd2352a17ee3bd098c78b3a4b26f4fd357b4dfc99460bea7c059136300b)), `rfc.health` ([`0xb040…2d75`](https://sepolia.etherscan.io/tx/0xb04017044a3709c11688c1dd22ba12c27e9967ddcb5013a228928ce2e1062d75)) and `rfc.attestedAt` ([`0x9e11…3027`](https://sepolia.etherscan.io/tx/0x9e11cd8596d4f950a08298d2cec8285c13f9c442691b1b28ba5befa4224d3027)); sire subname `theprawang` created (registry `0x2331…68c0`).
- **RoosterRWA farm co-signed mints (sample birds, placeholder ring IDs; every mint carries the farm's EIP-712 `Registration` co-signature):**
  - token 1 `khunphaen.rfclegends.eth` (NL-S-0001) — [`0xa851…0106`](https://sepolia.etherscan.io/tx/0xa851ef1d226bc80104e4c79ccc4ceef21a2fc9e78d2c63c0e558c5d610390106)
  - token 2 `yodmuang.rfclegends.eth` (NL-S-0002) — [`0x45fd…762f`](https://sepolia.etherscan.io/tx/0x45fd07e40e284e368a880a7f8e73e2ca2f2033b54ac24b696c98a0480e53762f)
  - token 3 `sirithong.rfclegends.eth` (NL-S-0003) — [`0x4e5c…02de`](https://sepolia.etherscan.io/tx/0x4e5ca336bdb612fbf772e670c877ec3b24c1ff7081c3de34637cb5bf2e5602de)
  - token 4 `theprawang.rfclegends.eth` (NL-S-0004) — [`0x9627…88c`](https://sepolia.etherscan.io/tx/0x9627e4bdeb0104dc2fc5af92f5f73e1b5eaf9c5101940d4e018c280aae9ce88c)
  - token 5 `falconthong.rfclegends.eth` (NL-S-0005) — [`0xe9df…388`](https://sepolia.etherscan.io/tx/0xe9dfa4b6d0b7c12666abb028fb015ee55a7826cafc87cc54154e5950e3454388)
  - token 6 `chick01.theprawang.rfclegends.eth` (NL-C-0101, **sire = token 4** — the onchain pedigree link) — [`0x1957…aeea`](https://sepolia.etherscan.io/tx/0x1957cd91e64adc39cc245a1d46424ca61fb403767986e19915d3742601f9aeea)
- **First farm attestation relay:** _hash incoming from the ENS lane's seed run._

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[Next.js 16 PWA<br/>Phaser idle scene + HUD]
    IDK[IDKit widget]
    PBrt[PB JS SDK<br/>realtime]
  end
  subgraph Server[Next.js server routes]
    G[Idle engine<br/>server-authoritative]
    WV[/api/worldid/verify]
    VO[/api/voucher/mint]
    SA[/api/market/sales]
    GU[/api/game/guild/*]
  end
  subgraph Chain[Sepolia]
    HR[HumanRegistry]
    RI[RareItems ERC-1155]
    RM[RareMarket 90/10]
    RW[RoosterRWA ERC-721]
    ENS[ENSv2 subnames<br/>permissioned resolver]
  end
  PB[(PocketBase<br/>players · drops · nullifiers<br/>guild chat · boss)]
  MB[MultiBaas<br/>event indexing + queries]
  FARM[Ninlanee Farm key]
  GAME[Game server key<br/>GAME_SIGNER]

  UI --> G
  IDK --> WV --> HR
  G --> VO -->|EIP-712 voucher| RI
  UI -->|wagmi| RI & RM
  RM -->|Sold| MB --> SA
  GU --> PB
  UI <--> PBrt
  FARM -->|EIP-712 attestation + co-signed mint| RW
  FARM -->|farm-key only writes| ENS
  GAME -->|markVerified + vouchers| HR & RI
```

## Sponsor integrations (exact file:line)

**World — Best Use of IDKit.** Server-side proof verification then an onchain mirror:
- Proof verify + nullifier binding: [`apps/web/src/server/worldid/verify.ts:62`](apps/web/src/server/worldid/verify.ts#L62) (`verifyHuman`), route [`apps/web/src/app/api/worldid/verify/route.ts:9`](apps/web/src/app/api/worldid/verify/route.ts#L9), status check [`…/status/route.ts:8`](apps/web/src/app/api/worldid/status/route.ts#L8)
- Mint voucher gate (verified human + Base Lv ≥ 30 + rarity + daily limit): [`apps/web/src/server/worldid/voucher.ts:24-55`](apps/web/src/server/worldid/voucher.ts#L24) (`MIN_BASE_LEVEL`, `issueMintVoucher`), route [`apps/web/src/app/api/voucher/mint/route.ts:7`](apps/web/src/app/api/voucher/mint/route.ts#L7)
- Widget + rejected-path UI: [`apps/web/src/components/worldid/WorldIdWidget.tsx:18`](apps/web/src/components/worldid/WorldIdWidget.tsx#L18), [`VerifyHuman.tsx:46`](apps/web/src/components/worldid/VerifyHuman.tsx#L46)
- Onchain enforcement: [`contracts/src/HumanRegistry.sol:47`](contracts/src/HumanRegistry.sol#L47) (one human → one account); the bot-rejection path is asserted on Sepolia by [e2e/demo-beat.ts](e2e/demo-beat.ts) steps 1–2.

**ENS — Best Use of ENSv2.** Hierarchical pedigree as subnames, farm-key-scoped resolver writes:
- ENSv2 toolkit (deploy permissioned resolver + subname registry, register, create sire subnames): [`ens/src/ensv2.ts:51`](ens/src/ensv2.ts#L51) (`deployUserRegistry`), [`:104`](ens/src/ensv2.ts#L104) (`deployResolver`), [`:131`](ens/src/ensv2.ts#L131) (`ensureRegistered`)
- Farm attestation relay (EIP-712 farm signature → contract + scoped ENS text records): [`ens/scripts/attest.ts`](ens/scripts/attest.ts)
- Live resolution in the app: [`apps/web/src/lib/ens/resolve.ts:14`](apps/web/src/lib/ens/resolve.ts#L14) (`ENSV2`), pedigree page `/roosters/[id]`

**Curvegrid — Best RWA Tokenization (MultiBaas).** Contracts linked with event indexing; the market sale feed is served from MultiBaas queries:
- Setup (idempotent): [`contracts/scripts/multibaas-setup.mjs`](contracts/scripts/multibaas-setup.mjs) — uploads the five ABIs + bytecode, links each Sepolia address, saves `rfc-sold`, `rfc-rare-minted`, `rfc-attestation-recorded`, `rfc-rooster-minted`
- REST helper: [`apps/web/src/lib/contracts/multibaas.ts:60`](apps/web/src/lib/contracts/multibaas.ts#L60) (`getSaleHistory` executes the saved query)
- Visible integration: [`apps/web/src/app/api/market/sales/route.ts`](apps/web/src/app/api/market/sales/route.ts) — returns `source: "multibaas"` today; verify with `curl .../api/market/sales` or `?query=rfc-rare-minted`
- The RWA trust model (farm co-signature, one ring = one token): [`contracts/src/RoosterRWA.sol:127`](contracts/src/RoosterRWA.sol#L127), explained in [`contracts/README.md`](contracts/README.md)

## Setup

```sh
git clone https://github.com/nolifelover/rfc-legends && cd rfc-legends

# contracts (Foundry) — build, test, coverage
cd contracts && forge build && forge test   # 105 tests, 100% lines on src/
cp .env.example .env                        # fill the names in the table below
./scripts/export-web.sh                     # typed ABIs + addresses for the app

# web app (Next.js 16)
cd ../apps/web && npm install && cp .env.example .env.local   # fill names
npx next dev                                # http://localhost:3000

# backend (PocketBase: players, drops, nullifiers, guild chat/boss)
cd ../../pocketbase && ./fetch.sh && ./run.sh   # 127.0.0.1:8090

# e2e demo beat (anvil out of the box; Sepolia with --rpc)
cd ../e2e && npm install && npm run demo
```

Environment variables (names only; each `.env.example` carries them):

| File | Names |
|---|---|
| `contracts/.env` | `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `GAME_SIGNER_ADDRESS`, `FARM_SIGNER_ADDRESS`, `TREASURY_ADDRESS`, `ETHERSCAN_API_KEY`, `RARE_ITEMS_BASE_URI`, `ROOSTER_BASE_URI`, `MULTIBAAS_DEPLOYMENT_URL`, `MULTIBAAS_API_KEY` |
| `apps/web/.env.local` | `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_SEPOLIA_RPC_URL`, `SEPOLIA_RPC_URL`, `GAME_SIGNER_PRIVATE_KEY`, `NEXT_PUBLIC_WORLD_APP_ID`, `NEXT_PUBLIC_WORLD_ACTION`, `NEXT_PUBLIC_ENS_PARENT_NAME`, `NEXT_PUBLIC_POCKETBASE_URL`, `POCKETBASE_URL`, `POCKETBASE_SUPERUSER_EMAIL`, `POCKETBASE_SUPERUSER_PASSWORD`, `MULTIBAAS_DEPLOYMENT_URL`, `MULTIBAAS_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `DEMO_MODE` |
| `ens/.env` | `SEPOLIA_RPC_URL`, `FARM_SIGNER_PRIVATE_KEY`, `ENS_OWNER_PRIVATE_KEY` |

Production deploy (build + pm2, one command): [`scripts/deploy.sh`](scripts/deploy.sh).

## Team

| Member | Role | Handle |
|---|---|---|
| Todsaporn Sangboon | Fullstack development | [@nolifelover](https://github.com/nolifelover) |
| Jakkarin Sanguanwong | Other | — |
| Tanabut Krinoonsingha | Other | — |

**AI tool disclosure:** Claude (multi-agent) was used for planning, the GDD, code, and automated review passes. All integration feedback notes are human-reviewed.

## Hard rules we build by

No gambling — no betting, no wagering, real-world fight results never touch cards or prices; this is a game about Thai native breeds and transparent pedigree. Cartoon art only — no blood, no injury, no animal harm. No Ragnarok IP — systems inspiration only, all names/art/music are original Thai-themed content. Premium items come only from drops, never a shop; no real-money gacha.

## Sponsor feedback notes

- World ID (mandatory integration feedback — minutes to first verify, blockers, asks): [`docs/feedback/world.md`](docs/feedback/world.md)
- Curvegrid MultiBaas (friction + timeline): [`docs/feedback/multibaas.md`](docs/feedback/multibaas.md)
