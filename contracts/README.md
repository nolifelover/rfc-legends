# RFC Legends — contracts

**One sentence:** five Solidity 0.8.28 contracts that put a game economy with verifiable real-world backing onchain — real roosters at Ninlanee Farm become ERC-721 RWAs with farm-signed health attestations, rare game drops become ERC-1155 tokens minted only from server-signed vouchers, and a peer-to-peer market splits every sale 90% seller / 10% RFC treasury inside the contract.

## Trust model

No single party can fake value in this system:

| Who | Key | Can do | Cannot do |
|---|---|---|---|
| **RFC Club** (issuer) | contract owner | submit a rooster registration, rotate keys, pause | mint without the farm's co-signature; touch sales proceeds |
| **Ninlanee Farm** (custodian) | `farmSigner` | co-sign every mint (vouching the bird + ring id exist), sign weekly attestations | mint or list anything by itself |
| **Game server** | `GAME_SIGNER` (attestor + voucher signer) | record a World ID verification, sign drop vouchers | mint to a wallet that isn't a verified human |
| **Player** | any wallet | hold items, buy, relay mints/attestations | list on the market unless World ID verified; re-spend a `dropId` or nullifier |

One bird = one token (`ringToken` uniqueness), one human = one account (nullifier binding), one drop = one mint (`dropMinted`). Sales settle 90/10 with rounding dust to the seller, enforced in-contract — see the [e2e receipt](#end-to-end-demo-beat) proving it on Sepolia.

## Deployments (Sepolia, chain 11155111)

Deployer `0x741Ab117d67ecA72a54d3669fb84e399bfE5Ed98`, start block 11784988. All five verified on Etherscan + Sourcify (`exact_match`). Addresses also live in [`deployments/sepolia.json`](deployments/sepolia.json) and are exported to the web app via [`../apps/web/src/lib/contracts/addresses.ts`](../apps/web/src/lib/contracts/addresses.ts).

| Contract | What it does | Address |
|---|---|---|
| [`MockUSDC`](src/MockUSDC.sol) | 6-decimal test USDC with a 10k/call faucet | [`0x28B851fd1b0DFD6fD820FF5305e8b9D74338624C`](https://sepolia.etherscan.io/address/0x28B851fd1b0DFD6fD820FF5305e8b9D74338624C) |
| [`HumanRegistry`](src/HumanRegistry.sol) | onchain World ID mirror; one human → one account | [`0x60e6d8aE3B3444f6E616634B6D8fA69FFb9619e5`](https://sepolia.etherscan.io/address/0x60e6d8aE3B3444f6E616634B6D8fA69FFb9619e5) |
| [`RareItems`](src/RareItems.sol) | ERC-1155 rare drops, voucher-only mint | [`0x35f5d11878F820B9fd69712Dea9387a54afD2144`](https://sepolia.etherscan.io/address/0x35f5d11878F820B9fd69712Dea9387a54afD2144) |
| [`RareMarket`](src/RareMarket.sol) | escrowed market, 90/10 split in-contract | [`0xC05Dd64c0B4e2fd1722E12B40d80044cF7963d3a`](https://sepolia.etherscan.io/address/0xC05Dd64c0B4e2fd1722E12B40d80044cF7963d3a) |
| [`RoosterRWA`](src/RoosterRWA.sol) | ERC-721 real roosters + farm attestations | [`0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7`](https://sepolia.etherscan.io/address/0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7) |

## Where the important bits are (file:line)

- **EIP-712 mint voucher** — typehash at [`src/RareItems.sol:35`](src/RareItems.sol#L35), verification + single-use `dropId` at [`src/RareItems.sol:84`](src/RareItems.sol#L84). TS twin: [`../apps/web/src/lib/contracts/eip712.ts`](../apps/web/src/lib/contracts/eip712.ts) — the viem-generated signature is verified inside Solidity by [`test/RoosterRWA.t.sol`](test/RoosterRWA.t.sol)'s `test_ViemFixedSignature_Verifies`.
- **Farm co-signature (custodian vouches the bird)** — `Registration` typehash at [`src/RoosterRWA.sol:51`](src/RoosterRWA.sol#L51), two-party mint at [`src/RoosterRWA.sol:127`](src/RoosterRWA.sol#L127) (RFC Club submits, farm signs ring id + bloodline + hatch date); weekly health records at [`src/RoosterRWA.sol:206`](src/RoosterRWA.sol#L206) with a strictly increasing per-token nonce.
- **90/10 split** — `FEE_BPS` at [`src/RareMarket.sol:22`](src/RareMarket.sol#L22); the exact math `fee = total * 1000 / 10000`, seller gets the remainder, at [`src/RareMarket.sol:119-120`](src/RareMarket.sol#L119-L120), settled atomically in [`buy`](src/RareMarket.sol#L113) (state written before transfers + `nonReentrant`).
- **One human, one account** — nullifier binding at [`src/HumanRegistry.sol:47`](src/HumanRegistry.sol#L47), replay rejection at [`src/HumanRegistry.sol:30`](src/HumanRegistry.sol#L30).

## Tests & coverage

```sh
forge test          # 105 tests, 5 suites — all green
forge coverage      # 100% line coverage on every file in src/
```

Negative paths covered: expired/tampered/wrong-signer/high-s signatures, cross-chain domain replay, `dropId` and registration-nonce replay, duplicate ring ids, impossible pedigrees (same parent, parent hatched after child), unverified humans at mint and list, fee-rounding (price floor keeps the fee nonzero), insufficient allowance/balance, reentrancy against a real listing (blocked), pause and key rotation on all three key roles.

## End-to-end demo beat

The prize flow — bot rejected → human verified → nullifier replay rejected → voucher mint → list → buy → exact 90/10 — runs against a real chain and prints a receipt with an Etherscan link:

```sh
cd ../e2e
npm install
npm run demo                            # anvil (zero env needed)
set -a; source ../contracts/.env; source ../apps/web/.env.local; set +a
npm run demo -- --rpc "$SEPOLIA_RPC_URL"   # Sepolia, fresh funded wallets
```

Latest Sepolia run: [tx `0xcd9b…6356`](https://sepolia.etherscan.io/tx/0xcd9b0a42baf8a9a4db9726abbb90ba17810f0cee02d7bce3801cf3d0756a6356) — seller +1.80 USDC, treasury +0.20 USDC, buyer holds the Monster Card.

Metadata: `RareItems.uri(id)` and `RoosterRWA.tokenURI(id)` point at the live app (`/api/items/{id}`, `/api/roosters/{id}`), served by [`../apps/web/src/app/api/items/[id]/route.ts`](../apps/web/src/app/api/items/[id]/route.ts) and [`../apps/web/src/app/api/roosters/[id]/route.ts`](../apps/web/src/app/api/roosters/[id]/route.ts).
