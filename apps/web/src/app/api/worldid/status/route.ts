import { getAddress, isAddress } from "viem";
import { resolveHumanRegistry } from "@/server/worldid/registry";
import { getWorldIdStore } from "@/server/worldid/store";
import type { Hex, HumanStatusResponse } from "@/lib/worldid/types";

// GET ?address=0x… -> is this wallet a verified human (server record + onchain HumanRegistry)?
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(raw, { strict: false })) {
    return Response.json({ error: "address is required" }, { status: 400 });
  }
  const address = getAddress(raw).toLowerCase() as Hex;
  const human = (await getWorldIdStore().read()).humans[address];

  let onchain: boolean | null = null;
  const registry = await resolveHumanRegistry();
  if (registry.client) {
    onchain = await registry.client.isVerified(address).catch(() => null);
  }

  const body: HumanStatusResponse = {
    address,
    verified: Boolean(human),
    verifiedAt: human?.verifiedAt,
    txHash: human?.txHash ?? null,
    onchain,
  };
  return Response.json(body);
}
