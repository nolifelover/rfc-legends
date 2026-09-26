"use client";

// Bottom HUD strip — classic 2D MMO layout, exactly three zones:
// trainer card · HP/SP/Base-EXP bars · rooster card + kill/drop counters.
// Bars use live engine numbers (maxHp/maxSp/expToNext from the pure stats module).

import { getMap } from "@/game/data/maps";
import type { Player } from "@/game/types";
import { expToNext, maxHp, maxSp } from "@/server/game/stats";
import { SireLineArt } from "./sire-line-art";
import { sireLineInfo } from "./sire-lines";

function Bar({
  label,
  value,
  max,
  gradient,
  showPercent = false,
}: {
  label: string;
  value: number;
  max: number;
  gradient: string;
  showPercent?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  const text = showPercent
    ? `${value.toLocaleString()} / ${max.toLocaleString()} (${pct.toFixed(1)}%)`
    : `${value.toLocaleString()} / ${max.toLocaleString()}`;

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-xs font-black tracking-wide text-bark">{label}</span>
      <div
        className="relative h-5 min-w-0 flex-1 overflow-hidden rounded-full border border-bark/25 bg-bark/15"
        role="meter"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${label}: ${text}`}
      >
        <div
          className={`h-full rounded-full ${gradient} transition-[width] duration-500`}
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
          {text}
        </span>
      </div>
    </div>
  );
}

export function HudStrip({ player }: { player: Player }) {
  const info = sireLineInfo(player.sireLine);
  const hp = maxHp(player);
  const sp = maxSp(player);
  const baseMax = expToNext(player.baseLevel);
  const map = getMap(player.mapId);

  return (
    <div className="mt-auto w-full border-t-2 border-bark/25 bg-cream/95 shadow-[0_-8px_24px_-12px_rgba(74,50,32,0.4)] backdrop-blur">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(190px,1fr)_2.2fr_minmax(240px,1.1fr)] items-center gap-4 px-4 py-2.5 sm:px-6">
        {/* Zone 1 — trainer */}
        <div className="min-w-0">
          <p className="truncate text-base font-black leading-tight text-bark">{player.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-bark-soft">
            <span className="rounded-full bg-sun-soft px-2 py-0.5 font-bold text-bark">Novice</span>
            <span>
              Base Lv <span className="font-black text-clay">{player.baseLevel}</span> · Job Lv{" "}
              <span className="font-black text-clay">{player.jobLevel}</span>
            </span>
          </p>
          <p className="mt-0.5 truncate text-xs text-bark-soft">
            <span lang="th">{map.name}</span>
          </p>
        </div>

        {/* Zone 2 — HP / SP / Base EXP */}
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
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

        {/* Zone 3 — rooster + counters */}
        <div className="flex min-w-0 items-center gap-3">
          <SireLineArt line={player.sireLine} size={56} className="rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black leading-tight text-bark">
              {player.rooster.name}{" "}
              <span className="font-semibold text-bark-soft">
                · <span lang="th">{info.thai}</span>
              </span>
            </p>
            <p className="text-xs font-semibold text-bark-soft">
              Rooster Lv <span className="font-black text-clay">{player.rooster.level}</span>
            </p>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-bark/15"
              role="meter"
              aria-label="Rooster EXP"
              aria-valuenow={player.rooster.exp}
              aria-valuemin={0}
              aria-valuemax={expToNext(player.rooster.level)}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-sun to-clay"
                style={{
                  width: `${Math.min(100, (player.rooster.exp / expToNext(player.rooster.level)) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-1 flex items-center gap-3 text-xs font-bold text-bark-soft">
              <span title="Monsters defeated">⚔ {player.killCount.toLocaleString()}</span>
              <span title="Rare drops found">✨ {player.dropCounter.toLocaleString()}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
