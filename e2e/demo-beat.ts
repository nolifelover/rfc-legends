/**
 * RFC Legends — end-to-end demo beat.
 *
 * Walks the exact flow the 4-minute video shows, against a real chain:
 *
 *   1. bot wallet C is never World-ID-verified -> mintWithVoucher reverts
 *      NotVerifiedHuman, and listing on the Rare Market reverts NotVerifiedHuman
 *   2. human A is verified; A's second wallet replaying the same nullifier
 *      reverts NullifierAlreadyUsed
 *   3. the game signer signs a MintVoucher -> A mints a Monster Card
 *   4. A lists it on the Rare Market; buyer B faucets USDC, approves, buys
 *   5. the 90/10 split is asserted exactly and a receipt is printed
 *
 * Usage:
 *   npm run demo                            # anvil at localhost:8546 + deployments/anvil.json
 *   npm run demo -- --rpc $SEPOLIA_RPC_URL  # Sepolia + deployments/sepolia.json
 *
 * Keys come from env; on anvil everything works out of the box. On Sepolia,
 * either pass A_KEY/B_KEY/C_KEY (funded wallets) or set FUNDER_KEY (e.g. the
 * deployer) and fresh demo wallets are generated and funded automatically.
 * GAME_SIGNER_PRIVATE_KEY must be the key behind the deployed attestor.
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther, keccak256, toHex, parseEventLogs } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry, sepolia } from 'viem/chains';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mockUsdcAbi, humanRegistryAbi, rareItemsAbi, rareMarketAbi } from '../apps/web/src/lib/contracts/abis.ts';
import { mintVoucherTypedData } from '../apps/web/src/lib/contracts/eip712.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

// ---------------------------------------------------------------- CLI / env

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

const RPC_URL = arg('rpc') ?? 'http://localhost:8546';
const ANVIL = {
  game: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // #1
  a: '0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba', // #2
  b: '0x92db14e403b83dfe3df233f83dfa3a4d2798acf4b9e4a6e1e8d0e0e9f88b6a10', // #3
  c: '0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356', // #4
  funder: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // #0
};
const randomKey = () =>
  ('0x' +
    [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`;

// ---------------------------------------------------------------- chain set

const transport = http(RPC_URL);
const publicClient = createPublicClient({ transport });

const chainId = await publicClient.getChainId();
const chainName = chainId === 31337 ? 'anvil' : chainId === 11155111 ? 'sepolia' : null;
if (!chainName) throw new Error(`unsupported chain ${chainId}; expected 31337 or 11155111`);
const chain = chainId === 31337 ? foundry : sepolia;
const isAnvil = chainId === 31337;

const deployments = JSON.parse(readFileSync(join(REPO, 'contracts', 'deployments', `${chainName}.json`), 'utf8'));
const { HumanRegistry, RareItems, RareMarket, MockUSDC: UsdcAddr } = deployments;

const GAME_KEY = env('GAME_SIGNER_PRIVATE_KEY') ?? ANVIL.game;
const A_KEY = env('A_KEY') ?? (isAnvil ? ANVIL.a : randomKey());
const B_KEY = env('B_KEY') ?? (isAnvil ? ANVIL.b : randomKey());
const C_KEY = env('C_KEY') ?? (isAnvil ? ANVIL.c : randomKey());
const FUNDER_KEY = env('FUNDER_KEY') ?? env('DEPLOYER_PRIVATE_KEY') ?? (isAnvil ? ANVIL.funder : undefined);

const gameSigner = privateKeyToAccount(GAME_KEY as `0x${string}`);
const walletA = privateKeyToAccount(A_KEY as `0x${string}`);
const walletB = privateKeyToAccount(B_KEY as `0x${string}`);
const walletC = privateKeyToAccount(C_KEY as `0x${string}`);

if (deployments.gameSigner.toLowerCase() !== gameSigner.address.toLowerCase()) {
  throw new Error(
    `GAME_SIGNER_PRIVATE_KEY (${gameSigner.address}) is not the deployed attestor (${deployments.gameSigner})`,
  );
}

function clientFor(account: ReturnType<typeof privateKeyToAccount>) {
  return createWalletClient({ account, chain, transport });
}
const gameClient = clientFor(gameSigner);
const aClient = clientFor(walletA);
const bClient = clientFor(walletB);
const cClient = clientFor(walletC);

// ---------------------------------------------------------------- helpers

const fmtUsdc = (v: bigint) => `${(Number(v) / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC`;
let step = 0;
function ok(msg: string) {
  step += 1;
  console.log(`  [${String(step).padStart(2, '0')}] ✓ ${msg}`);
}
async function expectRevert(promise: Promise<unknown>, want: string) {
  try {
    await promise;
  } catch (err) {
    const text = String((err as Error & { shortMessage?: string }).message ?? err);
    if (!text.includes(want)) {
      throw new Error(`expected revert ${want}, got: ${text.slice(0, 300)}`);
    }
    return text;
  }
  throw new Error(`expected revert ${want}, but the call succeeded`);
}
const send = (c: ReturnType<typeof clientFor>, to: `0x${string}`, value: bigint) =>
  c.sendTransaction({ to, value });

/// Makes sure every demo wallet can pay gas. With a funder key (anvil #0 by
/// default locally, the deployer on Sepolia), low wallets are topped up.
async function ensureGas() {
  const wallets = [
    { name: 'game signer', account: gameSigner },
    { name: 'A (seller)', account: walletA },
    { name: 'B (buyer)', account: walletB },
    { name: 'C (bot)', account: walletC },
  ];
  const topUp = isAnvil ? parseEther('1') : parseEther('0.01');
  const min = parseEther('0.001');
  const funder = FUNDER_KEY ? privateKeyToAccount(FUNDER_KEY as `0x${string}`) : null;
  const funderClient = funder ? clientFor(funder) : null;

  for (const { name, account } of wallets) {
    const bal = await publicClient.getBalance({ address: account.address });
    if (bal >= min) continue;
    if (!funderClient) {
      throw new Error(
        `${name} (${account.address}) has no gas and no FUNDER_KEY is set; fund it or pass ${name} via env`,
      );
    }
    const hash = await send(funderClient, account.address, topUp);
    await publicClient.waitForTransactionReceipt({ hash });
    console.log(`  · funded ${name} ${account.address} with ${formatEther(topUp)} ETH`);
  }
}

// Full-hash derivation: every wallet gets its own nullifier, so the demo is
// re-runnable with fresh wallets forever (a masked tail would collide).
const nullifierOf = (addr: `0x${string}`, tag: string) =>
  BigInt(keccak256(toHex(`${addr}:${tag}`)));

// ---------------------------------------------------------------- the beat

console.log(`\nRFC Legends demo beat — chain: ${chainName} (${chainId})`);
if (!isAnvil) {
  console.log(`  wallets — A: ${walletA.address}\n            B: ${walletB.address}\n            C: ${walletC.address}`);
}
await ensureGas();

// --- Step 1: the bot (wallet C) is rejected everywhere ---------------------

console.log('\nWallet C (the bot, never verified):');
{
  const dropId = `0x${Buffer.from('bot-drop').toString('hex').padEnd(64, '0').slice(0, 64)}` as `0x${string}`;
  const voucher = {
    to: walletC.address,
    itemId: 1001n,
    amount: 1n,
    dropId,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  };
  const signature = await gameSigner.signTypedData(mintVoucherTypedData(chainId, RareItems, voucher));

  await expectRevert(
    cClient
      .writeContract({
        address: RareItems,
        abi: rareItemsAbi,
        functionName: 'mintWithVoucher',
        args: [voucher, signature],
      })
      .then((hash) => publicClient.waitForTransactionReceipt({ hash })),
    'NotVerifiedHuman',
  );
  ok('mintWithVoucher(C) reverted NotVerifiedHuman — even with a validly signed voucher');

  await expectRevert(
    cClient
      .writeContract({
        address: RareMarket,
        abi: rareMarketAbi,
        functionName: 'list',
        args: [1001n, 1n, 1_000_000n],
      })
      .then((hash) => publicClient.waitForTransactionReceipt({ hash })),
    'NotVerifiedHuman',
  );
  ok('list(C) reverted NotVerifiedHuman — the bot cannot sell either');
}

// --- Step 2: one human, one account ----------------------------------------

console.log('\nWallet A (the verified human):');
{
  const n1 = nullifierOf(walletA.address, 'worldid');
  const hash = await gameClient.writeContract({
    address: HumanRegistry,
    abi: humanRegistryAbi,
    functionName: 'markVerified',
    args: [walletA.address, n1],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  const verified = await publicClient.readContract({
    address: HumanRegistry,
    abi: humanRegistryAbi,
    functionName: 'isVerified',
    args: [walletA.address],
  });
  if (!verified) throw new Error('A should be verified after markVerified');
  ok(`markVerified(A, n1) recorded onchain`);

  // A's second wallet tries to burn the SAME nullifier.
  const a2 = privateKeyToAccount(randomKey());
  await expectRevert(
    gameClient
      .writeContract({
        address: HumanRegistry,
        abi: humanRegistryAbi,
        functionName: 'markVerified',
        args: [a2.address, n1],
      })
      .then((h) => publicClient.waitForTransactionReceipt({ hash: h })),
    'NullifierAlreadyUsed',
  );
  ok('markVerified(A2, n1) reverted NullifierAlreadyUsed — one human, one account');
}

// --- Step 3: game signer voucher -> A mints a Monster Card ------------------

console.log('\nMint (Monster Card, itemId 1001):');
const ITEM_ID = 1001n;
const UNIT_PRICE = 2_000_000n; // 2 USDC
{
  const dropId = `0x${Buffer.from(`drop-${Date.now()}`).toString('hex').padStart(64, '0').slice(-64)}` as `0x${string}`;
  const voucher = {
    to: walletA.address,
    itemId: ITEM_ID,
    amount: 1n,
    dropId,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  };
  const signature = await gameSigner.signTypedData(mintVoucherTypedData(chainId, RareItems, voucher));

  const hash = await aClient.writeContract({
    address: RareItems,
    abi: rareItemsAbi,
    functionName: 'mintWithVoucher',
    args: [voucher, signature],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const bal = await publicClient.readContract({
    address: RareItems,
    abi: rareItemsAbi,
    functionName: 'balanceOf',
    args: [walletA.address, ITEM_ID],
  });
  if (bal !== 1n) throw new Error(`A should hold 1 item, holds ${bal}`);
  ok('mintWithVoucher(A) minted 1x Monster Card (dropId single-use)');
}

// --- Step 4: A lists, B buys ------------------------------------------------

console.log('\nRare Market (2.00 USDC, split 90/10 in-contract):');
let listingId = 1n; // real id comes from the Listed event
{
  const appr = await aClient.writeContract({
    address: RareItems,
    abi: rareItemsAbi,
    functionName: 'setApprovalForAll',
    args: [RareMarket, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: appr });

  const listed = await aClient.writeContract({
    address: RareMarket,
    abi: rareMarketAbi,
    functionName: 'list',
    args: [ITEM_ID, 1n, UNIT_PRICE],
  });
  await publicClient.waitForTransactionReceipt({ hash: listed });
  ok(`A listed the card (listing #${listingId} @ ${fmtUsdc(UNIT_PRICE)})`);
}
{
  const faucet = await bClient.writeContract({
    address: UsdcAddr,
    abi: mockUsdcAbi,
    functionName: 'mint',
    args: [walletB.address, 10_000_000n],
  });
  await publicClient.waitForTransactionReceipt({ hash: faucet });
  const approve = await bClient.writeContract({
    address: UsdcAddr,
    abi: mockUsdcAbi,
    functionName: 'approve',
    args: [RareMarket, 2n ** 256n - 1n],
  });
  await publicClient.waitForTransactionReceipt({ hash: approve });
  ok('B faucet-minted 10 USDC and approved the market');

  const sellerBefore = await publicClient.readContract({
    address: UsdcAddr,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: [walletA.address],
  });
  const treasuryBefore = await publicClient.readContract({
    address: UsdcAddr,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: [deployments.treasury],
  });

  const bought = await bClient.writeContract({
    address: RareMarket,
    abi: rareMarketAbi,
    functionName: 'buy',
    args: [listingId, 1n],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: bought });

  const sellerAfter = await publicClient.readContract({
    address: UsdcAddr,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: [walletA.address],
  });
  const treasuryAfter = await publicClient.readContract({
    address: UsdcAddr,
    abi: mockUsdcAbi,
    functionName: 'balanceOf',
    args: [deployments.treasury],
  });
  const bItem = await publicClient.readContract({
    address: RareItems,
    abi: rareItemsAbi,
    functionName: 'balanceOf',
    args: [walletB.address, ITEM_ID],
  });

  const total = UNIT_PRICE;
  const fee = (total * 1000n) / 10_000n;
  const proceeds = total - fee;
  if (sellerAfter - sellerBefore !== proceeds) {
    throw new Error(`seller got ${sellerAfter - sellerBefore}, expected ${proceeds}`);
  }
  if (treasuryAfter - treasuryBefore !== fee) {
    throw new Error(`treasury got ${treasuryAfter - treasuryBefore}, expected ${fee}`);
  }
  if (bItem !== 1n) throw new Error(`B should hold the card, holds ${bItem}`);
  ok('B bought the card; seller +90% and treasury +10% exact, B holds the item');

  const explorer = chainId === 31337 ? '(local anvil)' : `https://sepolia.etherscan.io/tx/${receipt.transactionHash}`;
  console.log(
    [
      '',
      '┌────────────────────────────────────────────────────────────────────────┐',
      `│ RECEIPT — listing #${listingId} on ${chainName}                                     │`,
      '├────────────────────────────────────────────────────────────────────────┤',
      `│ item        Monster Card (ERC-1155 id ${ITEM_ID})                           │`,
      `│ price       ${fmtUsdc(total)}                                         │`,
      `│ seller (A)  + ${fmtUsdc(proceeds)} (90%)                                │`,
      `│ treasury    + ${fmtUsdc(fee)} (10%)                                 │`,
      `│ buyer  (B)  1x card received                                          │`,
      `│ bot    (C)  REJECTED — not a verified human                           │`,
      `│ tx          ${explorer}`,
      '└────────────────────────────────────────────────────────────────────────┘',
      '',
    ].join('\n'),
  );
}

// Conserve the funder: sweep each demo wallet's remaining ETH back.
if (FUNDER_KEY) {
  const funderAddr = privateKeyToAccount(FUNDER_KEY as `0x${string}`).address;
  for (const { name, account } of [
    { name: 'A (seller)', account: walletA },
    { name: 'B (buyer)', account: walletB },
    { name: 'C (bot)', account: walletC },
  ]) {
    const bal = await publicClient.getBalance({ address: account.address });
    if (bal <= 21_000n * 2_000_000_000n) continue; // not worth the gas
    try {
      const gas = await publicClient.estimateGas({
        account: account.address,
        to: funderAddr,
        value: bal,
      } as Parameters<typeof publicClient.estimateGas>[0]);
      const gasCost = gas * 2_000_000_000n; // ~2 gwei ceiling
      if (bal <= gasCost) continue;
      const h = await clientFor(account).sendTransaction({
        to: funderAddr,
        value: bal - gasCost,
        gas,
      });
      await publicClient.waitForTransactionReceipt({ hash: h });
      console.log(`  · swept ${name} -> funder (${(bal - gasCost) / 10n ** 14n / 10000n} ETH)`);
    } catch {
      /* sweep is best-effort */
    }
  }
}

console.log('All demo-beat assertions passed.\n');
