/**
 * E1 — write text records for a name through the permissioned resolver.
 * Usage: npx tsx scripts/set-records.ts <name> key1=value1 key2=value2 ...
 */
import { namehash } from 'viem';
import { resolverAbi } from '../src/abis';
import { ownerWallet, send } from '../src/client';
import { loadState } from '../src/ensv2';

async function main() {
  const [name, ...pairs] = process.argv.slice(2);
  if (!name || pairs.length === 0) throw new Error('usage: set-records.ts <name> k=v ...');
  const state = loadState();
  const resolverAddr = (state.resolverV2 ?? state.resolver)!;
  if (!state.resolver && !state.resolverV2) throw new Error('run setup-parent first');
  const node = namehash(name);
  for (const pair of pairs) {
    const eq = pair.indexOf('=');
    const key = pair.slice(0, eq), value = pair.slice(eq + 1);
    await send(`setText ${name} ${key}`, ownerWallet, {
      address: resolverAddr, abi: resolverAbi, functionName: 'setText', args: [node, key, value],
    });
  }
}

main().catch((e) => { console.error('set-records FAIL:', e); process.exit(1); });
