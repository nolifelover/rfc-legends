import { loadWorldIdConfig, WorldIdConfigError } from "@/server/worldid/config";
import { resolveHumanRegistry } from "@/server/worldid/registry";
import { getWorldIdStore } from "@/server/worldid/store";
import { verifyHuman } from "@/server/worldid/verify";
import type { VerifyResponse } from "@/lib/worldid/types";

// POST { address, result } -> 200 { verified: true, txHash } | 4xx/5xx { verified: false, code, reason }
// Every rejection is non-2xx so the IDKit widget's handleVerify fails the flow.
export async function POST(request: Request) {
  let cfg;
  try {
    cfg = loadWorldIdConfig();
  } catch (err) {
    if (!(err instanceof WorldIdConfigError)) throw err;
    const body: VerifyResponse = { verified: false, code: "not_configured", reason: err.message };
    return Response.json(body, { status: 503 });
  }
  const input = await request.json().catch(() => null);
  const registry = await resolveHumanRegistry();
  const outcome = await verifyHuman(input, {
    cfg,
    store: getWorldIdStore(),
    registry: registry.client,
    registryNote: registry.client ? undefined : registry.note,
  });
  if (outcome.body.verified) {
    console.info("[worldid] verified", outcome.body.address, outcome.body.onchain, outcome.body.txHash ?? "");
  } else {
    console.warn("[worldid] rejected", outcome.body.code, outcome.body.reason);
  }
  return Response.json(outcome.body, { status: outcome.status });
}
