# RFC Legends — ENSv2 pedigree & RWA tooling

Everything the RWA + ENSv2 lane does onchain, with the Sepolia evidence.
Names are never hard-coded: the parent comes from `ENS_PARENT_LABEL`
(scripts) / `NEXT_PUBLIC_ENS_PARENT_NAME` (web).

## Live objects (Sepolia 11155111)

| Object | Address / name |
|---|---|
| Parent name | `rfclegends.eth` |
| PermissionedResolver (v1, superseded) | `0x705c7f9f59eA8cFd87728BfAddC17121288f55FF` |
| **PermissionedResolver (hardened, live)** | `0x225774306d9ca8c79106b1b130E26BF26e90e9Af` |
| UserRegistry (parent's subname registry) | `0x02a8349cbFee861260af5c4D1f3464B56Ec8EB70` |
| RoosterRWA (eth-dev1) | `0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7` |
| Farm key (Ninlanee) | `0x7E280F0698834631B468650aB791419A17B2Ac39` |

Canonical ENSv2 beta deployment set (verified onchain via `ROOT_REGISTRY()`
through the entry Universal Resolver proxy viem ships,
`0xeEeE…eEeE`): ETHRegistry `0x657ea849…`, ETHRegistrar `0xabe76f6c…`,
VerifiableFactory `0x9e726eb5…`, registration paid in ENS's MockUSDC
`0x16f95d91…` (public mint).

## ENSv2 hierarchy = the pedigree

`rfclegends.eth` → foundation birds (`theprawang.rfclegends.eth`) →
offspring in the **sire's own child UserRegistry**
(`chick01.theprawang.rfclegends.eth`). Each bird carries text records
(`rfc.contract`, `rfc.tokenId`, `rfc.sireLine`, `rfc.ringId`, `url`, …)
resolved live through the entry Universal Resolver; its `addr` record points
at the current RoosterRWA token holder (the name follows the asset).

## Permission model (the load-bearing claim)

On the hardened resolver **only the farm key can write the health records**
`rfc.weight` / `rfc.health` / `rfc.attestedAt` — granted per-name and per-key
via `authorizeTextRoles`. The namespace owner deliberately holds **admin
bits only** (it can grant/revoke but not write those keys); it writes its
own keys (identity, lineage, links) through per-name+per-key grants.
Verified onchain after hardening:

| Check | Result |
|---|---|
| owner writes `rfc.sireLine` | ✓ allowed |
| owner writes `rfc.weight` | ✗ reverts `EACUnauthorizedAccountRoles` |
| farm writes `rfc.weight` | ✓ allowed |
| farm writes `rfc.sireLine` | ✗ reverts |
| third party writes anything | ✗ reverts |

## Evidence — Sepolia transactions

Registration & deployment:
- register `rfclegends.eth` (commit-reveal, MockUSDC):
  [0x3254a5054f2a3c884ba466921e46155f30a95ad41f8a4603d4a9235f01bbbb14](https://sepolia.etherscan.io/tx/0x3254a5054f2a3c884ba466921e46155f30a95ad41f8a4603d4a9235f01bbbb14)
- resolver v1 deploy: [0xb8f43453…f22b8c0](https://sepolia.etherscan.io/tx/0xb8f434538e214d8ae0982d77f67f31a5e2e27961856e6089af774e161f22b8c0)
- UserRegistry deploy: [0x454d28cc…33b0fd37](https://sepolia.etherscan.io/tx/0x454d28cc73b43b513cd88c210269e3367b5ef9ba3cfda0e3ec69910833b0fd37)

Hardening (fresh admin-only root, per-key grants, repoint):
- hardened resolver deploy: [0xdc48502b46a805dca41983b4b46ed1a251a6ddaab2ac9f0c0de6097bd6d275f9](https://sepolia.etherscan.io/tx/0xdc48502b46a805dca41983b4b46ed1a251a6ddaab2ac9f0c0de6097bd6d275f9)
- repoint `rfclegends.eth` resolver (children inherit by wildcard): [0x74945419…9f508ea](https://sepolia.etherscan.io/tx/0x7494541950d7b6975f8082fa09bcb5c5e835f269a65e00a4f1edba9719f508ea)
- farm grant `rfc.weight` @ khunphaen (first of 18): [0xf97c389f009bb24db52784653c7c3e4f370c835a75a1cd885752ef25d372f39d](https://sepolia.etherscan.io/tx/0xf97c389f009bb24db52784653c7c3e4f370c835a75a1cd885752ef25d372f39d)
- revoke of the earlier per-name all-keys grant (why hardening was needed): [0x9c0229969b57ce4f63c8df8e0c4cefc08f10b973faa164a7ef23f52a6a642bfd](https://sepolia.etherscan.io/tx/0x9c0229969b57ce4f63c8df8e0c4cefc08f10b973faa164a7ef23f52a6a642bfd)

Farm-co-signed mints on RoosterRWA (EIP-712 `Registration`, unique ringId,
one bird = one token):

| Token | Bird | ENS name | Mint tx |
|---|---|---|---|
| 1 | NL-S-0001 | khunphaen.rfclegends.eth | [0xa851ef1d…0390106](https://sepolia.etherscan.io/tx/0xa851ef1d226bc80104e4c79ccc4ceef21a2fc9e78d2c63c0e558c5d610390106) |
| 2 | NL-S-0002 | yodmuang.rfclegends.eth | [0x45fd07e4…0e53762f](https://sepolia.etherscan.io/tx/0x45fd07e40e284e368a880a7f8e73e2ca2f2033b54ac24b696c98a0480e53762f) |
| 3 | NL-S-0003 | sirithong.rfclegends.eth | [0x4e5ca336…2e5602de](https://sepolia.etherscan.io/tx/0x4e5ca336bdb612fbf772e670c877ec3b24c1ff7081c3de34637cb5bf2e5602de) |
| 4 | NL-S-0004 | theprawang.rfclegends.eth | [0x9627e4bd…ae9ce88c](https://sepolia.etherscan.io/tx/0x9627e4bdeb0104dc2fc5af92f5f73e1b5eaf9c5101940d4e018c280aae9ce88c) |
| 5 | NL-S-0005 | falconthong.rfclegends.eth | [0xe9dfa4b6…e3454388](https://sepolia.etherscan.io/tx/0xe9dfa4b6d0b7c12666abb028fb015ee55a7826cafc87cc54154e5950e3454388) |
| 6 | NL-C-0101 | chick01.theprawang.rfclegends.eth (sire = token 4) | [0x1957cd91…601f9aeea](https://sepolia.etherscan.io/tx/0x1957cd91e64adc39cc245a1d46424ca61fb403767986e19915d3742601f9aeea) |

Attestation round-trip (E3) on theprawang (token 4):
- `submitAttestation`, farm EIP-712 signature, nonce 2:
  [0xd4c79038486075afa7d04176945303e75432733a274d26bd70d61dc600a61ac4](https://sepolia.etherscan.io/tx/0xd4c79038486075afa7d04176945303e75432733a274d26bd70d61dc600a61ac4)
- farm-key ENS writes on the hardened resolver (weight/health/attestedAt):
  [0xdcd08538…9bc3f87](https://sepolia.etherscan.io/tx/0xdcd08538e7b02d26e383859a95c2ca0c471a3ab80650c0be18f61941c9bc3f87),
  [0x732e9cfa…a5de3c357](https://sepolia.etherscan.io/tx/0x732e9cfa3501e22f3a976eab4bda3b33a62096f91e94606f4909b7ba5de3c357),
  [0x817204cd…819c1acd4](https://sepolia.etherscan.io/tx/0x817204cde17e2cefb6696f4f1958518dab9edd3553b9ea69a1f11eb819c1acd4)
- contract + ENS agree: 4350 g / health 98 / nonce 2. Forged-signature and
  third-party-write paths both revert (verified in the same run).
- chick01 (token 6) attested too (850 g / 99, nonce 1):
  [0x04c2ca71…b84b2f9](https://sepolia.etherscan.io/tx/0x04c2ca71d640ed8635714439922d5e669b0db42c008348e6cd6ffd22db84b2f9)

Live read (what the UI renders):
`https://rfclegends.rfcclub.app/api/ens/records?name=theprawang.rfclegends.eth`

## Scripts

```bash
cd ens && npm install
npx tsx scripts/setup-parent.ts     # register parent + proxies (idempotent)
npx tsx scripts/grant-farm.ts --verify
npx tsx scripts/seed.ts --with-nft  # needs ROOSTER_RWA_OWNER_PK; ENS-only without
npx tsx scripts/harden-resolver.ts --verify
npx tsx scripts/attest.ts <name.eth> [grams] [health] [note]
npx tsx scripts/read.ts <name.eth> [key]
```

Secrets live in `ens/.env` (gitignored; see `.env.example`). Sample bird
data (`data/roosters.json`) uses placeholder ring IDs until Ninlanee Farm's
real records arrive — the UI labels them "(sample)".
