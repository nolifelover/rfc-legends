#!/usr/bin/env node
/**
 * MultiBaas setup for the Curvegrid prize — runs the moment
 * MULTIBAAS_DEPLOYMENT_URL + MULTIBAAS_API_KEY land in contracts/.env.
 *
 * Docs (docs.curvegrid.com): the deployment URL is the base
 * (https://<id>.multibaas.com), the API key rides `Authorization: Bearer`,
 * and the endpoints used are:
 *   POST /api/v0/contracts            upload a contract's ABI
 *   PUT  /api/v0/queries/{name}       create/update a saved event query
 *   GET  /api/v0/queries/{name}/results  execute a saved query (smoke test)
 *
 * Event-query request bodies follow the Event Indexing guide (events +
 * fields + filters + aggregators). NOTE: the per-endpoint API reference pages
 * render their schemas with client-side JS, so exact field spellings are
 * verified on first live run — the script prints the API's full response on
 * any non-OK so mismatches are a one-line fix (tracked in
 * docs/feedback/multibaas.md).
 *
 * Usage:  node scripts/multibaas-setup.mjs   (from contracts/, .env sourced)
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const API = '/api/v0'
const SEPOLIA = JSON.parse(readFileSync(new URL('../deployments/sepolia.json', import.meta.url), 'utf8'))

const BASE = process.env.MULTIBAAS_DEPLOYMENT_URL?.replace(/\/$/, '')
const KEY = process.env.MULTIBAAS_API_KEY
if (!BASE || !KEY) {
  console.error('Set MULTIBAAS_DEPLOYMENT_URL and MULTIBAAS_API_KEY (contracts/.env)')
  process.exit(1)
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json().catch(() => null)
  console.log(`${method} ${path} -> ${res.status}`)
  if (!res.ok) {
    console.error(JSON.stringify(data, null, 2))
    throw new Error(`${method} ${path} failed (${res.status})`)
  }
  return data
}

function abi(name) {
  return JSON.parse(execFileSync('forge', ['inspect', name, 'abi', '--json'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' }))
}

// ---------------------------------------------------------------- contracts

const CONTRACTS = [
  { name: 'MockUSDC', address: SEPOLIA.MockUSDC },
  { name: 'HumanRegistry', address: SEPOLIA.HumanRegistry },
  { name: 'RareItems', address: SEPOLIA.RareItems },
  { name: 'RareMarket', address: SEPOLIA.RareMarket },
  { name: 'RoosterRWA', address: SEPOLIA.RoosterRWA },
]

console.log(`Uploading ${CONTRACTS.length} contracts to ${BASE} …`)
for (const c of CONTRACTS) {
  await call('POST', '/contracts', {
    contract: { name: c.name, abi: abi(c.name) },
    address: c.address,
    label: c.name,
  })
}

// -------------------------------------------------------------- event queries

const QUERIES = [
  {
    name: 'rfcSold',
    description: 'RareMarket 90/10 sales (the demo receipt)',
    events: [{ contract: 'RareMarket', event: 'Sold' }],
    fields: [
      'blk_timestamp',
      'tx_hash',
      'listingId',
      'buyer',
      'seller',
      'amount',
      'total',
      'sellerProceeds',
      'fee',
    ],
    filters: [],
    aggregators: [],
    orderBy: 'blk_timestamp',
    order: 'desc',
  },
  {
    name: 'rfcRareMinted',
    description: 'Rare drops minted with server vouchers',
    events: [{ contract: 'RareItems', event: 'RareMinted' }],
    fields: ['blk_timestamp', 'tx_hash', 'to', 'itemId', 'amount', 'dropId'],
    filters: [],
    aggregators: [],
    orderBy: 'blk_timestamp',
    order: 'desc',
  },
  {
    name: 'rfcAttestationRecorded',
    description: 'Farm health attestations relays',
    events: [{ contract: 'RoosterRWA', event: 'AttestationRecorded' }],
    fields: ['blk_timestamp', 'tx_hash', 'tokenId', 'weightGrams', 'healthScore', 'checkedAt', 'nonce'],
    filters: [],
    aggregators: [],
    orderBy: 'blk_timestamp',
    order: 'desc',
  },
  {
    name: 'rfcRoosterMinted',
    description: 'Farm co-signed rooster registrations',
    events: [{ contract: 'RoosterRWA', event: 'RoosterMinted' }],
    fields: ['blk_timestamp', 'tx_hash', 'tokenId', 'to', 'sireLine', 'ringId'],
    filters: [],
    aggregators: [],
    orderBy: 'blk_timestamp',
    order: 'desc',
  },
]

console.log(`Saving ${QUERIES.length} event queries …`)
for (const q of QUERIES) {
  await call('PUT', `/queries/${q.name}`, { query: q })
}

// ---------------------------------------------------------------- smoke test

console.log('Executing rfcSold (expect the Sepolia demo sale) …')
const res = await call('GET', '/queries/rfcSold/results?limit=5')
console.log(JSON.stringify(res, null, 2).slice(0, 2000))
console.log('\nMultiBaas setup complete. README §MultiBaas and docs/feedback/multibaas.md should now be updated from PENDING to LIVE.')
