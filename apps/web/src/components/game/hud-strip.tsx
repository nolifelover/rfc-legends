"use client";

// Bottom HUD strip — classic 2D MMO layout, exactly three zones:
// trainer portrait card · HP/SP/EXP bars · rooster portrait + counters.
// Bars use live engine numbers (maxHp/maxSp/expToNext from the pure stats
// module). All text ≥20px at 1080p so the video reads cleanly.

import { getMap } from "@/game/data/maps";
import type { Player } from "@/game/types";
import { expToNext, maxHp, maxSp } from "@/server/game/stats";
import { SireLineArt } from "./sire-line-art";
import { sireLineInfo } from "./sire-lines";
import { RoosterMark } from "./rooster-mark";

/** 1,234,567 → "1.2M" — suffixes keep the bigger bars readable. */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function Bar({
  label,
  value,
  max,
  gradient,
  showPercent = false,
  compactNumbers = false,
}: {
  label: string;
  value: number;
  max: number;
  gradient: string;
  showPercent?: boolean;
  compactNumbers?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const curMax = compactNumbers
    ? `${compact(value)} / ${compact(max)}`
    : `${value.toLocaleString()} / ${max.toLocaleString()}`;

  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xl font-black tracking-wide text-bark">{label}</span>
      <div
        className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-bark/25 bg-bark/15"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${curMax}${showPercent ? ` (${pct.toFixed(1)}%)` : ""}`}
      >
        <div
          className={`h-full rounded-full ${gradient} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-y-0 left-3 flex items-center text-xl font-bold text-white [text-shadow:0_2px_3px_rgba(0,0,0,0.75)]">
          {curMax}
        </span>
        {showPercent ? (
          <span className="absolute inset-y-0 right-3 flex items-center text-xl font-black text-white [text-shadow:0_2px_3px_rgba(0,0,0,0.85)]">
            ({pct.toFixed(1)}%)
          </span>
        ) : null}
      </div>
    </div>
  );
}

function jobTag(baseLevel: number): string {
  if (baseLevel >= 60) return "Master Trainer";
  if (baseLevel >= 30) return "Veteran";
  if (baseLevel >= 10) return "Adventurer";
  return "Novice";
}

export function HudStrip({
  player,
  rareDropCount,
  bagCount,
  newestDropId,
  onOpenBag,
  onOpenGuild,
}: {
  player: Player;
  rareDropCount?: number;
  bagCount?: number;
  newestDropId?: string;
  onOpenBag?: () => void;
  onOpenGuild?: () => void;
}) {
  const info = sireLineInfo(player.sireLine);
  const hp = maxHp(player);
  const sp = maxSp(player);
  const baseMax = expToNext(player.baseLevel);
  const map = getMap(player.mapId);

  return (
    <div className="sticky bottom-0 z-40 mt-auto w-full border-t-4 border-bark/25 bg-cream/95 shadow-[0_-8px_24px_-12px_rgba(74,50,32,0.4)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 md:grid md:grid-cols-[minmax(240px,1.1fr)_2fr_minmax(320px,1.3fr)] md:items-center md:gap-6">
        {/* Zone 1 — trainer portrait card */}
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-sun-soft bg-cream shadow-inner">
            <RoosterMark size={38} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-2xl font-black leading-tight text-bark">{player.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-semibold text-bark-soft">
              <span className="rounded-full bg-sun-soft px-2.5 py-0.5 font-bold text-bark">
                {jobTag(player.baseLevel)}
              </span>
              <span>
                Base Lv <span className="font-black text-clay">{player.baseLevel}</span>
              </span>
            </p>
            <p className="mt-0.5 truncate text-xl text-bark-soft">
              <span lang="th">{map.name}</span>
            </p>
          </div>
        </div>

        {/* Zone 2 — HP / SP / Base EXP */}
        <div className="flex min-w-0 flex-col justify-center gap-2">
          <Bar label="HP" value={hp} max={hp} gradient="bg-gradient-to-r from-field-deep to-field" />
          <Bar label="SP" value={sp} max={sp} gradient="bg-gradient-to-r from-blue-800 to-sky-400" />
          <Bar
            label="EXP"
            value={player.exp}
            max={baseMax}
            gradient="bg-gradient-to-r from-sun to-clay"
            showPercent
          />
        </div>

        {/* Zone 3 — rooster portrait + counters */}
        <div className="flex min-w-0 items-center gap-3">
          <SireLineArt line={player.sireLine} size={72} className="shrink-0 rounded-2xl ring-4 ring-sun-soft" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-black leading-tight text-bark">
              {player.rooster.name}{" "}
              <span className="text-xl font-semibold text-bark-soft">
                · <span lang="th">{info.thai}</span>
              </span>
            </p>
            <p className="text-xl font-semibold text-bark-soft">
              Rooster Lv <span className="font-black text-clay">{player.rooster.level}</span>
            </p>
            <div className="mt-1">
              <Bar
                label="EXP"
                value={player.rooster.exp}
                max={expToNext(player.rooster.level)}
                gradient="bg-gradient-to-r from-sun to-clay"
                showPercent
                compactNumbers
              />
            </div>
            <p className="mt-1 flex items-center gap-3 text-xl font-bold text-bark-soft">
              <span title="Monsters defeated">Defeated {player.killCount.toLocaleString()}</span>
              <span aria-hidden>·</span>
              <span title="Items in the bag (grows as you defeat monsters)">
                Bag {(bagCount ?? 0).toLocaleString()}
              </span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {typeof rareDropCount === "number" ? (
                <a
                  href={rareDropDropHref(rareDropCount, newestDropId)}
                  title="Open the Rare Market"
                  className={`inline-flex w-fit items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xl font-black transition ${
                    rareDropCount > 0
                      ? "border-clay/50 bg-sun-soft/80 text-clay-deep hover:bg-sun-soft"
                      : "border-bark/20 bg-cream/60 text-bark-soft"
                  }`}
                >
                  ✨ Rare drops ({rareDropCount})
                </a>
              ) : null}
              {onOpenBag ? (
                <button
                  type="button"
                  onClick={onOpenBag}
                  aria-label={`Open bag and drops (${bagCount ?? 0} items)`}
                  title="Bag & drops"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-bark/20 bg-cream/60 px-3 py-1 text-xl font-black text-bark-soft transition hover:border-bark/40 hover:text-bark"
                >
                  🎒 {bagCount ?? 0}
                </button>
              ) : null}
              {onOpenGuild ? (
                <button
                  type="button"
                  onClick={onOpenGuild}
                  aria-label="Open guild panel"
                  title="Guild chat & boss"
                  className="inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-bark/20 bg-cream/60 px-3 py-1 text-xl font-black text-bark-soft transition hover:border-bark/40 hover:text-bark"
                >
                  🛡 Guild
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function rareDropDropHref(count: number, newestDropId?: string): string {
  return count > 0 && newestDropId ? `/market?dropId=${newestDropId}` : "/market";
}
