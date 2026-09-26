/**
 * E3 — farm attestation round-trip for one rooster.
 *
 * Full mode (needs RoosterRWA on Sepolia):
 * 1. Sign the EIP-712 Attestation with the Ninlanee farm key (types imported
 *    from eth-dev1's apps/web/src/lib/contracts/eip712.ts).
 * 2. Relay it to RoosterRWA.submitAttestation (anyone may relay).
 * 3. Write the same values to the rooster's ENS text records
 *    (rfc.weight / rfc.health / rfc.attestedAt) — keys only the farm key may
 *    write on our permissioned resolver.
 * 4. Negative path: a forged signature is rejected by the contract
 *    (InvalidSigner) and a third-party ENS write reverts
 *    (EACUnauthorizedAccountRoles).
 *
 * --ens-only runs steps 3–4 without the contract (before RoosterRWA deploys).
 *
 * Usage: npx tsx scripts/attest.ts <label> [sireLabel] [weightGrams] [healthScore] [note] [--ens-only]
 */
import { encodeFunctionData, namehash, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ENS_OWNER_PRIVATE_KEY, FARM_SIGNER_PRIVATE_KEY } from '../src/config';
import { resolverAbi } from '../src/abis';
import { publicClient, send, walletFor, ownerAccount } from '../src/client';
import { loadState, PARENT_NAME } from '../src/ensv2';
import { ATTESTATION_TYPE, roosterRwaDomain, type Attestation } from '../../apps/web/src/lib/contracts/eip712';

const roosterRwaAbi = parseAbi([
  'function submitAttestation((uint256 tokenId, uint32 weightGrams, uint8 healthScore, string note, uint64 checkedAt, uint64 nonce) a, bytes signature)',
  'function latestAttestation(uint256 tokenId) view returns ((uint256 tokenId, uint32 weightGrams, uint8 healthScore, string note, uint64 checkedAt, uint64 nonce))',
  'function farmSigner() view returns (address)',
]);

async function main() {
  const ensOnly = process.argv.includes('--ens-only');
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const [name, weightArg, healthArg, noteArg] = positional;
  if (!name || !name.endsWith(`.${PARENT_NAME}`)) {
    throw new Error(`usage: attest.ts <label|[label.sire].${PARENT_NAME}> [weightGrams] [healthScore] [note] [--ens-only]`);
  }
  const state = loadState();
  const resolverAddr = (state.resolverV2 ?? state.resolver)!;
  if (!state.resolver && !state.resolverV2) throw new Error('run setup-parent first');
  const weightGrams = Number(weightArg ?? 4000);
  const healthScore = Number(healthArg ?? 95);
  const note = noteArg ?? 'weekly check';
  const node = namehash(name);
  const farm = privateKeyToAccount(FARM_SIGNER_PRIVATE_KEY as Hex);
  const checkedAt = BigInt(Math.floor(Date.now() / 1000));

  let rwa: Hex | null = null;
  let tokenId = 0n;
  if (!ensOnly) {
    const contractAddr = await publicClient.getEnsText({ name, key: 'rfc.contract' });
    const tokenIdStr = await publicClient.getEnsText({ name, key: 'rfc.tokenId' });
    if (!contractAddr || !tokenIdStr || contractAddr === 'pending-deployment') {
      throw new Error(`${name} has no live rfc.contract/rfc.tokenId yet — seed --with-nft first, or use --ens-only`);
    }
    rwa = contractAddr as Hex;
    tokenId = BigInt(tokenIdStr);
  }

  // ---- 1+2. sign with the farm key, relay onchain ----
  if (rwa) {
    const prev = await publicClient.readContract({
      address: rwa, abi: roosterRwaAbi, functionName: 'latestAttestation', args: [tokenId],
    });
    const nonce = prev.nonce + 1n;
    const attestation: Attestation = { tokenId, weightGrams, healthScore, note, checkedAt, nonce };
    const domain = roosterRwaDomain(11155111, rwa);
    const signature = await farm.signTypedData({ domain, types: { Attestation: ATTESTATION_TYPE }, primaryType: 'Attestation', message: attestation });
    await send(`submitAttestation ${name}`, walletFor(ENS_OWNER_PRIVATE_KEY), {
      address: rwa, abi: roosterRwaAbi, functionName: 'submitAttestation',
      args: [{ tokenId, weightGrams, healthScore, note, checkedAt, nonce }, signature],
    });

    // negative: forged signature must be rejected (simulation)
    const forged: Attestation = { ...attestation, nonce: nonce + 1n };
    const badSig = await ownerAccount.signTypedData({ domain, types: { Attestation: ATTESTATION_TYPE }, primaryType: 'Attestation', message: forged });
    const submitData = encodeFunctionData({
      abi: roosterRwaAbi, functionName: 'submitAttestation',
      args: [forged, badSig],
    });
    try {
      await publicClient.call({ to: rwa, data: submitData, account: ownerAccount.address });
      throw new Error('NEGATIVE PATH FAILED: non-farm signature accepted!');
    } catch (e) {
      if (String(e).includes('NEGATIVE PATH')) throw e;
      console.log('non-farm signature rejected by RoosterRWA (InvalidSigner) ✓');
    }
  }

  // ---- 3. same values to ENS, written BY THE FARM KEY ----
  const farmClient = walletFor(FARM_SIGNER_PRIVATE_KEY as Hex);
  for (const [key, value] of [['rfc.weight', String(weightGrams)], ['rfc.health', String(healthScore)], ['rfc.attestedAt', String(checkedAt)]] as const) {
    await send(`farm setText ${name} ${key}`, farmClient, {
      address: resolverAddr, abi: resolverAbi, functionName: 'setText', args: [node, key, value],
    });
  }

  // ---- 4. negative ENS path: third party must be rejected ----
  const ensData = encodeFunctionData({ abi: resolverAbi, functionName: 'setText', args: [node, 'rfc.weight', '1'] });
  try {
    await publicClient.call({ to: state.resolver, data: ensData, account: '0x000000000000000000000000000000000000d00d' });
    throw new Error('NEGATIVE PATH FAILED: third party wrote rfc.weight!');
  } catch (e) {
    if (String(e).includes('NEGATIVE PATH')) throw e;
    console.log('third-party ENS write rejected (EACUnauthorizedAccountRoles) ✓');
  }

  // ---- read back ----
  if (rwa) {
    const latest = await publicClient.readContract({
      address: rwa, abi: roosterRwaAbi, functionName: 'latestAttestation', args: [tokenId],
    });
    console.log(`contract: ${latest.weightGrams}g health=${latest.healthScore} nonce=${latest.nonce} checkedAt=${latest.checkedAt}`);
  }
  const [w, h, at] = await Promise.all(['rfc.weight', 'rfc.health', 'rfc.attestedAt'].map((key) => publicClient.getEnsText({ name, key })));
  console.log(`ens:      ${name} weight=${w} health=${h} attestedAt=${at}`);
  if (w !== String(weightGrams) || h !== String(healthScore) || at !== String(checkedAt)) throw new Error('ENS readback mismatch');
  console.log('attest round-trip PASS ✓');
}

main().catch((e) => { console.error('attest FAIL:', e); process.exit(1); });
