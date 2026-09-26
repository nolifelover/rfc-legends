/**
 * Guild boss — GDD §11.3 vertical slice.
 * POST {guild, address, name?, damage}  members' idle damage chips the boss
 * down. Damage is clamped server-side (1-99); a kill records the reward tier
 * by damage share and spawns the next floor. 12 hits / minute per wallet.
 */
import { NextResponse } from "next/server";

import { hitBoss } from "@/server/guild/boss";
import { rateLimit } from "@/server/guild/rate";

export const dynamic = "force-dynamic";

const GUILD_RE = /^[a-z0-9-]{2,32}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function POST(req: Request) {
  let body: { guild?: string; address?: string; name?: string; damage?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const guild = (body.guild ?? "tower").toLowerCase();
  const address = body.address ?? "";
  const name = (body.name ?? "").trim() || `${address.slice(0, 6)}…${address.slice(-4)}`;
  const damage = Number(body.damage ?? 0);

  if (!GUILD_RE.test(guild)) return NextResponse.json({ error: "bad guild slug" }, { status: 400 });
  if (!ADDRESS_RE.test(address)) return NextResponse.json({ error: "bad address" }, { status: 400 });
  if (!Number.isFinite(damage)) {
    return NextResponse.json({ error: "damage must be a number" }, { status: 400 });
  }
  if (!rateLimit(`boss:${address.toLowerCase()}`, 12, 60_000)) {
    return NextResponse.json({ error: "rate limit: 12 strikes per minute" }, { status: 429 });
  }

  const result = await hitBoss(guild, address.toLowerCase(), name.slice(0, 32), damage);
  return NextResponse.json(result);
}
