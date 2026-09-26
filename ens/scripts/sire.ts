/**
 * E1 — register a sire-line subname <sire>.<parent>.eth and give it its own
 * child UserRegistry so offspring can live under it.
 * Usage: npx tsx scripts/sire.ts thepbut
 */
import { PARENT_NAME } from '../src/config';
import { registryAbi } from '../src/abis';
import { publicClient } from '../src/client';
import { loadState, saveState, labelhash, deployUserRegistry, ensureRegistered, parentExpiry, SUBNAME_OWNER_ROLES } from '../src/ensv2';

async function main() {
  const sire = process.argv[2];
  if (!sire || !/^[a-z0-9-]+$/.test(sire)) throw new Error('usage: sire.ts <label>');
  const state = loadState();
  if (!state.userRegistry) throw new Error('run setup-parent first');

  const sireName = `${sire}.${PARENT_NAME}`;
  await ensureRegistered(state.userRegistry, sire, { roles: SUBNAME_OWNER_ROLES, expiry: (await parentExpiry()) - 86400n });

  if (!state.sires?.[sire]) {
    const child = await deployUserRegistry(sireName);
    await (await import('../src/client')).send(`setSubregistry ${sire} -> child registry`, (await import('../src/client')).ownerWallet, {
      address: state.userRegistry, abi: registryAbi, functionName: 'setSubregistry',
      args: [labelhash(sire), child],
    });
    state.sires = state.sires ?? {};
    state.sires[sire] = child;
    saveState(state);
  }
  console.log(`sire ${sireName}: child registry ${state.sires[sire]}`);

  // verify resolution chain
  const sub = await publicClient.readContract({
    address: state.userRegistry, abi: registryAbi, functionName: 'getSubregistry', args: [sire],
  });
  console.log(`  getSubregistry('${sire}') = ${sub}`);
  if (sub.toLowerCase() !== state.sires[sire].toLowerCase()) throw new Error('subregistry pointer mismatch');
}

main().catch((e) => { console.error('sire FAIL:', e); process.exit(1); });
