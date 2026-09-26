"use client";

// "While you were away" summary (research #10). Shown only when a sync
// settles ≥60s of absence, using ONLY the server's real aggregate numbers.
// Collect closes the card and refreshes the game-state query — the newly
// persisted drops then arrive through the normal poll, which fires the drop
// celebration FX (jackpot moment for cards).

import { useEffect } from "react";

export interface WelcomeBackSummary {
  /** total settled seconds (live window + offline settlement) */
  seconds: number
  expGained: number
  roosterExpGained: number
  baseLevelsGained: number
  roosterLevelsGained: number
  kills: number
  drops: number
}

function mins(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60}m`;
}

export function WelcomeBack({
  summary,
  onCollect,
}: {
  summary: WelcomeBackSummary;
  onCollect: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" || e.key === "Enter") onCollect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCollect]);

  const rows: [string, string][] = [
    ["EXP gained", `+${summary.expGained.toLocaleString()}`],
    ...(summary.baseLevelsGained > 0
      ? [["Base levels", `+${summary.baseLevelsGained}`] as [string, string]]
      : []),
    ...(summary.roosterExpGained > 0
      ? [["Rooster EXP", `+${summary.roosterExpGained.toLocaleString()}`] as [string, string]]
      : []),
    ...(summary.roosterLevelsGained > 0
      ? [["Rooster levels", `+${summary.roosterLevelsGained}`] as [string, string]]
      : []),
    ["Pests defeated", summary.kills.toLocaleString()],
    ...(summary.drops > 0
      ? [["Rare drops", `${summary.drops} (check your bag)`] as [string, string]]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Collect"
        onClick={onCollect}
        className="absolute inset-0 cursor-default bg-bark/45 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label="While you were away"
        className="relative w-full max-w-md rounded-2xl border-4 border-sun-soft bg-cream p-6 shadow-[0_24px_64px_-16px_rgba(43,27,18,0.6)]"
        style={{ animation: "rfcl-wb-in 260ms ease-out" }}
      >
        <style>{`@keyframes rfcl-wb-in { from { transform: translateY(14px) scale(.96); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-clay-deep">Welcome back</p>
        <h2 className="mt-1 text-2xl font-black text-bark">While you were away ({mins(summary.seconds)})</h2>
        <dl className="mt-4 divide-y divide-clay/15">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2">
              <dt className="text-sm font-bold text-bark-soft">{k}</dt>
              <dd className="text-lg font-black text-bark">{v}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={onCollect}
          className="mt-5 w-full rounded-full border-2 border-clay/50 bg-sun-soft px-4 py-3 text-xl font-black text-clay-deep transition hover:bg-sun"
        >
          Collect
        </button>
      </section>
    </div>
  );
}
