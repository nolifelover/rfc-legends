"use client";

// Right-side dock that mounts eth-dev2's self-contained GuildPanel
// (chat + guild boss). Lazy-loads the panel (and its PocketBase SDK) only
// when opened, and scrolls independently over the scene.

import { useMemo } from "react";
import nextDynamic from "next/dynamic";
import { GameChromeIcon } from "./game-chrome-icon";

const GuildPanel = nextDynamic(() => import("@/components/guild/GuildPanel").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <p className="p-4 text-sm font-semibold text-bark-soft">Opening the guild hall…</p>
  ),
});

export function GuildDock({
  open,
  onClose,
  address,
  name,
}: {
  open: boolean;
  onClose: () => void;
  address: `0x${string}`;
  name?: string;
}) {
  const panel = useMemo(
    () => <GuildPanel address={address} name={name} guild="tower" />,
    [address, name],
  );
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close guild panel"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bark/40 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Guild panel"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-2 border-bark/25 bg-cream shadow-[-16px_0_48px_-12px_rgba(43,27,18,0.5)]"
        style={{ animation: "rfcl-guild-in 220ms ease-out" }}
      >
        <style>{`@keyframes rfcl-guild-in { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>
        <header className="flex items-center justify-between gap-3 border-b border-clay/15 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-bark">
            <GameChromeIcon name="guild" className="h-4 w-4" /> Guild · <span lang="th">หอคอยพญาไก่</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full border border-bark/20 text-bark-soft transition hover:bg-sun-soft/60"
          >
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{panel}</div>
      </aside>
    </div>
  );
}
