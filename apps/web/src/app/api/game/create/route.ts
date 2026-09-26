// POST /api/game/create { address, name, sireLine } → `{ player }`.
// PLAYER_EXISTS → 409; invalid body / engine validation → 400 `{ reason }`.

import { createPlayer } from "@/server/game";
import { badBody, createBodySchema, gameErrorResponse, readJson } from "../_helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = createBodySchema.safeParse(await readJson(req));
  if (!parsed.success) return badBody();

  try {
    const player = await createPlayer(
      parsed.data.address,
      parsed.data.name,
      parsed.data.sireLine,
    );
    return Response.json({ player });
  } catch (err) {
    return gameErrorResponse(err);
  }
}
