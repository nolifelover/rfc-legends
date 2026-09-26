/**
 * ENSv2 operation helpers shared by the scripts.
 * Names are never hard-coded: the parent label comes from env
 * (ENS_PARENT_LABEL, mirroring the web app's NEXT_PUBLIC_ENS_PARENT_NAME).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  concat, encodeAbiParameters, encodeFunctionData, getCreate2Address, keccak256, namehash, parseAbi, parseEventLogs, stringToHex, toHex, type Hex,
} from 'viem';
import { ENSV2, PARENT_LABEL, PARENT_NAME, REG_ROLES, RES_ROLES, admin } from './config';
import { registryAbi, factoryAbi } from './abis';
import { publicClient, ownerWallet, ownerAccount, send } from './client';

export { PARENT_LABEL, PARENT_NAME };

export const labelhash = (label: string): bigint => BigInt(keccak256(toHex(label)));

export type State = {
  parentName?: string;
  secret?: Hex;          // commit-reveal secret for the parent registration
  userRegistry?: Hex;      // registry holding the 5 sire labels
  resolver?: Hex;          // dedicated PermissionedResolver serving the whole namespace
  farmSignerAddress?: Hex; // address granted rfc.weight/health/attestedAt writes
  sires?: Record<string, Hex>;          // sire label -> its child UserRegistry
  registered?: Record<string, boolean>; // "label@registry" -> done
};

const STATE_FILE = new URL(process.env.ENS_STATE_FILE ?? '../data/deployed.json', import.meta.url);
export function loadState(): State {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
}
export function saveState(s: State) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

/** Per-name salt scheme from the ENSv2 docs: keccak256(kind, namehash, version). */
export function proxySalt(kind: 'UserRegistry' | 'PermissionedResolver', name: string): bigint {
  return BigInt(keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }],
    [keccak256(stringToHex(kind)), namehash(name), 0n],
  )));
}

const initAbis = {
  UserRegistry: parseAbi(['function initialize(address rootAccount, uint256 roleBitmap)']),
  PermissionedResolver: parseAbi(['function initialize(address admin, uint256 roleBitmap, bytes[] setters)']),
} as const;

/** Deploy a UserRegistry proxy through the VerifiableFactory; returns its address. */
export async function deployUserRegistry(name: string): Promise<Hex> {
  const initData = encodeFunctionData({
    abi: initAbis.UserRegistry, functionName: 'initialize',
    args: [ownerAccount.address,
      REG_ROLES.ROLE_REGISTRAR | admin(REG_ROLES.ROLE_REGISTRAR) | REG_ROLES.ROLE_RENEW | admin(REG_ROLES.ROLE_RENEW)],
  });
  return deployOrAdopt(`UserRegistry for ${name}`, proxySalt('UserRegistry', name), initData);
}

/**
 * Compute the deterministic proxy address client-side (the deployed beta
 * factory predates `predictProxyAddress`): EIP-1167 clone creation code with
 * the factory's shared proxyLogic and the outerSalt appended.
 */
export async function predictProxy(kindSalt: bigint): Promise<Hex> {
  const logic = await publicClient.readContract({
    address: ENSV2.verifiableFactory,
    abi: parseAbi(['function proxyLogic() view returns (address)']),
    functionName: 'proxyLogic',
  }) as Hex;
  const outerSalt = keccak256(encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }], [ownerAccount.address, kindSalt],
  ));
  const initCode = concat([
    '0x3d604d80600a3d3981f3363d3d373d3d3d363d73',
    logic,
    '0x5af43d82803e903d91602b57fd5bf3',
    outerSalt,
  ]);
  return getCreate2Address({ from: ENSV2.verifiableFactory, salt: outerSalt, bytecodeHash: keccak256(initCode) });
}

/**
 * Deploy via the VerifiableFactory, or adopt the existing proxy when this
 * deployer+salt combination already produced one (deterministic CREATE2 —
 * e.g. after a fork test or a re-run).
 */
async function deployOrAdopt(label: string, salt: bigint, initData: `0x${string}`): Promise<Hex> {
  const predicted = await predictProxy(salt);
  const existing = await publicClient.getCode({ address: predicted });
  if (existing) {
    console.log(`  ${label}: adopting existing proxy ${predicted}`);
    return predicted;
  }
  const { receipt } = await send(`deploy ${label}`, ownerWallet, {
    address: ENSV2.verifiableFactory, abi: factoryAbi, functionName: 'deployProxy',
    args: [ENSV2.userRegistryImpl, salt, initData],
  });
  const [log] = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs });
  return log.args.proxyAddress as Hex;
}

/** Deploy the namespace's PermissionedResolver proxy (or adopt an existing one). */
export async function deployResolver(name: string): Promise<Hex> {
  const resolverRoot = RES_ROLES.ROLE_SET_TEXT | admin(RES_ROLES.ROLE_SET_TEXT)
    | RES_ROLES.ROLE_SET_ADDR | admin(RES_ROLES.ROLE_SET_ADDR);
  const initData = encodeFunctionData({
    abi: initAbis.PermissionedResolver, functionName: 'initialize',
    args: [ownerAccount.address, resolverRoot, []],
  });
  const salt = proxySalt('PermissionedResolver', name);
  const predicted = await predictProxy(salt);
  const existing = await publicClient.getCode({ address: predicted });
  if (existing) {
    console.log(`  PermissionedResolver for ${name}: adopting existing proxy ${predicted}`);
    return predicted;
  }
  const { receipt } = await send(`deploy PermissionedResolver for ${name}`, ownerWallet, {
    address: ENSV2.verifiableFactory, abi: factoryAbi, functionName: 'deployProxy',
    args: [ENSV2.permissionedResolverImpl, salt, initData],
  });
  const [log] = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs });
  return log.args.proxyAddress as Hex;
}

/** Roles a rooster-name owner keeps: manage its own subregistry/resolver. */
export const SUBNAME_OWNER_ROLES = REG_ROLES.ROLE_SET_SUBREGISTRY | admin(REG_ROLES.ROLE_SET_SUBREGISTRY)
  | REG_ROLES.ROLE_SET_RESOLVER | admin(REG_ROLES.ROLE_SET_RESOLVER);

/** Register `label` inside `registry` (idempotent). */
export async function ensureRegistered(
  registry: Hex, label: string,
  opts: { expiry?: bigint; roles?: bigint; resolver?: Hex; subregistry?: Hex } = {},
) {
  const st = await publicClient.readContract({
    address: registry, abi: registryAbi, functionName: 'getState', args: [labelhash(label)],
  });
  if (Number(st.status) === 2) return; // REGISTERED
  await send(`register "${label}"`, ownerWallet, {
    address: registry, abi: registryAbi, functionName: 'register',
    args: [label, ownerAccount.address, opts.subregistry ?? '0x0000000000000000000000000000000000000000',
      opts.resolver ?? '0x0000000000000000000000000000000000000000',
      opts.roles ?? SUBNAME_OWNER_ROLES, opts.expiry ?? fallbackExpiry()],
  });
}

function fallbackExpiry(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 3600 * 24 * 300);
}

export async function parentExpiry(): Promise<bigint> {
  return publicClient.readContract({
    address: ENSV2.ethRegistry, abi: registryAbi, functionName: 'getExpiry', args: [labelhash(PARENT_LABEL)],
  });
}
