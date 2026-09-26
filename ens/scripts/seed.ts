/**
 * E2 — seed rooster names + records from ens/data/roosters.json.
 *
 * Hierarchy (spec §7): foundation birds live at <label>.<parent>; offspring
 * live under their sire: <label>.<sire>.<parent> in the sire's own child
 * registry — a true per-name ENSv2 subregistry chain.
 *
 * --with-nft additionally mints each rooster on RoosterRWA (ERC-721) and
 * calls setEnsName, then writes rfc.contract / rfc.tokenId records. It needs
 * eth-dev1's Sepolia deployment (contracts/deployments/sepolia.json) and the
 * RFC Club owner key in ROOSTER_RWA_OWNER_PK. Without it we run ENS-only and
 * clearly mark records as pending.
 *
 * Usage: npx tsx scripts/seed.ts [--with-nft]
 */
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { keccak256, namehash, parseAbi, toHex, type Hex } from 'viem';
import { PARENT_NAME, FARM_SIGNER_PRIVATE_KEY } from '../src/config';
import { registryAbi, resolverAbi } from '../src/abis';
import { publicClient, ownerWallet, send, walletFor } from '../src/client';
import { loadState, saveState, labelhash, deployUserRegistry, ensureRegistered, parentExpiry, SUBNAME_OWNER_ROLES } from '../src/ensv2';

type Bird = {
  label: string; displayName: string; sireLine: string; ringId: string;
  hatchedAt: number; sireLabel: string | null; damLabel: string | null;
  initialWeightGrams: number; initialHealthScore: number; note: string;
};

const roosterRwaAbi = parseAbi([
  'function mintRooster(address to, (string name, string ringId, uint8 sireLine, uint64 hatchedAt, uint256 sireTokenId, uint256 damTokenId, string ensName) r, uint64 nonce, bytes farmSig) returns (uint256 tokenId)',
  'function setEnsName(uint256 tokenId, string ensName)',
  'function getRooster(uint256 tokenId) view returns ((string name, string ringId, uint8 sireLine, uint64 hatchedAt, uint256 sireTokenId, uint256 damTokenId, string ensName))',
  'function farmSigner() view returns (address)',
  'event RoosterMinted(uint256 indexed tokenId, address indexed to, uint8 sireLine, uint256 sireTokenId, uint256 damTokenId, uint64 hatchedAt, string ringId, string ensName)',
  'function ringToken(bytes32 ringHash) view returns (uint256 tokenId)',
]);

// TODO: import from apps/web/src/lib/contracts/eip712.ts once eth-dev1 exports it.
// Byte-order must match RoosterRwa.REGISTRATION_TYPEHASH exactly:
// keccak256("Registration(string ringId,uint8 sireLine,uint64 hatchedAt,uint256 sireTokenId,uint256 damTokenId,address to,uint64 nonce)")
const REGISTRATION_TYPE = [
  { name: 'ringId', type: 'string' },
  { name: 'sireLine', type: 'uint8' },
  { name: 'hatchedAt', type: 'uint64' },
  { name: 'sireTokenId', type: 'uint256' },
  { name: 'damTokenId', type: 'uint256' },
  { name: 'to', type: 'address' },
  { name: 'nonce', type: 'uint64' },
] as const;

async function main() {
  const withNft = process.argv.includes('--with-nft');
  const data = JSON.parse(readFileSync(new URL('../data/roosters.json', import.meta.url), 'utf8'));
  const birds: Bird[] = data.roosters;
  const sireLineIndex: Record<string, number> = data._meta.sireLineIndex;
  const state = loadState();
  if (!state.userRegistry || !state.resolver) throw new Error('run setup-parent first');
  const expiry = (await parentExpiry()) - 86400n;

  // optional NFT leg
  let rwa: { address: Hex; ownerWallet: typeof ownerWallet } | null = null;
  const sepoliaJson = new URL('../../contracts/deployments/sepolia.json', import.meta.url);
  if (withNft) {
    if (!existsSync(sepoliaJson)) throw new Error('--with-nft needs contracts/deployments/sepolia.json (eth-dev1)');
    const dep = JSON.parse(readFileSync(sepoliaJson, 'utf8'));
    if (!dep.RoosterRWA) throw new Error('sepolia.json has no RoosterRWA yet');
    const ownerPk = process.env.ROOSTER_RWA_OWNER_PK;
    if (!ownerPk) throw new Error('--with-nft needs ROOSTER_RWA_OWNER_PK (RFC Club key)');
    rwa = { address: dep.RoosterRWA as Hex, ownerWallet: walletFor(ownerPk) };
  }

  const tokenIds: Record<string, bigint> = {};

  // ---------- foundation birds ----------
  for (const b of birds.filter((x) => x.sireLabel === null)) {
    await ensureRegistered(state.userRegistry, b.label, { roles: SUBNAME_OWNER_ROLES, expiry });
    // a bird with offspring needs its own child registry
    const hasKids = birds.some((x) => x.sireLabel === b.label);
    if (hasKids && !state.sires?.[b.label]) {
      const child = await deployUserRegistry(`${b.label}.${PARENT_NAME}`);
      await send(`setSubregistry ${b.label}`, ownerWallet, {
        address: state.userRegistry, abi: registryAbi, functionName: 'setSubregistry',
        args: [labelhash(b.label), child],
      });
      state.sires = state.sires ?? {};
      state.sires[b.label] = child;
      saveState(state);
    }
    console.log(`foundation bird ${b.label}.${PARENT_NAME} ready`);
  }

  // ---------- offspring ----------
  for (const b of birds.filter((x) => x.sireLabel !== null)) {
    const reg = state.sires?.[b.sireLabel!];
    if (!reg) throw new Error(`sire ${b.sireLabel} has no child registry`);
    await ensureRegistered(reg, b.label, { roles: SUBNAME_OWNER_ROLES, expiry });
    console.log(`offspring ${b.label}.${b.sireLabel}.${PARENT_NAME} ready`);
  }

  // ---------- NFT mint + setEnsName (parents first, then offspring) ----------
  if (rwa) {
    const { privateKeyToAccount } = await import('viem/accounts');
    const { roosterRwaDomain } = await import('../../apps/web/src/lib/contracts/eip712');
    const farm = privateKeyToAccount(FARM_SIGNER_PRIVATE_KEY as Hex);
    const domain = roosterRwaDomain(11155111, rwa.address);
    let nonce = BigInt(Math.floor(Date.now() / 1000));
    for (const b of [...birds.filter((x) => x.sireLabel === null), ...birds.filter((x) => x.sireLabel !== null)]) {
      const ensName = b.sireLabel ? `${b.label}.${b.sireLabel}.${PARENT_NAME}` : `${b.label}.${PARENT_NAME}`;
      const sireTid = b.sireLabel ? (tokenIds[b.sireLabel] ?? 0n) : 0n;
      const to = ownerWallet.account.address;
      // idempotency: one ring = one token (the contract enforces it; we check first)
      const existing = await publicClient.readContract({
        address: rwa.address, abi: roosterRwaAbi, functionName: 'ringToken',
        args: [keccak256(toHex(b.ringId))],
      }).catch(() => 0n);
      if (existing !== 0n) {
        tokenIds[b.label] = existing;
        console.log(`mintRooster ${b.label}: already token ${existing}, skipping`);
        continue;
      }
      // custodian co-signature: RFC Club issues, Ninlanee Farm attests the bird is real
      const farmSig = await farm.signTypedData({
        domain,
        types: { Registration: REGISTRATION_TYPE },
        primaryType: 'Registration',
        message: { ringId: b.ringId, sireLine: sireLineIndex[b.sireLine], hatchedAt: BigInt(b.hatchedAt), sireTokenId: sireTid, damTokenId: 0n, to, nonce },
      });
      const { receipt } = await send(`mintRooster ${b.label}`, rwa.ownerWallet, {
        address: rwa.address, abi: roosterRwaAbi, functionName: 'mintRooster',
        args: [to, [b.displayName, b.ringId, BigInt(sireLineIndex[b.sireLine]), BigInt(b.hatchedAt), sireTid, 0n, ensName], nonce, farmSig],
      });
      const { parseEventLogs } = await import('viem');
      const [log] = parseEventLogs({ abi: roosterRwaAbi, eventName: 'RoosterMinted', logs: receipt.logs });
      tokenIds[b.label] = log.args.tokenId;
      await send(`setEnsName ${b.label} -> ${ensName}`, rwa.ownerWallet, {
        address: rwa.address, abi: roosterRwaAbi, functionName: 'setEnsName', args: [log.args.tokenId, ensName],
      });
      nonce += 1n;
    }
  }

  // ---------- text records ----------
  const appUrl = process.env.APP_URL ?? '';
  for (const b of birds) {
    const name = b.sireLabel ? `${b.label}.${b.sireLabel}.${PARENT_NAME}` : `${b.label}.${PARENT_NAME}`;
    const records: Array<[string, string]> = [
      ['rfc.sireLine', b.sireLine],
      ['rfc.ringId', b.ringId],
      ['rfc.displayName', b.displayName],
      ['rfc.hatchedAt', String(b.hatchedAt)],
    ];
    if (rwa && tokenIds[b.label] !== undefined) {
      records.push(['rfc.contract', rwa.address], ['rfc.tokenId', String(tokenIds[b.label])]);
    } else {
      records.push(['rfc.contract', 'pending-deployment'], ['rfc.tokenId', 'pending']);
    }
    if (appUrl) records.push(['url', `${appUrl}/roosters/${b.label}`]);
    if (b.note) records.push(['rfc.note', b.note]);
    for (const [key, value] of records) {
      await send(`setText ${name} ${key}`, ownerWallet, {
        address: state.resolver!, abi: resolverAbi, functionName: 'setText', args: [namehash(name), key, value],
      });
    }
    console.log(`records set: ${name}`);
  }

  // ---------- verify resolution ----------
  const checkName = `chick01.theprawang.${PARENT_NAME}`;
  const v = await publicClient.getEnsText({ name: checkName, key: 'rfc.sireLine' });
  console.log(`\nverify: ${checkName} rfc.sireLine = "${v}"`);
  if (v !== 'thepbut') throw new Error('readback mismatch');
  console.log('seed done ✓');
}

main().catch((e) => { console.error('seed FAIL:', e); process.exit(1); });
