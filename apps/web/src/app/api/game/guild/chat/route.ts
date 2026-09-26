/**
 * Guild chat — GDD §11.3 vertical slice.
 *
 * GET  ?guild=tower&limit=50   initial message list (oldest -> newest)
 * POST {guild, address, name?, text}   send; the server attaches/validates
 *      the address and rate limits per wallet (5 msgs / minute).
 *
 * Realtime updates arrive through the browser PocketBase SDK subscription
 * (`guild_messages` is publicly listable); this route is the only writer.
 */
import { NextResponse } from "next/server";

import { getPb } from "@/server/pb";
import { rateLimit } from "@/server/guild/rate";

export const dynamic = "force-dynamic";

const GUILD_RE = /^[a-z0-9-]{2,32}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(req: Request) {
  const guild = new URL(req.url).searchParams.get("guild") ?? "tower";
  if (!GUILD_RE.test(guild)) {
    return NextResponse.json({ error: "bad guild slug" }, { status: 400 });
  }
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 50)));

  const pb = await getPb();
  const rows = await pb.collection("guild_messages").getFullList({
    filter: pb.filter("guild = {:guild}", { guild }),
    sort: "-created",
    limit,
  });
  const messages = rows
    .map((r) => ({
      id: r.id,
      guild: String(r.guild),
      address: String(r.address),
      name: String(r.name),
      text: String(r.text),
      created: String(r.created),
    }))
    .reverse(); // oldest first for rendering
  return NextResponse.json({ guild, messages });
}

export async function POST(req: Request) {
  let body: { guild?: string; address?: string; name?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const guild = (body.guild ?? "tower").toLowerCase();
  const address = body.address ?? "";
  const name = (body.name ?? "").trim() || `${address.slice(0, 6)}…${address.slice(-4)}`;
  const text = (body.text ?? "").trim();

  if (!GUILD_RE.test(guild)) return NextResponse.json({ error: "bad guild slug" }, { status: 400 });
  if (!ADDRESS_RE.test(address)) return NextResponse.json({ error: "bad address" }, { status: 400 });
  if (text.length < 1 || text.length > 280) {
    return NextResponse.json({ error: "text must be 1-280 chars" }, { status: 400 });
  }
  if (!rateLimit(`chat:${address.toLowerCase()}`, 5, 60_000)) {
    return NextResponse.json({ error: "rate limit: 5 messages per minute" }, { status: 429 });
  }

  const pb = await getPb();
  const created = await pb.collection("guild_messages").create({
    guild,
    address: address.toLowerCase(),
    name: name.slice(0, 32),
    text,
  });
  return NextResponse.json({
    guild,
    message: {
      id: created.id,
      guild,
      address: String(created.address),
      name: String(created.name),
      text: String(created.text),
      created: String(created.created),
    },
  });
}
