/**
 * Guild boss — GDD §11.3 vertical slice.
 * GET ?guild=tower  current boss state (spawns floor 1 on first contact).
 */
import { NextResponse } from "next/server";

import { getBoss } from "@/server/guild/boss";

export const dynamic = "force-dynamic";

const GUILD_RE = /^[a-z0-9-]{2,32}$/;

export async function GET(req: Request) {
  const guild = (new URL(req.url).searchParams.get("guild") ?? "tower").toLowerCase();
  if (!GUILD_RE.test(guild)) {
    return NextResponse.json({ error: "bad guild slug" }, { status: 400 });
  }
  const boss = await getBoss(guild);
  const contributors = Object.entries(boss.contributors)
    .map(([address, c]) => ({ address, ...c }))
    .sort((a, b) => b.damage - a.damage)
    .slice(0, 10);
  return NextResponse.json({ guild, boss: { ...boss, contributors } });
}
