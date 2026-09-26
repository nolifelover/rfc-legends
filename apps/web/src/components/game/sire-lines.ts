// Sire-line display data — GDD §3.2 (personalities, stat bias, signature skills).
// Client-safe: presentation only; the engine owns gameplay values.

import type { SireLine } from "@/game/types";

export interface SireLineInfo {
  id: SireLine;
  roman: string;
  thai: string;
  /** One-line personality (GDD §3.2), English-first. */
  personality: string;
  /** Stat bias chip, e.g. "TEC++ · SPD+". */
  bias: string;
  skill: { roman: string; thai: string; effect: string };
  /** Fallback badge colors while/when the sprite is missing. */
  badge: string;
  ring: string;
}

export const SIRE_LINES: SireLineInfo[] = [
  {
    id: "kumarnjeen",
    roman: "Kumarnjeen",
    thai: "กุมารจีน",
    personality: "Sharp and clever — reads the fight like an open book.",
    bias: "TEC++ · SPD+",
    skill: {
      roman: "Keen Flurry",
      thai: "เชิงคมกริบ",
      effect: "3-hit flurry; the last hit always crits",
    },
    badge: "bg-slate-300 text-slate-900",
    ring: "border-slate-500",
  },
  {
    id: "kingkong",
    roman: "Kingkong",
    thai: "คิงคอง",
    personality: "Big-framed and balanced — a wall in feather form.",
    bias: "POW++ · STA+",
    skill: {
      roman: "Giant Body",
      thai: "ร่างยักษ์",
      effect: "Takes 50% of the trainer's damage for 10s",
    },
    badge: "bg-zinc-800 text-orange-200",
    ring: "border-clay",
  },
  {
    id: "chaokhunthong",
    roman: "Chaokhunthong",
    thai: "เจ้าขุนทอง",
    personality: "Graceful and stately — born for the arena spotlight.",
    bias: "All-round · SPR+",
    skill: {
      roman: "Golden Grace",
      thai: "ลีลาทอง",
      effect: "Party ATK/FLEE +10%",
    },
    badge: "bg-amber-300 text-amber-950",
    ring: "border-amber-600",
  },
  {
    id: "thepbut",
    roman: "Thepbut",
    thai: "เทพบุตร",
    personality: "Sturdy, never backs down — stands guard to the end.",
    bias: "STA++ · SPR++",
    skill: {
      roman: "Iron Heart",
      thai: "ใจเหล็ก",
      effect: "Survives one lethal hit per battle at 1 HP",
    },
    badge: "bg-orange-100 text-red-800",
    ring: "border-red-400",
  },
  {
    id: "raptor",
    roman: "Raptor",
    thai: "แร๊พเตอร์",
    personality: "Bold and fast — strikes before the foe blinks.",
    bias: "SPD++ · TEC+",
    skill: {
      roman: "Hawk Dash",
      thai: "เชิงพญาเหยี่ยว",
      effect: "Dash strike at 250%, hits the back row",
    },
    badge: "bg-emerald-700 text-emerald-50",
    ring: "border-emerald-950",
  },
];

export function sireLineInfo(id: SireLine): SireLineInfo {
  return SIRE_LINES.find((line) => line.id === id) ?? SIRE_LINES[0];
}
