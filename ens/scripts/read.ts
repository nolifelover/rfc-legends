/**
 * Read any name/key through the entry Universal Resolver (the same path the
 * web app and viem use). Falls back to the direct resolver call on failure.
 * Usage: npx tsx scripts/read.ts <name> [key]
 */
import { namehash } from 'viem';
import { resolverAbi } from '../src/abis';
import { publicClient } from '../src/client';
import { loadState, PARENT_NAME } from '../src/ensv2';

async function main() {
  const name = process.argv[2] ?? PARENT_NAME;
  const key = process.argv[3] ?? 'rfc.sireLine';
  const state = loadState();

  const viaUr = await publicClient.getEnsText({ name, key }).catch((e) => `UR-ERROR: ${String(e).slice(0, 80)}`);
  console.log(`[entry UniversalResolver] ${name} ${key} = ${viaUr}`);

  if (state.resolver) {
    const direct = await publicClient.readContract({
      address: state.resolver, abi: resolverAbi, functionName: 'text',
      args: [namehash(name), key],
    }).catch((e) => `DIRECT-ERROR: ${String(e).slice(0, 80)}`);
    console.log(`[resolver direct]        ${name} ${key} = ${direct}`);
  }
}

main();
