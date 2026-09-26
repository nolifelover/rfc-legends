import { getAddress, isAddress } from "viem";
import { loadWorldIdConfig, WorldIdConfigError } from "@/server/worldid/config";
import { issueRpContext } from "@/server/worldid/rp-context";
import { getWorldIdStore } from "@/server/worldid/runtime";
import type { Hex } from "@/lib/worldid/types";

// POST { address } -> { app_id, action, environment, signal, rp_context }
// The RP signature is minted here because World ID 4 refuses unsigned requests
// and the signing key must never reach the browser.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { address?: unknown } | null;
  const raw = typeof body?.address === "string" ? body.address : "";
  if (!isAddress(raw, { strict: false })) {
    return Response.json({ error: "Connect a wallet first." }, { status: 400 });
  }
  try {
    const cfg = loadWorldIdConfig();
    const address = getAddress(raw).toLowerCase() as Hex;
    return Response.json(await issueRpContext(address, cfg, getWorldIdStore()));
  } catch (err) {
    if (err instanceof WorldIdConfigError) return Response.json({ error: err.message }, { status: 503 });
    console.error("[worldid] rp-context failed", err);
    return Response.json({ error: "Couldn't start World ID verification." }, { status: 500 });
  }
}
