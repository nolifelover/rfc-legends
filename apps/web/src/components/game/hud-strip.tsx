"use client";

// Bottom HUD strip — compact two-row layout (≤ ~12% of the viewport at
// 1080p) that FLOWS BELOW the scene instead of sticking over it: row A is
// the trainer card + HP/SP/EXP trio, row B is the rooster card + counters
// and pills. All text stays ≥20px for the video. Bars use live engine
// numbers (maxHp/maxSp/expToNext from the pure stats module).

import { getMap } from "@/game/data/maps";
import type { Player } from "@/game/types";
import { expToNext, maxHp, maxSp } from "@/server/game/stats";
import { SireLineArt } from "./sire-line-art";
import { sireLineInfo } from "./sire-lines";
import { RoosterMark } from "./rooster-mark";

/** 1,234,567 → "1.2M" — suffixes keep the compact bars readable. */
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
    ? `${compact(value)}/${compact(max)}`
    : `${value.toLocaleString()}/${max.toLocaleString()}`;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-11 shrink-0 text-xl font-black leading-none tracking-wide text-bark">{label}</span>
      <div
        className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-bark/25 bg-bark/15"
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
        <span className="absolute inset-y-0 left-2.5 flex items-center text-xl font-bold leading-none text-white [text-shadow:0_2px_3px_rgba(0,0,0,0.75)]">
          {curMax}
        </span>
        {showPercent ? (
          <span className="absolute inset-y-0 right-2.5 flex items-center text-xl font-black leading-none text-white [text-shadow:0_2px_3px_rgba(0,0,0,0.85)]">
            {pct.toFixed(1)}%
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

function Pill({
  children,
  href,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  title: string;
  active?: boolean;
}) {
  const cls = `inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-0.5 text-xl font-black leading-tight transition ${
    active
      ? "border-clay/50 bg-sun-soft/80 text-clay-deep hover:bg-sun-soft"
      : "border-bark/20 bg-cream/60 text-bark-soft hover:border-bark/40 hover:text-bark"
  }`
  if (href) {
    return (
      <a href={href} title={title} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  )
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
    // flows below the scene (no sticky): the frame above gets all the space
    // we don't use, and the pests' HP bars stay visible
    <div className="mt-auto w-full border-t-4 border-bark/25 bg-cream/95 shadow-[0_-8px_24px_-12px_rgba(74,50,32,0.4)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col gap-1.5 px-4 py-2 sm:px-6">
        {/* Row A — trainer card + the HP/SP/EXP trio */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 md:grid-cols-[auto_minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-3 md:col-span-1">
            <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-4 border-sun-soft bg-cream">
              <RoosterMark size={30} />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xl font-black text-bark">{player.name}</p>
              <p className="flex items-center gap-1.5 truncate text-xl font-semibold text-bark-soft">
                <span className="rounded-full bg-sun-soft px-2 font-bold text-bark">{jobTag(player.baseLevel)}</span>
                <span>
                  Lv <span className="font-black text-clay">{player.baseLevel}</span>
                </span>
                <span className="truncate" lang="th">
                  · {map.name}
                </span>
              </p>
            </div>
          </div>
          <div className="col-span-2 grid min-w-0 grid-cols-1 gap-1.5 md:col-span-2 md:grid-cols-3 md:gap-3">
            <Bar label="HP" value={hp} max={hp} gradient="bg-gradient-to-r from-field-deep to-field" compactNumbers />
            <Bar label="SP" value={sp} max={sp} gradient="bg-gradient-to-r from-blue-800 to-sky-400" compactNumbers />
            <Bar
              label="EXP"
              value={player.exp}
              max={baseMax}
              gradient="bg-gradient-to-r from-sun to-clay"
              showPercent
              compactNumbers
            />
          </div>
        </div>

        {/* Row B — rooster card + counters + pills */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
          <div className="flex min-w-0 items-center gap-3">
            <SireLineArt line={player.sireLine} size={44} className="shrink-0 rounded-xl ring-2 ring-sun-soft" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xl font-black text-bark">
                {player.rooster.name}{" "}
                <span className="font-semibold text-bark-soft" lang="th">
                  · {info.thai}
                </span>
              </p>
              <p className="truncate text-xl font-semibold text-bark-soft">
                Rooster Lv <span className="font-black text-clay">{player.rooster.level}</span>
              </p>
            </div>
          </div>
          <div className="min-w-0">
            <Bar
              label="EXP"
              value={player.rooster.exp}
              max={expToNext(player.rooster.level)}
              gradient="bg-gradient-to-r from-sun to-clay"
              showPercent
              compactNumbers
            />
          </div>
          <div className="col-span-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 md:col-span-1 md:justify-self-end">
            {/* kills & harvest totals live on the canvas chips — the HUD does
                not repeat them (dedupe); the bag opens without a number badge */}
            {typeof rareDropCount === "number" ? (
              <Pill
                title="Open the Rare Market"
                href={rareDropCount > 0 && newestDropId ? `/market?dropId=${newestDropId}` : "/market"}
                active={rareDropCount > 0}
              >
                ✨ Rare drops ({rareDropCount})
              </Pill>
            ) : null}
            {onOpenBag ? (
              <Pill title={`Bag & drops (${bagCount ?? 0} items)`} onClick={onOpenBag}>
                🎒
              </Pill>
            ) : null}
            {onOpenGuild ? (
              <Pill title="Guild chat & boss" onClick={onOpenGuild}>
                🛡 Guild
              </Pill>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
