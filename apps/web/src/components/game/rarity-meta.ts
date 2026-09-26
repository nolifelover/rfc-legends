// Shared rarity presentation (English label + hex colors) for the drop toast,
// jackpot overlay and inventory drawer. Kept UI-only, no engine imports.

import type { Rarity } from "@/game/types";

export const RARITY_META: Record<Rarity, { label: string; hex: string }> = {
  legendary: { label: "Legendary", hex: "#b45309" },
  monster_card: { label: "Monster Card", hex: "#7c3aed" },
  mvp_card: { label: "MVP Card", hex: "#dc2626" },
  common: { label: "Common", hex: "#8a9a5b" },
  rare: { label: "Rare", hex: "#3b82c4" },
  epic: { label: "Epic", hex: "#8b5cf6" },
};

/** Jackpot treatment is reserved for the card rarities. */
export function isJackpotRarity(rarity: Rarity): boolean {
  return rarity === "mvp_card" || rarity === "monster_card";
}
