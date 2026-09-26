/**
 * E1 — grant the farm key (Ninlanee) exclusive write access to the health
 * record keys on our dedicated PermissionedResolver:
 *   rfc.weight, rfc.health, rfc.attestedAt
 * The grant is argument-scoped (ROLE_SET_TEXT on exactly these keys across
 * the names this resolver instance serves). Everything else — including the
 * farm key touching other keys, and any third party — reverts.
 *
 * --verify simulates: farm key writes rfc.weight (must succeed),
 * farm key writes rfc.sireLine (must revert), a third party writes
 * rfc.weight (must revert).
 *
 * Usage: npx tsx scripts/grant-farm.ts [--verify]
 */
import { encodeFunctionData, namehash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { FARM_SIGNER_PRIVATE_KEY } from '../src/config';
import { resolverAbi } from '../src/abis';
import { publicClient, ownerWallet, send } from '../src/client';
import { loadState, saveState, PARENT_NAME } from '../src/ensv2';

const FARM_KEYS = ['rfc.weight', 'rfc.health', 'rfc.attestedAt'] as const;
/** DNS-encoded empty name ("any name on this resolver instance"). */
const ANY_NAME = '0x00' as const;

async function expectRevert(label: string, to: `0x${string}`, data: `0x${string}`, account: `0x${string}`) {
  try {
    await publicClient.call({ to, data, account });
    throw new Error(`verify FAILED: ${label} was allowed!`);
  } catch (e) {
    if (String(e).includes('verify FAILED')) throw e;
    console.log(`verify: ${label} reverted as designed ✓`);
  }
}

async function main() {
  const verify = process.argv.includes('--verify');
  const state = loadState();
  if (!state.resolver) throw new Error('run setup-parent first');
  const farm = privateKeyToAccount(FARM_SIGNER_PRIVATE_KEY as `0x${string}`);
  state.farmSignerAddress = farm.address;
  saveState(state);
  const resolver = state.resolver;

  for (const key of FARM_KEYS) {
    await send(`authorizeTextRoles ${key} -> farm key`, ownerWallet, {
      address: resolver, abi: resolverAbi, functionName: 'authorizeTextRoles',
      args: [ANY_NAME, key, farm.address, true],
    });
  }
  console.log(`farm key ${farm.address} granted: ${FARM_KEYS.join(', ')} on resolver ${resolver}`);

  if (verify) {
    const node = namehash(`thepbut.${PARENT_NAME}`);
    const okData = encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: [node, 'rfc.weight', '3500'] });
    const badData = encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: [node, 'rfc.sireLine', 'hacker'] });

    await publicClient.call({ to: resolver, data: okData, account: farm.address });
    console.log('verify: farm key CAN write rfc.weight ✓');
    await expectRevert('farm key writing rfc.sireLine', resolver, badData, farm.address);
    await expectRevert('third party writing rfc.weight', resolver, okData, '0x000000000000000000000000000000000000d00d');
    console.log('verify PASS — permission scoping is live');
  }
}

main().catch((e) => { console.error('grant-farm FAIL:', e); process.exit(1); });
