// GET /api/game/state?address=0x… — player (synced to now) + mintable drops, newest first.
// No player yet → `{ player: null, drops: [], demoMode }` with 200; the client shows creation UI.

import { demoMode, getPlayer, listDrops, syncPlayer } from "@/server/game";
import { gameErrorResponse } from "../_helpers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return Response.json({ reason: "INVALID_ADDRESS" }, { status: 400 });

  try {
    const existing = await getPlayer(address);
    if (!existing) {
      return Response.json({ player: null, drops: [], demoMode });
    }
    const { player, zoneId, zoneName } = await syncPlayer(address);
    const drops = (await listDrops(address)).slice().sort((a, b) => b.droppedAt - a.droppedAt);
    return Response.json({ player, drops, demoMode, zoneId, zoneName });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
