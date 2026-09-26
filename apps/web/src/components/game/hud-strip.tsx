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
import { GameChromeIcon } from "./game-chrome-icon";

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
  wideValueOnly = false,
}: {
  label: string;
  value: number;
  max: number;
  gradient: string;
  showPercent?: boolean;
  compactNumbers?: boolean;
  wideValueOnly?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const curMax = compactNumbers
    ? `${compact(value)}/${compact(max)}`
    : `${value.toLocaleString()}/${max.toLocaleString()}`;

  // Full bars collapse to a slim "label ● n/n" pip: they cannot move, so
  // they stop taking the widest slots (critic r5 #1); damage re-expands them.
  if (value >= max) {
    return (
      <span className="inline-flex max-w-full shrink-0 items-center gap-1.5 truncate rounded-full border-2 border-sun/60 bg-[#1d130c]/70 px-2.5 py-0.5 text-base font-bold leading-none text-cream/85 md:text-xl">
        <span className="shrink-0">{label}</span>
        <span aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "currentColor" }} />
        <span className="truncate">{compact(value)}</span>
      </span>
    )
  }

  return (
    <div className={`flex min-w-0 flex-1 items-center ${wideValueOnly ? "gap-1.5" : "gap-2"}`}>
      <span className={`shrink-0 font-black leading-none tracking-wide text-cream ${wideValueOnly ? "w-8 text-sm md:text-base" : "w-9 text-lg md:w-11 md:text-xl"}`}>{label}</span>
      <div
        className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-full border-2 border-bark/30 bg-bark/50"
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
        <span className={`absolute inset-y-0 hidden items-center font-bold leading-none text-white [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.85)] ${wideValueOnly ? "left-2 text-[11px] md:flex xl:text-xs" : showPercent ? "left-2.5 text-sm md:flex" : "left-2.5 text-xl md:flex"}`}>
          {curMax}
        </span>
        {/* mobile: % only — a raw value beside the % overlapped it in
            narrow rows (worst case: high-level rooster EXP at 390px) */}

        {showPercent ? (
          <span className="absolute inset-y-0 right-2 flex items-center text-sm font-black leading-none text-white [text-shadow:0_1px_0_rgba(0,0,0,0.9),0_0_4px_rgba(0,0,0,0.85)] md:right-2.5">
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
  const cls = `inline-flex min-h-11 w-fit items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3 py-1.5 text-lg font-black leading-tight transition md:text-xl lg:min-h-0 lg:py-0.5 ${
    active
      ? "border-sun bg-sun/25 text-sun-soft hover:bg-sun/35"
      : "border-sun/50 bg-[#1d130c]/70 text-cream/85 hover:border-sun hover:text-cream"
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
  statCta,
  syncSlot,
  goal,
}: {
  player: Player;
  rareDropCount?: number;
  bagCount?: number;
  newestDropId?: string;
  onOpenBag?: () => void;
  onOpenGuild?: () => void;
  /** docked slots so nothing floats in the margins (critic r3) */
  statCta?: React.ReactNode;
  syncSlot?: React.ReactNode;
  goal?: React.ReactNode;
}) {
  const info = sireLineInfo(player.sireLine);
  const hp = maxHp(player);
  const sp = maxSp(player);
  const baseMax = expToNext(player.baseLevel);
  const map = getMap(player.mapId);

  return (
    // flows below the scene (no sticky): the frame above gets all the space
    // we don't use, and the pests' HP bars stay visible
    <div className="mt-auto w-full px-1 pb-1 sm:px-1.5 sm:pb-1.5">
      {/* mobile-landscape gate (M5): Tailwind variant generation for stacked
          orientation variants is unreliable under this Turbopack setup, so a
          scoped <style> with a real media query drives it. Desktop untouched. */}
      <style>{`@media (max-width: 1023px) and (orientation: landscape) {
  [data-mobscape='band'] { display: none; }
  [data-mobscape='strip'] { display: flex; }
  [data-mobscape='roosterexp'] { display: none; }
}`}</style>
      {/* mobile-landscape compact strip (M5/G2): one <=72px row - avatar+lvl,
          HP/SP/EXP minis, icon pills. The full band below renders only outside it. */}
      <div data-mobscape="strip" className="hidden items-center gap-2 rounded-2xl border-4 border-sun/70 bg-[#2b1b12]/95 px-2 py-1 text-cream shadow-[0_10px_36px_-10px_rgba(0,0,0,0.7)] backdrop-blur">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-sun-soft bg-cream">
          <RoosterMark size={24} riverside />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-bark/40 bg-sun px-1 text-xs font-black leading-tight text-bark">
            {player.baseLevel}
          </span>
          {player.statPoints > 0 ? (
            <span title={`${player.statPoints.toLocaleString()} stat points`} className="absolute -right-1.5 -top-1 grid min-w-5 place-items-center rounded-full border border-cream bg-red-600 px-0.5 text-xs font-black text-cream">
              &#10022;
            </span>
          ) : null}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <Bar label="HP" value={hp} max={hp} gradient="bg-gradient-to-r from-field-deep to-field" compactNumbers />
            <Bar label="SP" value={sp} max={sp} gradient="bg-gradient-to-r from-blue-800 to-sky-400" compactNumbers />
          </div>
          <Bar label="EXP" value={player.exp} max={baseMax} gradient="bg-gradient-to-r from-sun to-clay" showPercent compactNumbers />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {typeof rareDropCount === "number" && rareDropCount > 0 ? (
            <Pill title="Open the Rare Market" href={rareDropCount > 0 && newestDropId ? `/market?dropId=${newestDropId}` : "/market"} active={rareDropCount > 0}>
              <GameChromeIcon name="sparkle" className="h-4 w-4" />{rareDropCount}
            </Pill>
          ) : null}
          {onOpenBag ? <Pill title={`Bag & drops (${bagCount ?? 0} items)`} onClick={onOpenBag}><GameChromeIcon name="bag" className="h-4 w-4" /></Pill> : null}
          {onOpenGuild ? <Pill title="Guild chat & boss" onClick={onOpenGuild}><GameChromeIcon name="guild" className="h-4 w-4" /></Pill> : null}
          {syncSlot}
        </div>
      </div>
      {/* a game panel in the canvas' thick-outline style, docked flush under
          the scene rather than a full-width web strip */}
      <div className="mx-auto flex w-full max-w-none flex-col gap-1 rounded-2xl border-4 border-sun/70 bg-[#2b1b12]/95 px-2.5 py-1.5 max-lg:landscape:hidden text-cream shadow-[0_10px_36px_-10px_rgba(0,0,0,0.7)] backdrop-blur sm:px-4 md:gap-1.5 md:py-2">
        {/* Row A — trainer card + the HP/SP/EXP trio */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1 md:grid-cols-[auto_minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 items-center gap-3 md:col-span-1">
            <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full border-4 border-sun-soft bg-cream">
              <RoosterMark size={30} riverside />
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-bark/40 bg-sun px-1.5 text-sm font-black leading-tight text-bark">
                {player.baseLevel}
              </span>
              {player.statPoints > 0 ? (
                <span
                  title={`${player.statPoints.toLocaleString()} stat points to spend`}
                  className="absolute -right-2 -top-1.5 z-10 grid min-w-7 place-items-center rounded-full border-2 border-cream bg-red-600 px-1 text-sm font-black leading-tight text-cream shadow-[0_2px_0_rgba(0,0,0,0.5)] animate-pulse"
                >
                  {player.statPoints > 999 ? `${Math.floor(player.statPoints / 100) / 10}k` : player.statPoints}
                </span>
              ) : null}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-lg font-black text-cream md:text-xl">{player.name}</p>
              <p className="flex items-center gap-1.5 truncate text-base font-semibold text-cream/75 md:text-xl">
                <span className="rounded-full bg-sun px-2 font-black text-[#2b1b12]">{jobTag(player.baseLevel)}</span>
                <span className="truncate" lang="th">
                  {map.name}
                </span>
              </p>
            </div>
          </div>
          <div className="col-span-2 grid min-w-0 grid-cols-2 gap-1.5 md:flex md:flex-wrap md:items-center md:gap-3">
            <Bar label="HP" value={hp} max={hp} gradient="bg-gradient-to-r from-field-deep to-field" compactNumbers />
            <Bar label="SP" value={sp} max={sp} gradient="bg-gradient-to-r from-blue-800 to-sky-400" compactNumbers />
            <div className="col-span-2 md:contents">
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
        </div>

        {/* Row B — rooster card + counters + pills */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
          <div className="flex min-w-0 items-center gap-3">
            <SireLineArt line={player.sireLine} size={44} className="shrink-0 rounded-xl ring-2 ring-sun-soft" theme="riverside" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-lg font-black text-cream md:text-xl">
                {player.rooster.name}{" "}
                <span className="font-semibold text-cream/70" lang="th">
                  · {info.thai}
                </span>
              </p>
              <p className="truncate text-base text-cream/60 md:text-xl">
                Rooster Lv <span className="font-black text-cream/85">{player.rooster.level}</span>
              </p>
            </div>
          </div>
          <div className="min-w-0 lg:min-w-[196px] xl:min-w-[220px]" data-mobscape="roosterexp">
            <Bar
              label="EXP"
              value={player.rooster.exp}
              max={expToNext(player.rooster.level)}
              gradient="bg-gradient-to-r from-sun to-clay"
              showPercent
              compactNumbers
              wideValueOnly
            />
          </div>
          <div className="col-span-3 flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5 md:col-span-1 md:justify-self-end">
            {/* kills & harvest totals live on the canvas chips — the HUD does
                not repeat them (dedupe); the bag opens without a number badge */}
            {goal ? <span className="line-clamp-1 text-base font-bold text-cream/70 md:text-xl">{goal}</span> : null}
            {statCta}
            {typeof rareDropCount === "number" && rareDropCount > 0 ? (
              <Pill
                title="Open the Rare Market"
                href={rareDropCount > 0 && newestDropId ? `/market?dropId=${newestDropId}` : "/market"}
                active={rareDropCount > 0}
              >
                <GameChromeIcon name="sparkle" className="h-4 w-4" /> Rare drops ({rareDropCount})
              </Pill>
            ) : null}
            {onOpenBag ? (
              <Pill title={`Bag & drops (${bagCount ?? 0} items)`} onClick={onOpenBag}>
                <GameChromeIcon name="bag" className="h-5 w-5" />
              </Pill>
            ) : null}
            {onOpenGuild ? (
              <Pill title="Guild chat & boss" onClick={onOpenGuild}>
                <GameChromeIcon name="guild" className="h-5 w-5" /> Guild
              </Pill>
            ) : null}
            {syncSlot}
          </div>
        </div>
      </div>
    </div>
  );
}
