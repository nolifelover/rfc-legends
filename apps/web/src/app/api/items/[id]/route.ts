/**
 * OpenSea-style ERC-1155 metadata for RareItems.uri(): <base>/api/items/{id}.
 * The catalog lives in the game data module (eth-dev2) — imported, never
 * copied. Only ids in the catalog resolve; everything else 404s so wallets
 * and marketplaces never render a bogus card.
 */
import { NextResponse } from "next/server";

import { ITEMS } from "@/game/data/items";
import type { Rarity } from "@/game/types";

export const dynamic = "force-dynamic";

/** GDD §6 drop rates for the mintable rarities (CLAUDE.md: 0.005–0.3%). */
const DROP_RATE: Partial<Record<Rarity, string>> = {
  legendary: "0.3%",
  monster_card: "0.1%",
  mvp_card: "0.005%",
};

/** series derives from the id scheme in interfaces.md §5. */
function seriesOf(id: number): string {
  if (id >= 1000 && id < 2000) return "Monster Card";
  if (id >= 2000 && id < 3000) return "Legendary";
  if (id >= 3000) return "MVP Card";
  return "Field Drop";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "itemId must be numeric" }, { status: 400 });
  }
  const itemId = Number(id);
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item) {
    return NextResponse.json({ error: `unknown itemId ${itemId}` }, { status: 404 });
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rfc-legends.earn.dev.rawinlab.com";
  const dropRate = DROP_RATE[item.rarity];

  const attributes: Record<string, string | number>[] = [
    { trait_type: "rarity", value: item.rarity },
    { trait_type: "series", value: seriesOf(item.id) },
  ];
  if (dropRate) attributes.push({ trait_type: "dropRate", value: dropRate });
  if (item.slot) attributes.push({ trait_type: "slot", value: item.slot });

  return NextResponse.json({
    name: `${item.emoji} ${item.name}`,
    description: item.desc,
    image: `${site}${item.image}`,
    external_url: `${site}/market`,
    attributes,
  });
}
