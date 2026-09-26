/**
 * GET /api/ens/records?name=<ens-name> — all rfc.* text records for a rooster
 * name, resolved live through the ENSv2 Universal Resolver. Handy for demos
 * and for verifying the permissioned-resolver write path from the UI.
 */
import { NextResponse } from "next/server";
import { ensClient, getRoosterRecords, PARENT_NAME } from "@/lib/ens/resolve";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const raw = url.searchParams.get("name");
  if (!raw) return NextResponse.json({ error: "missing ?name=" }, { status: 400 });
  const name = (raw.endsWith(".eth") ? raw : `${raw}.${PARENT_NAME}`).toLowerCase();
  const client = ensClient();
  try {
    const records = await getRoosterRecords(client, name);
    return NextResponse.json({ name, parent: PARENT_NAME, records, source: "live ENSv2 read (Sepolia)" });
  } catch (e) {
    return NextResponse.json({ error: `resolution failed: ${String(e).slice(0, 200)}` }, { status: 502 });
  }
}
