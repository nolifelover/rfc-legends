// POST /api/game/action — one monotonic, server-authoritative manual-control command.

import { applyGameAction } from '../../../../server/game'
import { badBody, gameActionBodySchema, gameErrorResponse, readJson } from '../_helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const parsed = gameActionBodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badBody()

  try {
    const { address, sequence, action } = parsed.data
    return Response.json(await applyGameAction(address, sequence, action))
  } catch (err) {
    return gameErrorResponse(err)
  }
}
