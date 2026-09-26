// Shared validation + error mapping for /api/game/* route handlers.
// GameError carries an ASCII `code`; the UI maps codes to friendly copy.

import { z } from "zod";
import { GameError } from "@/server/game";

export const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-hex address of 42 chars");

export const sireLineSchema = z.enum([
  "kumarnjeen",
  "kingkong",
  "chaokhunthong",
  "thepbut",
  "raptor",
]);

export const createBodySchema = z.object({
  address: addressSchema,
  name: z.string().trim().min(1, "1-24 chars").max(24, "1-24 chars"),
  sireLine: sireLineSchema,
});

export const allocateBodySchema = z.object({
  address: addressSchema,
  // partialRecord (zod 4): keys optional; plain z.record with an enum key would
  // require every stat to be present.
  allocations: z.partialRecord(
    z.enum(["str", "agi", "vit", "int", "dex", "luk"]),
    z.number().int().nonnegative(),
  ),
});

export const syncBodySchema = z.object({ address: addressSchema });

export function badBody(reason = "INVALID_BODY"): Response {
  return Response.json({ reason }, { status: 400 });
}

/** GameError → 400 `{reason}` (PLAYER_EXISTS → 409); anything else → 500, no internals. */
export function gameErrorResponse(err: unknown): Response {
  if (err instanceof GameError) {
    return Response.json(
      { reason: err.code },
      { status: err.code === "PLAYER_EXISTS" ? 409 : 400 },
    );
  }
  console.error("[api/game] unexpected error:", err);
  return Response.json({ reason: "INTERNAL" }, { status: 500 });
}

/** Parse a JSON request body; null → caller returns INVALID_BODY. */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
