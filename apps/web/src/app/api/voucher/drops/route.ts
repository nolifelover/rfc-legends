import { getAddress, isAddress } from "viem";
import { dailyMintLimit } from "@/server/worldid/chain";
import { devFixturesEnabled, getGameApi } from "@/server/worldid/deps";
import { getWorldIdStore } from "@/server/worldid/store";
import { MIN_BASE_LEVEL, MINTABLE_RARITIES, utcDay } from "@/server/worldid/voucher";

// GET ?address= -> the wallet's mint-eligible drops plus what the mint checks will look at.
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("address") ?? "";
  if (!isAddress(raw, { strict: false })) return Response.json({ error: "address is required" }, { status: 400 });
  const address = getAddress(raw).toLowerCase();

  const game = await getGameApi();
  const [player, drops, state] = await Promise.all([
    game.getPlayer(address),
    game.listDrops(address),
    getWorldIdStore().read(),
  ]);
  return Response.json({
    player: player ? { name: player.name ?? null, baseLevel: player.baseLevel } : null,
    minBaseLevel: MIN_BASE_LEVEL,
    drops: drops.filter((d) => MINTABLE_RARITIES.has(d.rarity) && d.itemId >= 1000),
    mintsToday: state.vouchers[address]?.[utcDay(new Date())]?.length ?? 0,
    dailyLimit: dailyMintLimit(),
    /** True when the game data is fake (local dev only); the UI labels it. */
    devFixtures: devFixturesEnabled(),
  });
}
