"use client";

// Stat allocation panel — GDD §2.2. One + button per stat, spending one point
// incrementally per click; cost for the next point follows the engine's curve.
// Updates optimistically from the allocate response.

import { useState } from "react";
import type { Player, StatKey } from "@/game/types";
import { STAT_CAP, statUpgradeCost } from "@/server/game/stats";
import { reasonText } from "./api-messages";

interface StatMeta {
  key: StatKey;
  label: string;
  /** One-line effect tooltip (GDD §2.2). */
  effect: string;
}

const STATS: StatMeta[] = [
  { key: "str", label: "STR", effect: "ATK +2 per point; carry weight" },
  { key: "agi", label: "AGI", effect: "FLEE +1; attack speed (ASPD)" },
  { key: "vit", label: "VIT", effect: "Max HP +10, DEF +1; status resist" },
  { key: "int", label: "INT", effect: "Max SP +4; skill power and cooldowns" },
  { key: "dex", label: "DEX", effect: "HIT +1, ATK +0.2; faster casting" },
  { key: "luk", label: "LUK", effect: "CRIT +0.3%; drop rate +0.1%" },
];

export interface AllocateResult {
  ok: boolean;
  reason?: string;
}

export function StatPanel({
  player,
  onAllocate,
}: {
  player: Player;
  onAllocate: (stat: StatKey) => Promise<AllocateResult>;
}) {
  // Collapsed by default: the game screen stays scene-first; the allocation
  // UI opens as an overlay drawer (same pattern as the bag).
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<StatKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function spend(stat: StatKey) {
    setPending(stat);
    setError(null);
    const res = await onAllocate(stat);
    if (!res.ok) setError(res.reason ?? "FAILED");
    setPending(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-black shadow-sm transition ${
          player.statPoints > 0
            ? "animate-pulse border-clay bg-sun-soft/80 text-clay-deep hover:bg-sun-soft hover:animate-none"
            : "border-clay/40 bg-cream text-clay-deep hover:border-clay hover:bg-sun-soft/50"
        }`}
      >
        <span aria-hidden>✦</span>
        {player.statPoints > 0
          ? `${player.statPoints.toLocaleString()} points to spend`
          : `Stat points: ${player.statPoints.toLocaleString()}`}
        <span aria-hidden className="text-bark-soft">
          ▸
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close stat allocation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-bark/45 backdrop-blur-sm"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Stat allocation"
            className="relative max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-clay/25 bg-cream shadow-[0_24px_64px_-16px_rgba(43,27,18,0.6)]"
          >
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-clay/15 bg-cream/95 px-4 py-3 backdrop-blur sm:px-5">
            <span className="flex items-center gap-3">
              <span className="text-sm font-black uppercase tracking-wide text-bark">
                Spend stat points
              </span>
              {player.statPoints > 0 ? (
                <span className="rounded-full bg-sun px-2.5 py-0.5 text-sm font-black text-bark">
                  {player.statPoints} left
                </span>
              ) : (
                <span className="text-xs font-semibold text-bark-soft">all spent — level up for more</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-full border border-bark/20 text-bark-soft transition hover:bg-sun-soft/60"
            >
              ✕
            </button>
          </div>

          <div className="px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-3xl font-black leading-none text-clay">
              {player.statPoints}
            </span>
            <span className="text-sm font-semibold text-bark-soft">
              stat points remaining — costs rise as a stat grows (GDD §2.2)
            </span>
          </div>

          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {STATS.map((stat) => {
              const value = player.stats[stat.key];
              const cost = statUpgradeCost(value);
              const capped = value >= STAT_CAP;
              const unaffordable = cost > player.statPoints;
              const disabled = capped || unaffordable || pending !== null;
              return (
                <li
                  key={stat.key}
                  className="flex items-center gap-3 rounded-xl border border-clay/20 bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-bark">
                      {stat.label}
                      <span className="ml-2 text-lg font-black text-clay">{value}</span>
                      {capped ? (
                        <span className="ml-2 text-[11px] font-bold text-bark-soft">MAX</span>
                      ) : (
                        <span className="ml-2 text-[11px] font-semibold text-bark-soft">
                          next: {cost} pt{cost > 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-[11px] text-bark-soft" title={stat.effect}>
                      {stat.effect}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => spend(stat.key)}
                    disabled={disabled}
                    aria-label={`Raise ${stat.label} from ${value} for ${cost} points`}
                    title={
                      capped
                        ? `Capped at ${STAT_CAP}`
                        : unaffordable
                          ? `Needs ${cost} points`
                          : `+1 ${stat.label} for ${cost} points`
                    }
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-field text-lg font-black text-cream shadow-sm transition hover:bg-field-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-field disabled:cursor-not-allowed disabled:bg-bark/20 disabled:text-bark-soft"
                  >
                    {pending === stat.key ? "…" : "+"}
                  </button>
                </li>
              );
            })}
          </ul>

          {error ? (
            <p role="alert" className="mt-3 rounded-xl bg-clay/10 px-3 py-2 text-sm font-bold text-clay-deep">
              {reasonText(error)}
            </p>
          ) : null}
          </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
