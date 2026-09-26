/**
 * OpenSea-style token metadata for RoosterRWA.tokenURI: <base>/api/roosters/{id}.
 * Everything is resolved live: the contract gives the ENS name, ENS gives the
 * records, the contract gives the latest attestation.
 */
import { NextResponse } from "next/server";
import {
  ensClient, getAttestation, getRoosterByTokenId, getRoosterRecords, sireLineInfo,
} from "@/lib/ens/resolve";
import { getAddresses } from "@/lib/contracts/addresses";

export const dynamic = "force-dynamic";

const SAMPLE_RING_PREFIX = "NL-"; // placeholder ring IDs — real Ninlanee records replace these

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "tokenId must be numeric" }, { status: 400 });
  const client = ensClient();
  let rwa: `0x${string}`;
  try {
    rwa = getAddresses(11155111).RoosterRWA as `0x${string}`;
  } catch {
    return NextResponse.json({ error: "RoosterRWA not deployed on 11155111 yet" }, { status: 503 });
  }
  const tokenId = BigInt(id);
  const rooster = await getRoosterByTokenId(client, rwa, tokenId);
  if (!rooster) return NextResponse.json({ error: "unknown tokenId" }, { status: 404 });

  const recs = await getRoosterRecords(client, rooster.ensName);
  const att = await getAttestation(client, rwa, tokenId);
  const line = sireLineInfo(recs.sireLine ?? "");
  const isSample = !!recs.ringId?.startsWith(SAMPLE_RING_PREFIX);

  const attributes: Record<string, unknown>[] = [
    { trait_type: "Sire Line", value: line ? `${line.roman} ${line.thai}` : (recs.sireLine ?? "unknown") },
    { trait_type: "Ring ID", value: recs.ringId ?? "unknown" },
    { trait_type: "Rarity", value: "Mythic" },
    { trait_type: "Type", value: "RWA — real bird" },
    { trait_type: "Custodian", value: "Ninlanee Farm (sample records)" },
    { trait_type: "Issuer", value: "RFC Club" },
  ];
  if (att) {
    attributes.push(
      { trait_type: "Weight (g)", value: att.weightGrams },
      { trait_type: "Health Score", value: att.healthScore },
      { trait_type: "Last Checked", value: new Date(Number(att.checkedAt) * 1000).toISOString().slice(0, 10) },
    );
  } else if (recs.weight) {
    attributes.push(
      { trait_type: "Weight (g)", value: Number(recs.weight) },
      { trait_type: "Health Score", value: recs.health ? Number(recs.health) : null },
    );
  }
  if (isSample) attributes.push({ trait_type: "Data Source", value: "sample data — placeholder ring ID" });

  return NextResponse.json({
    name: `${recs.displayName ?? rooster.ensName.split(".")[0]} #${id}`,
    description:
      `A Thai native breed rooster cared for at Ninlanee Farm, represented as a RoosterRWA card ` +
      `with ENSv2 pedigree (sample records in this build) — ${rooster.ensName}.`,
    external_url: recs.url ?? undefined,
    image: recs.url ? `${recs.url.replace(/\/roosters.*$/, "")}/api/roosters/${id}/image.svg` : `https://placeholder.pics/svg/512/ffd166/e85d04/%F0%9F%90%93`,
    image_data: {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbbf24"/><stop offset="1" stop-color="#f97316"/></linearGradient></defs><rect width="512" height="512" rx="40" fill="url(#g)"/><text x="256" y="300" font-size="220" text-anchor="middle">🐓</text><text x="256" y="440" font-size="34" text-anchor="middle" fill="#43301f" font-family="sans-serif" font-weight="bold">${(recs.displayName ?? "Rooster").slice(0, 14)}</text></svg>`,
    },
    attributes,
  });
}
