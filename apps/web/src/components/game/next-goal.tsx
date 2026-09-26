"use client";

// Thin next-goal ribbon above the HUD (research #15). Derived from real
// engine state only: the World ID mint gate (Base Lv 30), the MVP cadence
// (every mvpEveryKills kills, demo or normal), and the rooster stat-point
// bumps (statPointsForLevel grows at levels ≡ 1 mod 5).

import { DEMO_MVP_EVERY_KILLS, MVP_EVERY_KILLS } from "@/server/game/combat";
import { statPointsForLevel } from "@/server/game/stats";
import type { Player } from "@/game/types";

/** Next rooster level where each level's stat grant increases (≡ 1 mod 5). */
function nextRoosterStatLevel(level: number): number {
  return Math.floor(level / 5) * 5 + 6;
}

export function nextGoalLine(player: Player, demoMode: boolean): string {
  if (player.baseLevel < 30) {
    return `Next: Base Lv 30 → unlock minting rare drops (${30 - player.baseLevel} to go)`;
  }
  const every = demoMode ? DEMO_MVP_EVERY_KILLS : MVP_EVERY_KILLS;
  const untilBoss = every - (player.killCount % every);
  if (untilBoss <= 30) {
    return `Boss in ${untilBoss} kill${untilBoss === 1 ? "" : "s"} — stay ready`;
  }
  const rLv = nextRoosterStatLevel(player.rooster.level);
  void statPointsForLevel; // rule reference: points/level = 3 + floor((Lv-1)/5)
  return `Rooster Lv ${rLv} → +stat per level`;
}

export function NextGoalRibbon({ player, demoMode }: { player: Player; demoMode: boolean }) {
  return (
    <p
      className="mx-auto w-full max-w-[1700px] px-4 text-center text-xl font-bold text-bark-soft sm:px-6"
      aria-live="polite"
    >
      <span className="rounded-full bg-sun-soft/50 px-4 py-0.5">{nextGoalLine(player, demoMode)}</span>
    </p>
  );
}
