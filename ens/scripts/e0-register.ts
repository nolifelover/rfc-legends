/**
 * E0 — ENSv2 GO/NO-GO proof on real Sepolia.
 *
 * Registers the parent <label>.eth through the canonical ENSv2 beta
 * registrar (paid in MockUSDC), deploys our own subname registry and
 * permissioned-resolver proxies through the VerifiableFactory, creates one
 * sire-line subname, writes a text record, and reads it back through the
 * entry Universal Resolver (the same path viem/the ENS app use).
 *
 * Idempotent: steps already done are skipped. State lands in ens/data/deployed.json.
 * Usage: npx tsx scripts/e0-register.ts [--dry-run]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  encodeAbiParameters, encodeFunctionData, keccak256, namehash, parseAbi, parseEventLogs, stringToHex, toHex,
} from 'viem';
import { ENSV2, PARENT_LABEL, PARENT_NAME, YEAR, DAY, REG_ROLES, admin, RES_ROLES } from '../src/config';
import { registrarAbi, registryAbi, resolverAbi, factoryAbi, erc20Abi } from '../src/abis';
import { publicClient, ownerWallet, ownerAccount, send } from '../src/client';

const DRY = process.argv.includes('--dry-run');
const STATE_FILE = new URL(process.env.ENS_STATE_FILE ?? '../data/deployed.json', import.meta.url);
type State = {
  parentName?: string; userRegistry?: string; resolver?: string; secret?: string;
  committed?: boolean; registered?: boolean; subname?: string; tokenId?: string;
};
const state: State = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const labelhash = (label: string) => BigInt(keccak256(toHex(label)));

async function main() {
  console.log(`E0: parent=${PARENT_NAME} owner=${ownerAccount.address} dryRun=${DRY}`);

  const balance = await publicClient.getBalance({ address: ownerAccount.address });
  if (balance === 0n && !DRY) throw new Error('Owner address has 0 ETH — fund it first');
  console.log(`  owner balance: ${Number(balance) / 1e18} ETH`);

  // ---------- 1. payment: mint MockUSDC + approve ----------
  const [base] = await publicClient.readContract({
    address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'getRegisterPrice',
    args: [PARENT_LABEL, YEAR, ENSV2.mockUsdc],
  });
  console.log(`  register price: ${(Number(base) / 1e6).toFixed(6)} MockUSDC / year`);

  const usdcBal = await publicClient.readContract({
    address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'balanceOf', args: [ownerAccount.address],
  });
  if (usdcBal < base && !DRY) {
    console.log('  minting 100 MockUSDC…');
    await send('mint MockUSDC', ownerWallet, {
      address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'mint',
      args: [ownerAccount.address, 100_000_000n],
    });
  }
  const allowance = await publicClient.readContract({
    address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'allowance',
    args: [ownerAccount.address, ENSV2.ethRegistrar],
  });
  if (allowance < base && !DRY) {
    console.log('  approving registrar…');
    await send('approve registrar', ownerWallet, {
      address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'approve',
      args: [ENSV2.ethRegistrar, base + 1_000_000n],
    });
  }

  // ---------- 2. deploy resolver proxy (permissioned, dedicated instance) ----------
  // salt scheme from docs: keccak256("PermissionedResolver", namehash(parent), version)
  const resolverSalt = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }],
    [keccak256(stringToHex('PermissionedResolver')), namehash(PARENT_NAME), 0n],
  )));
  // root roles for owner: set text/addr + their admins (root grant is a superset of any scoped grant)
  const resolverRoot = RES_ROLES.ROLE_SET_TEXT | admin(RES_ROLES.ROLE_SET_TEXT)
    | RES_ROLES.ROLE_SET_ADDR | admin(RES_ROLES.ROLE_SET_ADDR);
  const prInit = encodeFunctionData({
    abi: parseAbi(['function initialize(address admin, uint256 roleBitmap, bytes[] setters)']),
    functionName: 'initialize', args: [ownerAccount.address, resolverRoot, []],
  });
  let resolver = state.resolver as `0x${string}` | undefined;
  if (!resolver) {
    console.log('  deploying PermissionedResolver proxy…');
    if (DRY) console.log('    (dry-run) factory.deployProxy:', ENSV2.permissionedResolverImpl, resolverSalt);
    else {
      const { receipt } = await send('deploy resolver proxy', ownerWallet, {
        address: ENSV2.verifiableFactory, abi: factoryAbi, functionName: 'deployProxy',
        args: [ENSV2.permissionedResolverImpl, resolverSalt, prInit],
      });
      const [log] = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs });
      resolver = log.args.proxyAddress as `0x${string}`;
    }
    if (resolver) { state.resolver = resolver; save(); }
  } else console.log(`  resolver proxy exists: ${resolver}`);

  // ---------- 3. deploy UserRegistry proxy (the parent's subname registry) ----------
  const registrySalt = BigInt(keccak256(encodeAbiParameters(
    [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }],
    [keccak256(stringToHex('UserRegistry')), namehash(PARENT_NAME), 0n],
  )));
  const registryRoot = REG_ROLES.ROLE_REGISTRAR | admin(REG_ROLES.ROLE_REGISTRAR)
    | REG_ROLES.ROLE_RENEW | admin(REG_ROLES.ROLE_RENEW);
  const urInit = encodeFunctionData({
    abi: parseAbi(['function initialize(address rootAccount, uint256 roleBitmap)']),
    functionName: 'initialize', args: [ownerAccount.address, registryRoot],
  });
  let userRegistry = state.userRegistry as `0x${string}` | undefined;
  if (!userRegistry) {
    console.log('  deploying UserRegistry proxy…');
    if (DRY) console.log('    (dry-run) factory.deployProxy:', ENSV2.userRegistryImpl, registrySalt);
    else {
      const { receipt } = await send('deploy user registry proxy', ownerWallet, {
        address: ENSV2.verifiableFactory, abi: factoryAbi, functionName: 'deployProxy',
        args: [ENSV2.userRegistryImpl, registrySalt, urInit],
      });
      const [log] = parseEventLogs({ abi: factoryAbi, eventName: 'ProxyDeployed', logs: receipt.logs });
      userRegistry = log.args.proxyAddress as `0x${string}`;
    }
    if (userRegistry) { state.userRegistry = userRegistry; save(); }
  } else console.log(`  user registry proxy exists: ${userRegistry}`);

  if (DRY) { console.log('dry-run: stopping before onchain registration steps'); return; }

  // ---------- 4. commit-reveal register the parent ----------
  const available = await publicClient.readContract({
    address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'isAvailable', args: [PARENT_LABEL],
  });
  const parentState = await publicClient.readContract({
    address: ENSV2.ethRegistry, abi: registryAbi, functionName: 'getState', args: [labelhash(PARENT_LABEL)],
  });
  const alreadyRegistered = Number(parentState.status) === 1;

  if (!alreadyRegistered && available) {
    if (!state.secret) { state.secret = keccak256(stringToHex(String(Date.now()))); save(); }
    const secret = state.secret as `0x${string}`;
    const commitment = await publicClient.readContract({
      address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'makeCommitment',
      args: [PARENT_LABEL, ownerAccount.address, secret as `0x${string}`, userRegistry!, resolver!, YEAR, '0x0000000000000000000000000000000000000000000000000000000000000000'],
    });
    const committedAt = await publicClient.readContract({
      address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'commitmentAt', args: [commitment],
    });
    if (committedAt === 0n) {
      console.log('  committing registration intent…');
      await send('commit', ownerWallet, {
        address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'commit', args: [commitment],
      });
      state.committed = true; save();
    }
    const block = await publicClient.getBlock();
    const committed = committedAt !== 0n ? committedAt : block.timestamp;
    const waitSec = Number(65n - (block.timestamp - committed));
    if (waitSec > 0) { console.log(`  waiting ${waitSec}s for commitment age…`); await sleep(waitSec * 1000); }
    const { receipt: regReceipt } = await send('register parent', ownerWallet, {
      address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'register',
      args: [PARENT_LABEL, ownerAccount.address, secret, userRegistry!, resolver!, YEAR, ENSV2.mockUsdc, '0x0000000000000000000000000000000000000000000000000000000000000000'],
    });
    const [regLog] = parseEventLogs({ abi: registrarAbi, eventName: 'NameRegistered', logs: regReceipt.logs });
    state.registered = true; state.tokenId = String(regLog?.args?.tokenId ?? 0n); save();
  } else if (alreadyRegistered) {
    console.log('  parent already registered — skipping registration');
  } else throw new Error(`label ${PARENT_LABEL} not available`);

  // ---------- 5. create the sire subname in our UserRegistry ----------
  const SIRE = 'thepbut';
  const parentExpiry = await publicClient.readContract({
    address: ENSV2.ethRegistry, abi: registryAbi, functionName: 'getExpiry', args: [labelhash(PARENT_LABEL)],
  });
  const sireState = await publicClient.readContract({
    address: userRegistry!, abi: registryAbi, functionName: 'getState', args: [labelhash(SIRE)],
  });
  if (Number(sireState.status) !== 1) {
    console.log(`  registering subname ${SIRE}.${PARENT_NAME}…`);
    const subRoles = REG_ROLES.ROLE_SET_SUBREGISTRY | admin(REG_ROLES.ROLE_SET_SUBREGISTRY)
      | REG_ROLES.ROLE_SET_RESOLVER | admin(REG_ROLES.ROLE_SET_RESOLVER);
    await send('register sire subname', ownerWallet, {
      address: userRegistry!, abi: registryAbi, functionName: 'register',
      args: [SIRE, ownerAccount.address, '0x0000000000000000000000000000000000000000', '0x0000000000000000000000000000000000000000', subRoles, parentExpiry - DAY],
    });
  } else console.log(`  ${SIRE}.${PARENT_NAME} already registered`);

  // ---------- 6. text record on the subname ----------
  const node = namehash(`${SIRE}.${PARENT_NAME}`);
  await send('setText rfc.sireLine', ownerWallet, {
    address: resolver!, abi: resolverAbi, functionName: 'setText',
    args: [node, 'rfc.sireLine', 'thepbut'],
  });
  await send('setText rfc.contract', ownerWallet, {
    address: resolver!, abi: resolverAbi, functionName: 'setText',
    args: [node, 'rfc.demo', 'rfclegends-e0'],
  });

  // ---------- 7. READ BACK through the entry Universal Resolver (viem path) ----------
  const viaViem = await publicClient.getEnsText({ name: `${SIRE}.${PARENT_NAME}`, key: 'rfc.sireLine' });
  console.log(`\nREADBACK via entry UniversalResolver (viem): ${SIRE}.${PARENT_NAME} rfc.sireLine = "${viaViem}"`);
  if (viaViem !== 'thepbut') throw new Error('readback mismatch!');
  console.log('\nE0 PASS ✅ — ENSv2 hierarchy + permissioned resolver live on Sepolia');
}

main().catch((e) => { console.error('E0 FAIL:', e); process.exit(1); });
