/**
 * E4 — ENSv2 resolution helpers (server-side, viem).
 *
 * Everything here reads LIVE from Sepolia through the canonical ENSv2
 * Universal Resolver entry proxy — no hard-coded names; the parent comes
 * from NEXT_PUBLIC_ENS_PARENT_NAME. Pedigree traversal uses the ENSv2
 * hierarchy itself: each bird's offspring live in the bird's own child
 * registry, discovered by walking getSubregistry() and LabelRegistered logs.
 */
import { createPublicClient, http, namehash, type Hex, parseAbi } from "viem";
import { sepolia } from "viem/chains";

/** Canonical ENSv2 beta deployment on Sepolia (fronted by the entry UR proxy viem ships). */
export const ENSV2 = {
  ethRegistry: "0x657ea849311d3d5823348dded7c2aaafb3ede09e" as const,
} as const;

const registryAbi = parseAbi([
  "function getSubregistry(string label) view returns (address)",
  "function getResolver(string label) view returns (address)",
  "event LabelRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)",
]);

// TODO: switch to the exported roosterRwaAbi when eth-dev1 lands it in lib/contracts/abis.
export const roosterRwaAbi = parseAbi([
  "function getRooster(uint256 tokenId) view returns ((string name, string ringId, uint8 sireLine, uint64 hatchedAt, uint256 sireTokenId, uint256 damTokenId, string ensName))",
  "function latestAttestation(uint256 tokenId) view returns ((uint256 tokenId, uint32 weightGrams, uint8 healthScore, string note, uint64 checkedAt, uint64 nonce))",
  "function farmSigner() view returns (address)",
]);

const SIRE_LINES = [
  { slug: "kumarnjeen", roman: "Kumarnjeen", thai: "กุมารจีน", emoji: "🏹" },
  { slug: "kingkong", roman: "Kingkong", thai: "คิงคอง", emoji: "💪" },
  { slug: "chaokhunthong", roman: "Chaokhunthong", thai: "เจ้าขุนทอง", emoji: "👑" },
  { slug: "thepbut", roman: "Thepbut", thai: "เทพบุตร", emoji: "✨" },
  { slug: "raptor", roman: "Raptor", thai: "แร๊พเตอร์", emoji: "🦅" },
] as const;
/**
 * Presentation map for sire-line display names (romanization + Thai flavor).
 * The SOURCE OF TRUTH is always the onchain `rfc.sireLine` text record — an
 * unknown slug renders as its raw onchain value, never masked or defaulted.
 */
export const sireLineInfo = (slug: string) => SIRE_LINES.find((s) => s.slug === slug) ?? null;

const parentFromEnv = (process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "").toLowerCase();
if (!parentFromEnv || !parentFromEnv.endsWith(".eth")) {
  throw new Error(
    "NEXT_PUBLIC_ENS_PARENT_NAME must be set (e.g. 'rfclegends.eth') — names are never hard-coded",
  );
}
export const PARENT_NAME = parentFromEnv;

export function ensClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"),
  });
}

export type RoosterRecords = {
  name: string;
  sireLine: string | null;
  ringId: string | null;
  displayName: string | null;
  hatchedAt: string | null;
  contract: string | null;
  tokenId: string | null;
  weight: string | null;
  health: string | null;
  attestedAt: string | null;
  note: string | null;
  url: string | null;
};

const RECORD_KEYS = [
  "rfc.sireLine", "rfc.ringId", "rfc.displayName", "rfc.hatchedAt",
  "rfc.contract", "rfc.tokenId", "rfc.weight", "rfc.health", "rfc.attestedAt",
  "rfc.note", "url",
] as const;

/** Read all rfc.* text records for a name through the entry Universal Resolver. */
export async function getRoosterRecords(client: ReturnType<typeof ensClient>, name: string): Promise<RoosterRecords> {
  const values = await Promise.all(
    RECORD_KEYS.map((key) => client.getEnsText({ name, key }).catch(() => null)),
  );
  const rec = Object.fromEntries(RECORD_KEYS.map((key, i) => [key, values[i]])) as Record<string, string | null>;
  return {
    name,
    sireLine: rec["rfc.sireLine"], ringId: rec["rfc.ringId"], displayName: rec["rfc.displayName"],
    hatchedAt: rec["rfc.hatchedAt"], contract: rec["rfc.contract"], tokenId: rec["rfc.tokenId"],
    weight: rec["rfc.weight"], health: rec["rfc.health"], attestedAt: rec["rfc.attestedAt"],
    note: rec["rfc.note"], url: rec["url"],
  };
}

/** Does this name exist in our namespace (has records)? */
export async function nameExists(client: ReturnType<typeof ensClient>, name: string): Promise<boolean> {
  const v = await client.getEnsText({ name, key: "rfc.ringId" }).catch(() => null);
  return v !== null && v !== "";
}

/** The registry that holds `label` entries, walking from the ETH registry down. */
export async function registryForParent(client: ReturnType<typeof ensClient>, parentName: string): Promise<Hex | null> {
  // walk top-down: the name's LAST label before .eth hangs off the ETH registry
  const labels = parentName.replace(/\.eth$/, "").split(".").reverse();
  let registry: Hex = ENSV2.ethRegistry;
  for (const label of labels) {
    const next = (await client.readContract({
      address: registry, abi: registryAbi, functionName: "getSubregistry", args: [label],
    }).catch(() => null)) as Hex | null;
    if (!next || next === "0x0000000000000000000000000000000000000000") return null;
    registry = next;
  }
  return registry;
}

/** ENSv2 beta epoch on Sepolia — no rooster registry existed before this block. */
const ENSV2_START_BLOCK = BigInt(11784970);
const LOG_RANGE = BigInt(5_000); // stay under public-RPC block-range limits
const labelCache = new Map<`0x${string}`, { at: number; labels: string[] }>();
const CACHE_TTL_MS = 60_000;

/**
 * All labels ever registered in a registry, from LabelRegistered logs.
 * Chunked (public RPCs cap log ranges) and cached briefly. Errors propagate
 * so the UI can show a failure instead of silently rendering nothing.
 */
export async function labelsInRegistry(client: ReturnType<typeof ensClient>, registry: Hex): Promise<string[]> {
  const hit = labelCache.get(registry);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.labels;
  const event = parseAbi([
    "event LabelRegistered(uint256 indexed tokenId, bytes32 indexed labelHash, string label, address owner, uint64 expiry, address indexed sender)",
  ])[0];
  const labels: string[] = [];
  const latest = await client.getBlockNumber();
  for (let from = ENSV2_START_BLOCK; from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - 1n > latest ? latest : from + LOG_RANGE - 1n;
    const logs = await client.getLogs({ address: registry, event, fromBlock: from, toBlock: to });
    for (const l of logs) {
      const label = (l.args as { label?: string }).label;
      if (label) labels.push(label);
    }
  }
  labelCache.set(registry, { at: Date.now(), labels });
  return labels;
}

export type RoosterSummary = RoosterRecords & { offspringNames: string[] };

/**
 * List every rooster under the parent: foundation birds from the parent's
 * registry logs, plus their offspring from each bird's child registry —
 * all discovered live from the ENSv2 hierarchy.
 */
export async function listRoosters(client: ReturnType<typeof ensClient>): Promise<RoosterSummary[]> {
  const parentRegistry = await registryForParent(client, PARENT_NAME);
  if (!parentRegistry) return [];
  const foundationLabels = await labelsInRegistry(client, parentRegistry);
  // parallel across birds — the list must render fast for the live demo
  const rows = await Promise.all(foundationLabels.map(async (label) => {
    const name = `${label}.${PARENT_NAME}`;
    const [recs, child] = await Promise.all([
      getRoosterRecords(client, name),
      registryForParent(client, name),
    ]);
    if (!recs.ringId && !recs.sireLine) return null; // not a rooster node
    const offspring = child ? (await labelsInRegistry(client, child)).map((l) => `${l}.${name}`) : [];
    return { ...recs, offspringNames: offspring } satisfies RoosterSummary;
  }));
  return rows.filter((r): r is RoosterSummary => r !== null);
}

/** Offspring names of a bird — labels registered in the bird's own child registry. */
export async function listOffspring(client: ReturnType<typeof ensClient>, name: string): Promise<string[]> {
  const child = await registryForParent(client, name);
  if (!child) return [];
  const labels = await labelsInRegistry(client, child);
  return labels.map((l) => `${l}.${name}`);
}

/** Find a rooster by numeric RoosterRWA tokenId (contract-first, then ENS records). */
export async function getRoosterByTokenId(
  client: ReturnType<typeof ensClient>, rwa: Hex, tokenId: bigint,
): Promise<{ ensName: string } | null> {
  try {
    const r = await client.readContract({ address: rwa, abi: roosterRwaAbi, functionName: "getRooster", args: [tokenId] });
    const ensName = r.ensName;
    return ensName ? { ensName } : null;
  } catch { return null; }
}

/** Latest onchain attestation for a token (weight/health/date/signer), contract-side. */
export async function getAttestation(
  client: ReturnType<typeof ensClient>, rwa: Hex, tokenId: bigint,
): Promise<{ weightGrams: number; healthScore: number; note: string; checkedAt: bigint; farmSigner: Hex; nonce: bigint } | null> {
  try {
    const [a, farmSigner] = await Promise.all([
      client.readContract({ address: rwa, abi: roosterRwaAbi, functionName: "latestAttestation", args: [tokenId] }),
      client.readContract({ address: rwa, abi: roosterRwaAbi, functionName: "farmSigner" }),
    ]);
    if (a.checkedAt === BigInt(0)) return null;
    return { weightGrams: a.weightGrams, healthScore: a.healthScore, note: a.note, checkedAt: a.checkedAt, farmSigner, nonce: a.nonce };
  } catch { return null; }
}

/** Pedigree edges for a rooster name, derived from the ENS hierarchy itself. */
export function pedigreeOf(name: string): { sire: string | null } {
  const labels = name.replace(/\.eth$/, "").split(".");
  const depth = labels.length - 1; // labels under .eth
  if (depth < 2) return { sire: null };
  return { sire: `${labels.slice(1).join(".")}.eth` };
}

export const namehashOf = (name: string) => namehash(name);

export const ETHERSCAN = (hashOrAddr: string, kind: "tx" | "address" | "token" = "address") =>
  `https://sepolia.etherscan.io/${kind}/${hashOrAddr}`;
export const ENS_APP = (name: string) => `https://app.ens.dev/name/${name}`;
