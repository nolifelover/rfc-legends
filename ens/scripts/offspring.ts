/**
 * E1 — register an offspring subname <label>.<sire>.<parent>.eth.
 * The offspring lives in the sire's child UserRegistry and resolves through
 * wildcard resolution (no resolver of its own; nearest ancestor serves it).
 * Usage: npx tsx scripts/offspring.ts chick01 thepbut
 */
import { PARENT_NAME } from '../src/config';
import { loadState, ensureRegistered, parentExpiry, SUBNAME_OWNER_ROLES } from '../src/ensv2';

async function main() {
  const [label, sire] = process.argv.slice(2);
  if (!label || !sire || !/^[a-z0-9-]+$/.test(label)) throw new Error('usage: offspring.ts <label> <sire>');
  const state = loadState();
  const sireRegistry = state.sires?.[sire];
  if (!sireRegistry) throw new Error(`sire "${sire}" not set up — run sire.ts ${sire} first`);

  await ensureRegistered(sireRegistry, label, { roles: SUBNAME_OWNER_ROLES, expiry: (await parentExpiry()) - 86400n });
  console.log(`offspring ${label}.${sire}.${PARENT_NAME} registered in ${sireRegistry}`);
}

main().catch((e) => { console.error('offspring FAIL:', e); process.exit(1); });
