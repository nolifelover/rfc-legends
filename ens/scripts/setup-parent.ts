/**
 * E1 — canonical parent setup on ENSv2 Sepolia.
 * Parent label always comes from ENS_PARENT_LABEL (never hard-coded;
 * the web app mirrors it as NEXT_PUBLIC_ENS_PARENT_NAME).
 *
 * Steps (idempotent): mint/approve MockUSDC → deploy dedicated
 * PermissionedResolver + UserRegistry proxies → commit-reveal register
 * <label>.eth → write parent-level records.
 *
 * Usage: npx tsx scripts/setup-parent.ts
 */
import { keccak256, namehash, stringToHex, parseEventLogs } from 'viem';
import { ENSV2, PARENT_LABEL, PARENT_NAME, YEAR } from '../src/config';
import { registrarAbi, registryAbi, erc20Abi, resolverAbi } from '../src/abis';
import { publicClient, ownerWallet, ownerAccount, send } from '../src/client';
import { loadState, saveState, labelhash, parentExpiry } from '../src/ensv2';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ZERO32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

async function main() {
  const state = loadState();
  console.log(`setup-parent: ${PARENT_NAME} (owner ${ownerAccount.address})`);

  // ---------- registration state first (getRegisterPrice reverts when taken) ----------
  const ps = await publicClient.readContract({
    address: ENSV2.ethRegistry, abi: registryAbi, functionName: 'getState', args: [labelhash(PARENT_LABEL)],
  });
  const alreadyRegistered = Number(ps.status) === 2; // REGISTERED
  let base = 0n;
  if (!alreadyRegistered) {
    [base] = await publicClient.readContract({
      address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'getRegisterPrice',
      args: [PARENT_LABEL, YEAR, ENSV2.mockUsdc],
    });
    const usdcBal = await publicClient.readContract({
      address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'balanceOf', args: [ownerAccount.address],
    });
    if (usdcBal < base) {
      await send('mint MockUSDC', ownerWallet, {
        address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'mint', args: [ownerAccount.address, 100_000_000n],
      });
    }
    const allowance = await publicClient.readContract({
      address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'allowance', args: [ownerAccount.address, ENSV2.ethRegistrar],
    });
    if (allowance < base) {
      await send('approve registrar', ownerWallet, {
        address: ENSV2.mockUsdc, abi: erc20Abi, functionName: 'approve', args: [ENSV2.ethRegistrar, base + 1_000_000n],
      });
    }
  } else console.log('  parent already registered');

  // ---------- resolver proxy ----------
  if (!state.resolver) {
    state.resolver = await (await import('../src/ensv2')).deployResolver(PARENT_NAME);
    saveState(state);
  }
  console.log(`  resolver: ${state.resolver}`);

  // ---------- user registry proxy (holds the sire labels) ----------
  if (!state.userRegistry) {
    state.userRegistry = await (await import('../src/ensv2')).deployUserRegistry(PARENT_NAME);
    saveState(state);
  }
  console.log(`  userRegistry: ${state.userRegistry}`);

  // ---------- commit-reveal register ----------
  if (!alreadyRegistered) {
    if (!state.secret) { state.secret = keccak256(stringToHex(String(Date.now()))) as `0x${string}`; saveState(state); }
    const commitment = await publicClient.readContract({
      address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'makeCommitment',
      args: [PARENT_LABEL, ownerAccount.address, state.secret, state.userRegistry, state.resolver, YEAR, ZERO32],
    });
    const committedAt = await publicClient.readContract({
      address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'commitmentAt', args: [commitment],
    });
    if (committedAt === 0n) {
      await send('commit', ownerWallet, {
        address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'commit', args: [commitment],
      });
    }
    const block = await publicClient.getBlock();
    const committed = committedAt !== 0n ? committedAt : block.timestamp;
    const waitSec = Number(65n - (block.timestamp - committed));
    if (waitSec > 0) { console.log(`  waiting ${waitSec}s…`); await sleep(waitSec * 1000); }
    const { receipt } = await send('register parent', ownerWallet, {
      address: ENSV2.ethRegistrar, abi: registrarAbi, functionName: 'register',
      args: [PARENT_LABEL, ownerAccount.address, state.secret, state.userRegistry, state.resolver, YEAR, ENSV2.mockUsdc, ZERO32],
    });
    const [log] = parseEventLogs({ abi: registrarAbi, eventName: 'NameRegistered', logs: receipt.logs });
    console.log(`  parent tokenId: ${log?.args?.tokenId}`);
    state.registered = state.registered ?? {};
    state.registered[`${PARENT_LABEL}@eth`] = true;
    saveState(state);
  }

  // ---------- parent-level records ----------
  const node = namehash(PARENT_NAME);
  const url = process.env.APP_URL ?? 'https://rfc-legends-demo.example';
  for (const [key, value] of [['url', url], ['description', 'RFC Legends — Thai native gamefowl, transparent onchain pedigree (demo namespace)']] as const) {
    await send(`setText ${key}`, ownerWallet, {
      address: state.resolver!, abi: resolverAbi, functionName: 'setText', args: [node, key, value],
    });
  }

  const expiry = await parentExpiry();
  console.log(`\nsetup-parent done. parent=${PARENT_NAME} resolver=${state.resolver} registry=${state.userRegistry} expiry=${expiry}`);
}

main().catch((e) => { console.error('setup-parent FAIL:', e); process.exit(1); });
