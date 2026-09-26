/**
 * MultiBaas REST helper (server-side only: the API key is a secret).
 *
 * Auth and base URL follow docs.curvegrid.com: MULTIBAAS_DEPLOYMENT_URL is
 * the deployment host (e.g. https://<id>.multibaas.com) and MULTIBAAS_API_KEY
 * goes in `Authorization: Bearer <key>`. Endpoints used here:
 *   PUT  /api/v0/queries/{name}          save an event query
 *   GET  /api/v0/queries/{name}/results  execute a saved event query
 * See contracts/scripts/multibaas-setup.mjs for setup (contract upload +
 * query creation) and README §MultiBaas for what is live vs pending.
 */
import type { Hex } from './eip712'

const API = '/api/v0'

export interface MbConfig {
  baseUrl: string
  apiKey: string
}

export function mbConfig(): MbConfig | null {
  const baseUrl = process.env.MULTIBAAS_DEPLOYMENT_URL
  const apiKey = process.env.MULTIBAAS_API_KEY
  return baseUrl && apiKey ? { baseUrl: baseUrl.replace(/\/$/, ''), apiKey } : null
}

export class MultiBaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`MultiBaas ${status}: ${message}`)
    this.name = 'MultiBaasError'
  }
}

async function mbFetch<T>(
  cfg: MbConfig,
  method: 'GET' | 'PUT' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${cfg.baseUrl}${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    throw new MultiBaasError(
      typeof data === 'object' && data !== null && 'message' in data
        ? String((data as { message?: unknown }).message)
        : 'request failed',
      res.status,
      data,
    )
  }
  return data as T
}

// ------------------------------------------------------------ sale history

export interface SaleRecord {
  listingId: bigint
  buyer: Hex
  seller: Hex
  itemId: bigint
  amount: bigint
  total: bigint
  sellerProceeds: bigint
  fee: bigint
  txHash: Hex | null
  blockTimestamp: number | null
  /** Raw MultiBaas row, for debugging and future fields. */
  raw: Record<string, unknown>
}

/**
 * Market sale history through MultiBaas event indexing: executes the saved
 * `rfcSold` query (created by contracts/scripts/multibaas-setup.mjs) over
 * RareMarket's Sold event. Returns newest first.
 *
 * Returns null when MultiBaas is not configured, so callers can fall back to
 * a direct RPC log fetch (the market page shows the split either way).
 */
export async function getSaleHistory(limit = 20): Promise<SaleRecord[] | null> {
  const cfg = mbConfig()
  if (!cfg) return null

  // Saved query `rfc-sold` (contracts/scripts/multibaas-setup.mjs) returns
  // alias-keyed string rows, e.g. { listingId: "2", buyer: "0x…", fee: "200000", … }.
  const res = await mbFetch<{ result?: { rows?: Record<string, string>[] } }>(
    cfg,
    'GET',
    `/queries/rfc-sold/results?limit=${Math.min(100, Math.max(1, limit))}`,
  )
  const rows = res.result?.rows ?? []
  return rows.map((row) => ({
    listingId: BigInt(row.listingId ?? '0'),
    buyer: (row.buyer ?? '0x') as Hex,
    seller: (row.seller ?? '0x') as Hex,
    itemId: 0n, // not selected in the saved query; available via ?query= raw rows
    amount: BigInt(row.amount ?? '0'),
    total: BigInt(row.total ?? '0'),
    sellerProceeds: BigInt(row.sellerProceeds ?? '0'),
    fee: BigInt(row.fee ?? '0'),
    txHash: (row.txHash ?? null) as Hex | null,
    blockTimestamp: row.triggeredAt ? Date.parse(row.triggeredAt) / 1000 || null : null,
    raw: row,
  }))
}

/** Executes any saved event query by name (used by /api/market/sales?query=). */
export async function runEventQuery(name: string, limit = 20): Promise<Record<string, unknown>[] | null> {
  const cfg = mbConfig()
  if (!cfg) return null
  const res = await mbFetch<{ result?: { rows?: Record<string, unknown>[] } }>(
    cfg,
    'GET',
    `/queries/${encodeURIComponent(name)}/results?limit=${Math.min(100, Math.max(1, limit))}`,
  )
  return res.result?.rows ?? []
}
