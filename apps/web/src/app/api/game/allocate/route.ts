// POST /api/game/allocate { address, allocations: {stat: increment, …} } → `{ player }`.
// Increments of non-negative ints per stat; cost comes from the engine (GDD §2.2 curve).

import { allocateStats } from "@/server/game";
import { allocateBodySchema, badBody, gameErrorResponse, readJson } from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = allocateBodySchema.safeParse(await readJson(req));
  if (!parsed.success) return badBody();

  try {
    const player = await allocateStats(parsed.data.address, parsed.data.allocations);
    return Response.json({ player });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
