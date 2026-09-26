import { getAddress, isAddress } from "viem";
import { dailyMintLimit } from "@/server/worldid/chain";
import { gameApi as game } from "@/server/worldid/game";
import { getWorldIdStore } from "@/server/worldid/runtime";
import type { Hex } from "@/lib/worldid/types";
import { MIN_BASE_LEVEL, MINTABLE_RARITIES, utcDay } from "@/server/worldid/voucher";

// GET ?address= -> the wallet's mint-eligible drops plus what the mint checks will look at.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(raw, { strict: false })) return Response.json({ error: "address is required" }, { status: 400 });
  const address = getAddress(raw).toLowerCase();

  const [player, drops, vouchersToday] = await Promise.all([
    game.getPlayer(address),
    game.listDrops(address),
    getWorldIdStore().vouchersOn(address as Hex, utcDay(new Date())),
  ]);
  return Response.json({
    player: player ? { name: player.name ?? null, baseLevel: player.baseLevel } : null,
    minBaseLevel: MIN_BASE_LEVEL,
    drops: drops.filter((d) => MINTABLE_RARITIES.has(d.rarity) && d.itemId >= 1000),
    mintsToday: vouchersToday.length,
    dailyLimit: dailyMintLimit(),
  });
}
