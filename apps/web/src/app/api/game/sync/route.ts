// POST /api/game/sync { address } → SyncResult `{ player, live, offline, demoMode }`.
// Advances the player to now: live tick sim for the recent window, rate-based offline settle after.

import { syncPlayer } from "@/server/game";
import { badBody, gameErrorResponse, readJson, syncBodySchema } from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = syncBodySchema.safeParse(await readJson(req));
  if (!parsed.success) return badBody();

  try {
    return Response.json(await syncPlayer(parsed.data.address));
  } catch (err) {
    return gameErrorResponse(err);
  }
}
