# Interfaces: the contract between workstreams

Every lane builds against this file. If you need to change something here, message the manager (`eth-tokyo-8f [1b51cb]`) first. Don't invent a parallel format.

Deadline: **2026-09-26 24:00 UTC**. Chain: **Ethereum Sepolia (11155111)**.

## 1. Lanes and directory ownership

Only edit paths your lane owns. If you need something in another lane's path, message its owner or the manager.

| Lane | Owner | Paths |
|---|---|---|
| Contracts + MultiBaas | eth-dev1 | `contracts/**`, `e2e/**`, `apps/web/src/app/api/items/**`, `apps/web/src/app/api/market/**`, guild (`apps/web/src/app/api/game/guild/**`, `apps/web/src/components/guild/**`, `pocketbase/pb_migrations/*_guild_*.js`), deploy (`scripts/**`), `apps/web/src/lib/contracts/**` (ABIs, addresses, viem helpers) |
| Game (shell, idle engine, Phaser) | eth-dev2 | `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/app/(game)/**`, `apps/web/src/app/api/game/**`, `apps/web/src/game/**`, `apps/web/src/server/game/**`, `apps/web/src/components/game/**`, `apps/web/src/components/providers.tsx`, `apps/web/src/lib/wagmi.ts`, `apps/web/public/assets/**`, `apps/web/src/app/globals.css` |
| RWA + ENSv2 pedigree | eth-dev3 | `ens/**`, `apps/web/src/app/roosters/**`, `apps/web/src/app/api/ens/**`, `apps/web/src/app/api/roosters/**`, `apps/web/src/lib/ens/**`, `apps/web/src/components/pedigree/**` |
| Drop economy (World ID, voucher, mint, Rare Market UI) | manager's subagent | `apps/web/src/app/api/worldid/**`, `apps/web/src/app/api/voucher/**`, `apps/web/src/server/worldid/**`, `apps/web/src/lib/worldid/**`, `apps/web/src/components/worldid/**`, `apps/web/src/components/market/**`, `apps/web/src/app/market/**` |
| Submission docs (delegated) | eth-dev1 | `README.md`, `docs/ethglobal-submission-draft.md` |
| Manager | eth-tokyo-8f | `docs/**` (except the delegated files above), root files, `apps/web/package.json`, `apps/web/package-lock.json`, `.gitignore`, `**/.env.example` |

**Dependencies:** nobody edits `apps/web/package.json` or runs `npm install <pkg>` in `apps/web`. Message the manager with the package name, and the manager installs it. Already installed: `next@16`, `react@19`, `wagmi@3`, `viem@2`, `@tanstack/react-query@5`, `@worldcoin/idkit@4.3.0`, `phaser@3`, `pocketbase@0.28` (JS SDK), `zod`, `vitest`, `tailwindcss@4`.

**Next.js 16 has breaking changes.** Read `apps/web/node_modules/next/dist/docs/` before writing routes or config.

**Dev server:** one shared `next dev` runs on `http://localhost:3000` and hot-reloads everyone's changes. Don't start a second one in `apps/web`. To type-check, run `cd apps/web && npx tsc --noEmit`.

## 2. Git rules (shared working tree)

- Always work in `/home/dev/eth-tokyo`.
- Commit small and often (ETHGlobal disqualifies one-big-commit repos). Commit every time something compiles or works.
- Commit **only** your own paths, like this:
  `git add -- <your paths> && git commit -m "feat(contracts): ..." -- <your paths>`
- Never use `git add -A`, `git add .`, `git commit -a`, `stash`, `checkout`, `reset`, `rebase`, `push`, or `submodule update`. The manager pushes.
- If you hit `index.lock`, wait 2 seconds and retry.
- Use conventional prefixes: `feat(contracts)`, `feat(game)`, `feat(ens)`, `feat(worldid)`, `feat(market)`, `test(...)`, `docs(...)`, `fix(...)`.
- Never commit secrets. `.env` and `.env.*` are gitignored. Commit `.env.example` files with names only.

## 3. Identity

- **Player = wallet address** (lowercase hex). The game engine keys all state by address. The voucher `to` field is the same address.
- The demo uses three wallets:
  - **A**: the verified human (seller)
  - **B**: the buyer
  - **C**: the bot, which is never verified and gets rejected
- A second wallet held by the same human as A must also be rejected, because its nullifier is already bound to A.

## 4. Contracts (eth-dev1): `contracts/src/`

Solidity 0.8.28, OpenZeppelin v5.7 (`@openzeppelin/contracts/...`). All contracts must have Foundry tests in `contracts/test/`.

### 4.1 `HumanRegistry.sol`
World ID result mirrored onchain. The game server calls it after it verifies a World ID proof server-side.
```solidity
address public attestor;                                   // game server key (GAME_SIGNER)
mapping(address => bool) public isVerified;
mapping(uint256 => address) public nullifierOwner;         // one human -> one account
function markVerified(address account, uint256 nullifierHash) external; // onlyAttestor; reverts NullifierAlreadyUsed if bound to another account
event HumanVerified(address indexed account, uint256 indexed nullifierHash);
error NotAttestor(); error NullifierAlreadyUsed(address boundTo);
```

### 4.2 `RareItems.sol` (ERC-1155)
Mintable rare drops. The contract mints only with a server-signed voucher, and only to a verified human.
```solidity
struct MintVoucher { address to; uint256 itemId; uint256 amount; bytes32 dropId; uint256 deadline; }
// EIP-712 domain: name "RFCLegendsRareItems", version "1", chainId, verifyingContract
// typehash: keccak256("MintVoucher(address to,uint256 itemId,uint256 amount,bytes32 dropId,uint256 deadline)")
function mintWithVoucher(MintVoucher calldata v, bytes calldata signature) external;
//   reverts: VoucherExpired, InvalidSigner, DropAlreadyMinted(dropId), NotVerifiedHuman(to)
address public voucherSigner;          // GAME_SIGNER
HumanRegistry public humanRegistry;
mapping(bytes32 => bool) public dropMinted;
function uri(uint256 id) public view returns (string memory); // base URI + id, e.g. https://<app>/api/items/{id}
event RareMinted(address indexed to, uint256 indexed itemId, uint256 amount, bytes32 indexed dropId);
```

### 4.3 `RareMarket.sol`
Escrowed listings for RareItems, paid in MockUSDC. It splits each sale **90% seller / 10% treasury** in the contract.
```solidity
uint16 public constant FEE_BPS = 1000;     // 10%
address public treasury;                   // RFC Club treasury
function list(uint256 itemId, uint256 amount, uint256 unitPrice) external returns (uint256 listingId);
//   requires humanRegistry.isVerified(msg.sender) else NotVerifiedHuman; pulls items into escrow (seller must setApprovalForAll)
function buy(uint256 listingId, uint256 amount) external;
//   buyer must approve USDC; transfers 90% to seller, 10% to treasury, items to buyer
function cancel(uint256 listingId) external;  // seller only; returns escrow
function getListing(uint256 listingId) external view returns (Listing memory);
event Listed(uint256 indexed listingId, address indexed seller, uint256 indexed itemId, uint256 amount, uint256 unitPrice);
event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 amount, uint256 total, uint256 sellerProceeds, uint256 fee);
event Cancelled(uint256 indexed listingId);
```

### 4.4 `MockUSDC.sol`
Test USDC: ERC-20 with 6 decimals and a public `mint(address to, uint256 amount)` faucet capped at 10,000 USDC per call. Testnet only.

### 4.5 `RoosterRWA.sol` (ERC-721)
One token = one real rooster at Ninlanee Farm. The farm signs weekly attestations.
```solidity
struct Rooster { string name; string ringId; uint8 sireLine; uint64 hatchedAt; uint256 sireTokenId; uint256 damTokenId; string ensName; }
// sireLine: 0 กุมารจีน (kumarnjeen), 1 คิงคอง (kingkong), 2 เจ้าขุนทอง (chaokhunthong), 3 เทพบุตร (thepbut), 4 แร๊พเตอร์ (raptor)
function mintRooster(address to, Rooster calldata r, uint64 nonce, bytes calldata farmSig) external returns (uint256 tokenId);
//   onlyOwner (RFC Club issues) AND farmSigner co-signs (Ninlanee attests the bird exists)
//   EIP-712 typehash: keccak256("Registration(string ringId,uint8 sireLine,uint64 hatchedAt,uint256 sireTokenId,uint256 damTokenId,address to,uint64 nonce)")
//   reverts DuplicateRing (one ringId = one token), unknown/self parent, parent hatched after child, sireLine > 4
function setFarmSigner(address newSigner) external;                                       // onlyOwner, emits FarmSignerRotated
function tokenURI(uint256 tokenId) public view returns (string memory);                   // <ROOSTER_BASE_URI><id> -> /api/roosters/{id}
function setEnsName(uint256 tokenId, string calldata ensName) external;                 // onlyOwner
address public farmSigner;                                                                // Ninlanee key
struct Attestation { uint256 tokenId; uint32 weightGrams; uint8 healthScore; string note; uint64 checkedAt; uint64 nonce; }
// EIP-712 domain: name "RFCLegendsRoosterRWA", version "1"
// typehash: keccak256("Attestation(uint256 tokenId,uint32 weightGrams,uint8 healthScore,string note,uint64 checkedAt,uint64 nonce)")
function submitAttestation(Attestation calldata a, bytes calldata signature) external;    // anyone can relay; signer must be farmSigner; nonce strictly increasing per token
function latestAttestation(uint256 tokenId) external view returns (Attestation memory);
event AttestationRecorded(uint256 indexed tokenId, uint32 weightGrams, uint8 healthScore, uint64 checkedAt, uint64 nonce);
event RoosterMinted(uint256 indexed tokenId, address indexed to, uint8 sireLine, uint256 sireTokenId, uint256 damTokenId, string ringId, uint64 hatchedAt, string ensName);
event EnsNameSet(uint256 indexed tokenId, string ensName);
event FarmSignerRotated(address indexed previous, address indexed current);
// AttestationRecorded also carries note and the EIP-712 digest
```

### 4.6 Deployment output
`forge script` writes `contracts/deployments/sepolia.json`:
```json
{ "chainId": 11155111, "HumanRegistry": "0x…", "RareItems": "0x…", "RareMarket": "0x…", "MockUSDC": "0x…", "RoosterRWA": "0x…",
  "gameSigner": "0x…", "farmSigner": "0x…", "treasury": "0x…", "startBlock": 0 }
```
eth-dev1 also exports typed ABIs and addresses to `apps/web/src/lib/contracts/` (`abis.ts` with `as const` ABIs, `addresses.ts` reading the JSON). Every other lane imports from there.

## 5. Game engine (eth-dev2): server-side module API

Server-authoritative. The server computes state on each request from elapsed time: it simulates live combat with a deterministic seed and settles offline time rate-based, capped at 12h. There's no background worker, so this works on serverless too.

Storage goes behind a `GameStore` interface. The JSON file store in `apps/web/.data/` is for tests and offline dev. The real store is **PocketBase** (see §5b), because a file store breaks on serverless and on multiple instances.

Other lanes call these functions from `apps/web/src/server/game/index.ts`:
```ts
getPlayer(address: string): Promise<Player | null>        // Player { address, name, baseLevel, jobLevel, sireLine, stats, exp, ... }
getDrop(address: string, dropId: `0x${string}`): Promise<Drop | null>
// Drop { dropId (bytes32 hex), itemId: number, rarity: 'common'|'rare'|'epic'|'legendary'|'monster_card'|'mvp_card', status: 'unminted'|'minting'|'minted', droppedAt }
listDrops(address: string): Promise<Drop[]>
setDropStatus(address: string, dropId: `0x${string}`, status: Drop['status'], txHash?: string): Promise<void>
```

**Item IDs:** `1xxx` = Monster Card, `2xxx` = Legendary equipment, `3xxx` = MVP Card. Only IDs ≥ 1000 with rarity legendary, monster_card or mvp_card can be minted. The catalog lives in `apps/web/src/game/data/items.ts` (eth-dev2) and includes the name, rarity, image and a Thai-themed description. Don't use Ragnarok names.

**Demo mode:** `DEMO_MODE=true` boosts EXP and the MVP drop rate so the video can reach Base Lv 30 and an MVP drop in minutes. The UI must show a visible **"Demo mode: boosted rates"** badge. Never present boosted rates as real.

**HTTP (game UI):** `GET /api/game/state?address=`, `POST /api/game/create`, `POST /api/game/allocate`, `POST /api/game/sync`. eth-dev2 defines the bodies.

## 5b. PocketBase (replaces Supabase, decided 2026-09-26)

- Binary v0.40.4 lives in `pocketbase/` (`./fetch.sh`, `./run.sh`). It serves `http://127.0.0.1:8090`, and the admin UI is at `/_/`.
- The schema is code: JS migrations in `pocketbase/pb_migrations/`, prefixed by lane.
  - Game lane (eth-dev2) owns `*_game_*.js` and `*_guild_*.js`: `players`, `drops` and `guild_messages` / `guild_boss`.
  - World ID lane owns `*_worldid_*.js`: a `worldid_bindings` collection with a **UNIQUE index on nullifier**, plus the RP nonces.
- Server code connects with the superuser credentials (`POCKETBASE_SUPERUSER_*`) through the `pocketbase` JS SDK, using one shared helper in `apps/web/src/server/pb.ts` (manager-owned).
- Collections are locked to superuser by default (null API rules). Only `guild_messages` and `guild_boss` are publicly listable and subscribable for realtime. Writes still go through server routes, which attach the verified wallet address.

## 6. Drop economy (World ID lane)

- `POST /api/worldid/verify`, body `{ address, result }`, where `result` is what the IDKit widget returns.
  1. Verify the proof server-side with World's API. The `signal` must be the wallet address.
  2. Reject if the `nullifier_hash` is already bound to a different address (store it server-side, and it's also enforced onchain).
  3. Call `HumanRegistry.markVerified(address, nullifier)` with GAME_SIGNER.
  4. Respond `{ verified: true, txHash }` or `{ verified: false, reason }`.
- `POST /api/voucher/mint`, body `{ address, dropId }`.
  - Checks, in order: verified human, Base Lv ≥ 30, drop owned + unminted + mintable rarity, daily mint limit.
  - On success, returns `{ voucher, signature }`. The player's wallet then sends `RareItems.mintWithVoucher`.
  - On failure, returns 403 with `{ reason }` naming the failed check. The UI must show this reason; it's the rejected path World wants to see.
- Market UI: list, buy and cancel through wagmi. After a buy, show the 90/10 split as a Sepolia Etherscan link to the tx plus the decoded `Sold` event.
- Mandatory World feedback: log timestamps for when IDKit work starts and when the first verify round-trip succeeds. Put them in `docs/feedback/world.md`.

## 7. RWA + ENSv2 (eth-dev3)

- The parent name comes from config, `NEXT_PUBLIC_ENS_PARENT_NAME`. It's never hard-coded.
- Rooster names are subnames of their sire: `thepbut.<parent>` → `chick01.thepbut.<parent>`.
- Text records per rooster, all resolved live in the UI:
  - `rfc.contract`, `rfc.tokenId`, `rfc.sireLine`, `rfc.ringId`
  - `rfc.weight`, `rfc.health`, `rfc.attestedAt` (the last three are written by the farm key only, through the permissioned resolver)
  - plus `avatar` and `url`
- `ens/scripts/attest.ts` signs a farm attestation, relays it to `RoosterRWA.submitAttestation`, and writes the same values to the ENS text records with the farm key.
- The `/roosters/[tokenId]` page shows the RWA card, the latest onchain attestation, and the live pedigree tree from ENS (sire ↑, offspring ↓).

## 8. Environment variables

`contracts/.env`
```
SEPOLIA_RPC_URL=
DEPLOYER_PRIVATE_KEY=
GAME_SIGNER_ADDRESS=
FARM_SIGNER_ADDRESS=
TREASURY_ADDRESS=
ETHERSCAN_API_KEY=
MULTIBAAS_DEPLOYMENT_URL=
MULTIBAAS_API_KEY=
```
`apps/web/.env.local`
```
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_SEPOLIA_RPC_URL=
SEPOLIA_RPC_URL=
GAME_SIGNER_PRIVATE_KEY=
NEXT_PUBLIC_WORLD_APP_ID=
NEXT_PUBLIC_WORLD_ACTION=
# World ID 4 may need more RP keys; the World ID lane adds them here
NEXT_PUBLIC_ENS_PARENT_NAME=
MULTIBAAS_DEPLOYMENT_URL=
MULTIBAAS_API_KEY=
POCKETBASE_URL=http://127.0.0.1:8090
NEXT_PUBLIC_POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_SUPERUSER_EMAIL=
POCKETBASE_SUPERUSER_PASSWORD=
DEMO_MODE=true
```
`ens/.env`
```
SEPOLIA_RPC_URL=
FARM_SIGNER_PRIVATE_KEY=
ENS_OWNER_PRIVATE_KEY=
```

## 8b. Decisions made during the build

- **English-first UI** (08:08 UTC). Judges are international. Thai stays as flavor: sire-line names with romanization, map and farm names.
- **World ID 4** needs an RP (`WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`). The demo uses `WORLD_ENVIRONMENT=production` with a real World App. Staging needs a 24h token (World portal PR #2307).
- **Key hygiene** (C3.1, 08:30 UTC). All contracts take `initialOwner` and are Ownable. HumanRegistry adds `revoke(account)` (the nullifier stays bound), `setAttestor`, `pause` and `unpause`. RareItems adds `setVoucherSigner`, `pause` and `unpause`. RareMarket adds `setTreasury`, uses SafeERC20 and enforces `MIN_UNIT_PRICE` = 0.01 USDC so the fee is never zero. The ERC-1155 `{id}` is 64 lowercase hex characters with no `0x`.
- **Data layer: PocketBase replaces Supabase** (user decision). See §5b.
- **Domains** (user decision). **The primary live demo is `https://rfclegends.rfcclub.app`.** It runs on the rfctv host stream-edge-01 (103.13.28.97) through docker compose plus an nginx vhost, and Cloudflare Full reaches a self-signed origin cert on :443 (D2). **Fallback mirror: `https://rfc-legends.earn.dev.rawinlab.com`.**
  - At feature freeze it serves the production build (`next start` on :3100). The dev server then moves to `rfc-legends-dev.earn.dev.rawinlab.com`.
  - PocketBase realtime for browsers goes through `/pb/` on the same host. Development uses `*.earn.dev.rawinlab.com`, e.g. `https://rfc-legends.earn.dev.rawinlab.com`. Both route through Nginx Proxy Manager on the build host.
- **World ID app** was configured through the Portal MCP: `app_3f8e9b7d13a05589ac975fa80d253e6e`, RP `rp_fca4ae340a0dd412`, action `mint-rare-drop` (production and staging). Portal v4 accepts nullifier reuse, so our server-side binding is the sybil guard.
- **Sepolia deployment** (C6): MockUSDC `0x28B851fd1b0DFD6fD820FF5305e8b9D74338624C`, HumanRegistry `0x60e6d8aE3B3444f6E616634B6D8fA69FFb9619e5`, RareItems `0x35f5d11878F820B9fd69712Dea9387a54afD2144`, RareMarket `0xC05Dd64c0B4e2fd1722E12B40d80044cF7963d3a`, RoosterRWA `0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7`. Start block 11784988.
- **RoosterRWA mint is co-signed by the farm key** (08:20 UTC, from the blind RWA critic): one ringId = one token.

## 9. Hard rules (from CLAUDE.md)

No gambling, no betting, no fight results. Art is cartoon with no blood or injury. No Ragnarok IP (names, art or music). No real-money gacha. Premium items come only from drops. Don't claim anything in the UI or docs that doesn't work.

## 10. Checkpoints (UTC)

| Time | Must be true |
|---|---|
| 08:30 | Scaffold pushed; contracts compile; ENSv2 go/no-go decided (one subname created and read back on Sepolia) |
| 11:30 | Contracts tested and deployed to Sepolia; World ID verify round-trips locally; idle loop playable |
| 15:30 | Demo beat works end-to-end on Sepolia |
| 18:30 | Feature freeze; live demo deployed |
| 20:30 | README with file:line pointers; World and Curvegrid feedback written; video recorded |
| 22:00 | Submitted (the 2h buffer isn't optional) |
