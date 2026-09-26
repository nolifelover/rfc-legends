import { getAddress, isAddress } from "viem";
import { WorldIdConfigError } from "@/server/worldid/config";
import { resolveHumanRegistry } from "@/server/worldid/registry";
import { getWorldIdStore } from "@/server/worldid/runtime";
import type { Hex, HumanStatusResponse } from "@/lib/worldid/types";

// GET ?address=0x… -> is this wallet a verified human (server binding + live HumanRegistry read)?
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(raw, { strict: false })) {
    return Response.json({ error: "address is required" }, { status: 400 });
  }
  const address = getAddress(raw).toLowerCase() as Hex;
  let human;
  try {
    human = await getWorldIdStore().getVerifiedHuman(address);
  } catch (err) {
    if (err instanceof WorldIdConfigError) return Response.json({ error: err.message }, { status: 503 });
    throw err;
  }

  let onchainVerified: boolean | null = null;
  const registry = await resolveHumanRegistry();
  if (registry.client) {
    onchainVerified = await registry.client.isVerified(address).catch(() => null);
  }

  const body: HumanStatusResponse = {
    address,
    verified: Boolean(human),
    verifiedAt: human?.verifiedAt,
    txHash: human?.txHash ?? null,
    onchain: human?.onchain ?? null,
    onchainVerified,
  };
  return Response.json(body);
}
