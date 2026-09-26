"use client";

// Bag + Drops drawer — slides over the scene from the right. Closed, the
// screen stays rubric-clean; open, it must scroll (drop lists grow fast in
// demo mode). Data comes from the same 4s state poll as everything else.

import { useEffect, useMemo, useState } from "react";
import type { Drop, Player } from "@/game/types";
import { getItem, MINTABLE_RARITIES } from "@/game/data/items";
import { RARITY_META } from "./rarity-meta";
import { GameItemIcon } from "./game-item-icon";
import { GameChromeIcon } from "./game-chrome-icon";

type Tab = "bag" | "drops";

const isMintable = (d: Drop): boolean =>
  (MINTABLE_RARITIES as readonly string[]).includes(d.rarity);

function relTime(epochMs: number): string {
  const s = Math.max(0, Math.floor((Date.now() - epochMs) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_STYLE: Record<Drop["status"], { label: string; cls: string }> = {
  unminted: { label: "unminted", cls: "bg-sun/40 text-bark" },
  minting: { label: "minting", cls: "bg-sky-200/70 text-sky-900" },
  minted: { label: "minted", cls: "bg-field/25 text-field-deep" },
};

export function InventoryDrawer({
  open,
  onClose,
  player,
  drops,
}: {
  open: boolean;
  onClose: () => void;
  player: Player;
  drops: Drop[];
}) {
  const bagTotal = useMemo(
    () => Object.values(player.inventory).reduce((a, b) => a + b, 0),
    [player.inventory],
  );
  const [tab, setTab] = useState<Tab>("bag");

  // keep relative times fresh while open
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [open]);

  // close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const bagEntries = Object.entries(player.inventory).filter(([, n]) => n > 0);
  const sortedDrops = [...drops].sort((a, b) => b.droppedAt - a.droppedAt);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close bag"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-bark/40 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Bag and drops"
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-2 border-bark/25 bg-cream shadow-[-16px_0_48px_-12px_rgba(43,27,18,0.5)]"
        style={{ animation: "rfcl-drawer-in 220ms ease-out" }}
      >
        <style>{`@keyframes rfcl-drawer-in { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }`}</style>

        <header className="flex items-center justify-between gap-3 border-b border-clay/15 px-4 py-3">
          <div className="flex items-center gap-1 rounded-full border border-clay/25 bg-sun-soft/40 p-1">
            <TabButton active={tab === "bag"} onClick={() => setTab("bag")}>
              Bag ({bagTotal})
            </TabButton>
            <TabButton active={tab === "drops"} onClick={() => setTab("drops")}>
              Drops ({drops.length})
            </TabButton>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full border border-bark/20 text-bark-soft transition hover:bg-sun-soft/60"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "bag" ? (
            bagEntries.length === 0 ? (
              <EmptyState text="Your bag fills as you hunt — rare finds can be minted onchain." />
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {bagEntries.map(([idStr, count]) => {
                  const item = getItem(Number(idStr));
                  const meta = RARITY_META[item?.rarity ?? "common"];
                  return (
                    <li
                      key={idStr}
                      className="flex flex-col items-center gap-1.5 rounded-xl border-2 bg-background/60 p-2 text-center"
                      style={{ borderColor: `${meta.hex}66` }}
                      title={item?.desc ?? undefined}
                    >
                      <GameItemIcon id={Number(idStr)} src={item?.image ?? `/assets/items/${idStr}.svg`} width={44} height={44} className="h-11 w-11" />
                      <span className="w-full truncate text-[11px] font-bold text-bark" lang="th">
                        {item?.name ?? `#${idStr}`}
                      </span>
                      <span className="rounded-full bg-bark/10 px-2 text-[11px] font-black text-bark">
                        ×{count.toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )
          ) : sortedDrops.length === 0 ? (
            <EmptyState text="No rare drops yet — the fields are patient." />
          ) : (
            <ul className="flex flex-col gap-2">
              {sortedDrops.map((drop) => {
                const item = getItem(drop.itemId);
                const meta = RARITY_META[drop.rarity];
                const status = STATUS_STYLE[drop.status];
                return (
                  <li
                    key={drop.dropId}
                    className="flex items-center gap-3 rounded-xl border border-clay/15 bg-background/60 p-2.5"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 bg-sun-soft/50"
                      style={{ borderColor: meta.hex }}
                    >
                      <GameItemIcon id={drop.itemId} src={item?.image ?? `/assets/items/${drop.itemId}.svg`} width={36} height={36} className="h-9 w-9" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-bark" lang="th">
                        {item?.name ?? `#${drop.itemId}`}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold">
                        <span style={{ color: meta.hex }}>{meta.label}</span>
                        <span className="rounded-full bg-bark/10 px-1.5 py-px text-bark-soft">
                          {status.label}
                        </span>
                        <span className="text-bark-soft">{relTime(drop.droppedAt)}</span>
                      </p>
                    </div>
                    {drop.status === "unminted" && isMintable(drop) ? (
                      <a
                        href={`/market?dropId=${drop.dropId}`}
                        className="shrink-0 rounded-full bg-clay-deep px-3 py-1.5 text-[11px] font-bold text-cream shadow-sm transition hover:bg-clay"
                      >
                        Mint &amp; sell →
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-black transition ${
        active ? "bg-clay-deep text-cream" : "text-bark-soft hover:text-bark"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
      <GameChromeIcon name="bag" className="h-9 w-9 text-[#b68649]" />
      <p className="text-sm font-semibold text-bark-soft">{text}</p>
    </div>
  );
}
