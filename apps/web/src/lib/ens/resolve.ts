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
  "event LabelRegistered(string label, address indexed owner, uint256 indexed tokenId)",
]);

// TODO: switch to the exported roosterRwaAbi when eth-dev1 lands it in lib/contracts/abis.
export const roosterRwaAbi = parseAbi([
  "function roosters(uint256 tokenId) view returns (string name, string ringId, uint8 sireLine, uint64 hatchedAt, uint256 sireTokenId, uint256 damTokenId, string ensName)",
  "function latestAttestation(uint256 tokenId) view returns (uint256 tokenId, uint32 weightGrams, uint8 healthScore, string note, uint64 checkedAt, uint64 nonce)",
  "function farmSigner() view returns (address)",
]);

const SIRE_LINES = [
  { slug: "kumarnjeen", roman: "Kumarnjeen", thai: "กุมารจีน", emoji: "🏹" },
  { slug: "kingkong", roman: "Kingkong", thai: "คิงคอง", emoji: "💪" },
  { slug: "chaokhunthong", roman: "Chaokhunthong", thai: "เจ้าขุนทอง", emoji: "👑" },
  { slug: "thepbut", roman: "Thepbut", thai: "เทพบุตร", emoji: "✨" },
  { slug: "raptor", roman: "Raptor", thai: "แร๊พเตอร์", emoji: "🦅" },
] as const;
export const sireLineInfo = (slug: string) => SIRE_LINES.find((s) => s.slug === slug);

export const PARENT_NAME = (process.env.NEXT_PUBLIC_ENS_PARENT_NAME ?? "rfclegends.eth").toLowerCase();

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
  const labels = parentName.replace(/\.eth$/, "").split(".");
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

/** All labels ever registered in a registry (from LabelRegistered logs). */
export async function labelsInRegistry(client: ReturnType<typeof ensClient>, registry: Hex): Promise<string[]> {
  const logs = await client.getLogs({
    address: registry,
    event: parseAbi(["event LabelRegistered(string label, address indexed owner, uint256 indexed tokenId)"])[0],
    fromBlock: BigInt(0), toBlock: "latest",
  }).catch(() => []);
  return logs.map((l) => (l.args as { label?: string }).label).filter((x): x is string => !!x);
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
  const out: RoosterSummary[] = [];
  for (const label of foundationLabels) {
    const name = `${label}.${PARENT_NAME}`;
    const recs = await getRoosterRecords(client, name);
    if (!recs.ringId && !recs.sireLine) continue; // not a rooster node
    const child = await registryForParent(client, name);
    const offspring = child ? (await labelsInRegistry(client, child)).map((l) => `${l}.${name}`) : [];
    out.push({ ...recs, offspringNames: offspring });
  }
  return out;
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
    const r = await client.readContract({ address: rwa, abi: roosterRwaAbi, functionName: "roosters", args: [tokenId] });
    const ensName = r[6];
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
    if (a[4] === BigInt(0)) return null;
    return { weightGrams: a[1], healthScore: a[2], note: a[3], checkedAt: a[4], farmSigner, nonce: a[5] };
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
