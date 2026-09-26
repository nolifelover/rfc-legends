#!/usr/bin/env node
/**
 * MultiBaas setup (C7) — uploads the five Sepolia contracts, links their
 * addresses with event indexing from the deploy block, and saves four event
 * queries. Shapes follow the official SDK docs
 * (github.com/curvegrid/multibaas-sdk-typescript):
 *   POST /api/v0/contracts/{label}                    body: BaseContract
 *   POST /api/v0/chains/ethereum/addresses/{addr}/contracts  body: LinkAddressContractRequest
 *   PUT  /api/v0/queries/{name}                       body: SavedEventQuery
 *   GET  /api/v0/queries/{name}/results               execute
 *
 * Usage:  cd contracts && node scripts/multibaas-setup.mjs   (.env sourced)
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const API = '/api/v0'
const HERE = new URL('..', import.meta.url).pathname
const SEPOLIA = JSON.parse(readFileSync(new URL('../deployments/sepolia.json', import.meta.url), 'utf8'))

const BASE = process.env.MULTIBAAS_DEPLOYMENT_URL?.replace(/\/$/, '')
const KEY = process.env.MULTIBAAS_API_KEY
if (!BASE || !KEY) {
  console.error('Set MULTIBAAS_DEPLOYMENT_URL and MULTIBAAS_API_KEY (contracts/.env)')
  process.exit(1)
}

async function call(method, path, body, tolerate = []) {
  const res = await fetch(`${BASE}${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => null)
  console.log(`${method} ${path} -> ${res.status}`)
  if (!res.ok) {
    if (tolerate.includes(res.status)) {
      console.log(`   (tolerated: ${res.status})`)
      return null
    }
    console.error(JSON.stringify(data, null, 2))
    throw new Error(`${method} ${path} failed (${res.status})`)
  }
  return data
}

const abi = (name) =>
  execFileSync('forge', ['inspect', name, 'abi', '--json'], { cwd: HERE, encoding: 'utf8' }).trim()
const bin = (name) =>
  execFileSync('forge', ['inspect', name, 'bytecode'], { cwd: HERE, encoding: 'utf8' }).trim()

// ------------------------------------------------- 1. create + link contracts

console.log(`Uploading contracts to ${BASE} …`)
// MultiBaas labels are constrained to lowercase (label_check); kebab-case
// both the label and the contractName alias.
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
for (const name of ['MockUSDC', 'HumanRegistry', 'RareItems', 'RareMarket', 'RoosterRWA']) {
  const label = kebab(name)
  await call('POST', `/contracts/${label}`, {
    label,
    contractName: label,
    version: '1.0.0',
    rawAbi: abi(name),
    bin: bin(name),
  }, [409])
  await call('POST', `/chains/ethereum/addresses/${SEPOLIA[name]}/contracts`, {
    label,
    // The deployment's plan limits how far back event indexing may start
    // ("past logs max depth limit"), so index recent history instead of the
    // deploy block; older events stay reachable via direct RPC (the market
    // route's fallback). RFC_MB_START can override, e.g. 'latest' or '-100'.
    startingBlock: process.env.RFC_MB_START ?? 'latest',
  }, [409])
}

// ------------------------------------------------------- 2. event queries

// Input fields must carry inputIndex (their ABI position in the event);
// name alone is rejected. Order below matches each event's ABI.
const input = (name, i) => ({ type: 'input', inputIndex: i, alias: name })
const select = (...fields) => fields

const QUERIES = [
  {
    name: 'rfc-sold',
    description: 'RareMarket 90/10 sales (the demo receipt)',
    contract: 'rare-market',
    event: 'Sold',
    fields: select(
      input('listingId', 0), input('buyer', 1), input('seller', 2), input('amount', 3),
      input('total', 4), input('sellerProceeds', 5), input('fee', 6),
      { type: 'tx_hash', alias: 'txHash' },
      { type: 'triggered_at', alias: 'triggeredAt' },
    ),
  },
  {
    name: 'rfc-rare-minted',
    description: 'Rare drops minted with server vouchers',
    contract: 'rare-items',
    event: 'RareMinted',
    fields: select(input('to', 0), input('itemId', 1), input('amount', 2), input('dropId', 3),
      { type: 'tx_hash', alias: 'txHash' }, { type: 'triggered_at', alias: 'triggeredAt' }),
  },
  {
    name: 'rfc-attestation-recorded',
    description: 'Farm health attestation relays',
    contract: 'rooster-rwa',
    event: 'AttestationRecorded',
    fields: select(input('tokenId', 0), input('weightGrams', 1), input('healthScore', 2), input('checkedAt', 3), input('nonce', 4),
      { type: 'tx_hash', alias: 'txHash' }, { type: 'triggered_at', alias: 'triggeredAt' }),
  },
  {
    name: 'rfc-rooster-minted',
    description: 'Farm co-signed rooster registrations',
    contract: 'rooster-rwa',
    event: 'RoosterMinted',
    fields: select(input('tokenId', 0), input('to', 1), input('sireLine', 2), input('ringId', 6),
      { type: 'tx_hash', alias: 'txHash' }, { type: 'triggered_at', alias: 'triggeredAt' }),
  },
]

console.log(`Saving ${QUERIES.length} event queries …`)
for (const q of QUERIES) {
  // Body is the EventQuery itself (SDK: setEventQuery(EventQuery)) — the
  // label comes from the path.
  await call('PUT', `/queries/${q.name}`, {
    events: [
      {
        eventName: q.event,
        select: q.fields,
        filter: { fieldType: 'contract_label', operator: 'equal', value: q.contract },
      },
    ],
    orderBy: 'triggeredAt',
    order: 'DESC',
  })
}

// ------------------------------------------------------------ 3. smoke test

console.log('Executing rfc-sold (expect the Sepolia demo sale) …')
const res = await call('GET', '/queries/rfc-sold/results?limit=5')
const rows = res?.result?.records ?? res?.result ?? res
console.log(JSON.stringify(rows, null, 2).slice(0, 1500))
console.log('\nMultiBaas setup complete — flip README §MultiBaas and the market route to LIVE.')
