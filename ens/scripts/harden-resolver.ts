/**
 * Harden the resolver so "only the farm writes health" is literally true.
 *
 * The first resolver instance gave the namespace owner root ROLE_SET_TEXT —
 * convenient, but it meant the owner could also write rfc.weight. This
 * deploys a fresh dedicated PermissionedResolver where:
 *   - the owner holds ONLY the admin bits (grant/revoke, no direct writes)
 *   - the owner gets per-NAME grants (all keys on that one name) for the
 *     records it legitimately maintains (identity, lineage, links)
 *   - the farm key gets per-NAME + per-KEY grants: exactly rfc.weight,
 *     rfc.health, rfc.attestedAt on each rooster name
 *   - each rooster name's addr record points at the RoosterRWA token holder
 *     (the name follows the asset)
 * then repoints the parent (children inherit by wildcard resolution) and
 * rewrites all records on the new instance.
 *
 * --verify proves: owner CAN write rfc.sireLine, owner CANNOT write
 * rfc.weight, farm CAN write rfc.weight, farm CANNOT write rfc.sireLine,
 * third party CANNOT write anything.
 *
 * Usage: npx tsx scripts/harden-resolver.ts [--verify]
 */
import { readFileSync } from 'node:fs';
import { keccak256, namehash, toHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { packetToBytes } from 'viem/ens';
import { encodeFunctionData, encodeAbiParameters, stringToHex, parseAbi, parseEventLogs } from 'viem';
import { ENSV2, FARM_SIGNER_PRIVATE_KEY, RES_ROLES, admin } from '../src/config';
import { registryAbi, resolverAbi, factoryAbi } from '../src/abis';
import { publicClient, ownerWallet, ownerAccount, send } from '../src/client';
import { loadState, saveState, labelhash, PARENT_NAME, PARENT_LABEL } from '../src/ensv2';

const roosterRwaAbi = parseAbi([
  'function ringToken(bytes32 ringHash) view returns (uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
]);

const FARM_KEYS = ['rfc.weight', 'rfc.health', 'rfc.attestedAt'] as const;
const DEV_URL = process.env.APP_URL ?? 'https://rfc-legends.earn.dev.rawinlab.com';

export const dnsName = (name: string): Hex => toHex(packetToBytes(name));

async function main() {
  const verify = process.argv.includes('--verify');
  const state = loadState();
  if (!state.userRegistry) throw new Error('run setup-parent first');
  const data = JSON.parse(readFileSync(new URL('../data/roosters.json', import.meta.url), 'utf8'));
  const birds: Array<{ label: string; displayName: string; sireLine: string; ringId: string; hatchedAt: number; sireLabel: string | null; note: string }> = data.roosters;
  const farmAddress = privateKeyToAccount(FARM_SIGNER_PRIVATE_KEY as Hex).address as Hex;
  const rwa = '0x99Cc8889b2a794071e3BC7b7aA4D3007501AB3d7' as Hex;

  // ---------- 1. fresh resolver: owner holds ADMIN bits only ----------
  const VERSION = 1n; // new salt -> new instance, old one stays as history
  const salt = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }],
    [keccak256(stringToHex('PermissionedResolver')), namehash(PARENT_NAME), VERSION],
  )));
  const adminOnly = admin(RES_ROLES.ROLE_SET_TEXT) | admin(RES_ROLES.ROLE_SET_ADDR);
  const initData = encodeFunctionData({
    abi: parseAbi(['function initialize(address admin, uint256 roleBitmap, bytes[] setters)']),
    functionName: 'initialize', args: [ownerAccount.address, adminOnly, []],
  });
  let resolver = state.resolverV2 as Hex | undefined;
  if (!resolver) {
    const { receipt } = await send('deploy hardened PermissionedResolver', ownerWallet, {
      address: ENSV2.verifiableFactory, abi: factoryAbi, functionName: 'deployProxy',
      args: [ENSV2.permissionedResolverImpl, salt, initData],
    });
    const [log] = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs });
    resolver = log.args.proxyAddress as Hex;
    state.resolverV2 = resolver;
    saveState(state);
  }
  console.log(`hardened resolver: ${resolver}`);

  // ---------- 2. repoint the parent (children inherit via wildcard) ----------
  await send(`setResolver ${PARENT_NAME} -> hardened`, ownerWallet, {
    address: ENSV2.ethRegistry, abi: registryAbi, functionName: 'setResolver',
    args: [labelhash(PARENT_LABEL), resolver],
  });

  // ---------- 3. per-NAME owner grants + per-KEY farm grants ----------
  const names: Array<string> = [PARENT_NAME];
  for (const b of birds) names.push(b.sireLabel ? `${b.label}.${b.sireLabel}.${PARENT_NAME}` : `${b.label}.${PARENT_NAME}`);

  const resource = (node: `0x${string}`, part: `0x${string}`) =>
    BigInt(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'bytes32' }], [node, part])));
  const ZERO32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
  const hasIt = async (res: bigint, bitmap: bigint, who: `0x${string}`) =>
    await publicClient.readContract({
      address: resolver, abi: resolverAbi, functionName: 'hasRoles', args: [res, bitmap, who],
    });

  // Owner rights: per-NAME setAddr (the name follows the token holder) but
  // per-KEY text writes ONLY on non-health keys — a per-name all-keys text
  // grant would include rfc.weight and break the farm's exclusivity.
  const OWNER_TEXT_KEYS = ['rfc.sireLine', 'rfc.ringId', 'rfc.displayName', 'rfc.hatchedAt',
    'rfc.contract', 'rfc.tokenId', 'url', 'rfc.note', 'description', 'avatar'] as const;
  for (const name of names) {
    const nodeRes = resource(namehash(name), ZERO32);
    const ownerHasAllKeys = await hasIt(nodeRes, RES_ROLES.ROLE_SET_TEXT, ownerAccount.address);
    if (ownerHasAllKeys) {
      // revoke the per-name all-keys grant from the first harden run
      await send(`revoke per-name all-keys @ ${name}`, ownerWallet, {
        address: resolver, abi: resolverAbi, functionName: 'authorizeNameRoles',
        args: [dnsName(name), RES_ROLES.ROLE_SET_TEXT | RES_ROLES.ROLE_SET_ADDR, ownerAccount.address, false],
      });
    }
    if (!await hasIt(nodeRes, RES_ROLES.ROLE_SET_ADDR, ownerAccount.address)) {
      await send(`authorizeNameRoles owner setAddr @ ${name}`, ownerWallet, {
        address: resolver, abi: resolverAbi, functionName: 'authorizeNameRoles',
        args: [dnsName(name), RES_ROLES.ROLE_SET_ADDR, ownerAccount.address, true],
      });
    }
    const keys = name === PARENT_NAME ? (['url', 'description'] as const) : OWNER_TEXT_KEYS;
    for (const key of keys) {
      const res = resource(namehash(name), keccak256(toHex(key)));
      if (await hasIt(res, RES_ROLES.ROLE_SET_TEXT, ownerAccount.address)) continue;
      await send(`authorizeTextRoles owner ${key} @ ${name}`, ownerWallet, {
        address: resolver, abi: resolverAbi, functionName: 'authorizeTextRoles',
        args: [dnsName(name), key, ownerAccount.address, true],
      });
    }
  }
  for (const name of names.slice(1)) { // rooster names only
    for (const key of FARM_KEYS) {
      const res = resource(namehash(name), keccak256(toHex(key)));
      if (await hasIt(res, RES_ROLES.ROLE_SET_TEXT, farmAddress)) continue;
      await send(`authorizeTextRoles farm ${key} @ ${name}`, ownerWallet, {
        address: resolver, abi: resolverAbi, functionName: 'authorizeTextRoles',
        args: [dnsName(name), key, farmAddress, true],
      });
    }
  }

  // ---------- 4. rewrite records on the new instance ----------
  for (const [key, value] of [['url', DEV_URL], ['description', 'RFC Legends — Thai native gamefowl, transparent onchain pedigree (demo namespace)']] as const) {
    await send(`setText ${PARENT_NAME} ${key}`, ownerWallet, {
      address: resolver, abi: resolverAbi, functionName: 'setText', args: [namehash(PARENT_NAME), key, value],
    });
  }
  for (const b of birds) {
    const name = b.sireLabel ? `${b.label}.${b.sireLabel}.${PARENT_NAME}` : `${b.label}.${PARENT_NAME}`;
    const tokenId = await publicClient.readContract({
      address: rwa, abi: roosterRwaAbi, functionName: 'ringToken', args: [keccak256(toHex(b.ringId))],
    });
    const holder = await publicClient.readContract({
      address: rwa, abi: roosterRwaAbi, functionName: 'ownerOf', args: [tokenId],
    });
    const node = namehash(name);
    const records: Array<[string, string]> = [
      ['rfc.sireLine', b.sireLine], ['rfc.ringId', b.ringId], ['rfc.displayName', b.displayName],
      ['rfc.hatchedAt', String(b.hatchedAt)], ['rfc.contract', rwa], ['rfc.tokenId', String(tokenId)],
      ['url', `${DEV_URL}/roosters/${tokenId}`], ['rfc.note', b.note],
    ];
    for (const [key, value] of records) {
      const current = await publicClient.readContract({
        address: resolver, abi: resolverAbi, functionName: 'text', args: [node, key],
      }).catch(() => null);
      if (current === value) continue;
      await send(`setText ${name} ${key}`, ownerWallet, {
        address: resolver, abi: resolverAbi, functionName: 'setText', args: [node, key, value],
      });
    }
    // the name follows the asset: addr -> current token holder (ERC-721)
    await send(`setAddr ${name} -> holder`, ownerWallet, {
      address: resolver, abi: resolverAbi, functionName: 'setAddr', args: [node, holder],
    });
  }

  // ---------- 5. verify ----------
  if (verify) {
    const demo = names[4]; // a rooster name
    const node = namehash(demo);
    const enc = (key: string, val: string) => encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: [node, key, val] });
    const tryCall = async (label: string, data: Hex, account: Hex, expect: 'ok' | 'revert') => {
      try {
        await publicClient.call({ to: resolver, data, account });
        if (expect === 'revert') throw new Error(`verify FAILED: ${label} was allowed!`);
        console.log(`verify: ${label} ✓`);
      } catch (e) {
        if (expect === 'revert' && !String(e).includes('verify FAILED')) { console.log(`verify: ${label} reverted as designed ✓`); return; }
        throw e;
      }
    };
    await tryCall('owner writes rfc.sireLine', enc('rfc.sireLine', 'thepbut'), ownerAccount.address, 'ok');
    await tryCall('owner writes rfc.weight', enc('rfc.weight', '9999'), ownerAccount.address, 'revert');
    await tryCall('farm writes rfc.weight', enc('rfc.weight', '4200'), farmAddress, 'ok');
    await tryCall('farm writes rfc.sireLine', enc('rfc.sireLine', 'x'), farmAddress, 'revert');
    await tryCall('third party writes rfc.weight', enc('rfc.weight', '1'), '0x000000000000000000000000000000000000d00d', 'revert');
    const viaUr = await publicClient.getEnsText({ name: demo, key: 'rfc.tokenId' });
    console.log(`verify: getEnsText(${demo}).rfc.tokenId = ${viaUr}`);
  }
  console.log('harden done ✓');
}

main().catch((e) => { console.error('harden FAIL:', e); process.exit(1); });
