"use client";

// Rare-drop celebration toasts. Fires once per unseen unminted mintable drop
// that arrives on the 4s state poll; each toast hands off to the market via
// `/market?dropId=<bytes32>` (the worldid-builder lane's contract).

import { useEffect, useRef, useState } from "react";
import type { Drop, Rarity } from "@/game/types";
import { getItem, MINTABLE_RARITIES } from "@/game/data/items";

const RARITY_META: Record<Rarity, { label: string; ring: string; glow: string; text: string }> = {
  legendary: { label: "Legendary", ring: "border-[#b45309]", glow: "#b45309", text: "text-[#8a3f07]" },
  monster_card: { label: "Monster Card", ring: "border-[#7c3aed]", glow: "#7c3aed", text: "text-[#5f2fae]" },
  mvp_card: { label: "MVP Card", ring: "border-[#dc2626]", glow: "#dc2626", text: "text-[#a51d1d]" },
  common: { label: "Common", ring: "border-bark/30", glow: "#8a9a5b", text: "text-bark-soft" },
  rare: { label: "Rare", ring: "border-bark/30", glow: "#3b82c4", text: "text-bark-soft" },
  epic: { label: "Epic", ring: "border-bark/30", glow: "#8b5cf6", text: "text-bark-soft" },
}

const isToastable = (d: Drop): boolean =>
  d.status === "unminted" && (MINTABLE_RARITIES as readonly string[]).includes(d.rarity)

interface ActiveToast {
  key: string
  drop: Drop
}

export function DropToasts({ drops }: { drops: Drop[] }) {
  // Seeded on the first poll — drops that already existed are history, not news.
  const seen = useRef<Set<string> | null>(null)
  const [queue, setQueue] = useState<ActiveToast[]>([])

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(drops.map((d) => d.dropId))
      return
    }
    const seenSet = seen.current
    const fresh = drops.filter((d) => !seenSet.has(d.dropId) && isToastable(d))
    if (fresh.length === 0) return
    for (const d of fresh) seenSet.add(d.dropId)
    setQueue((q) => [...q, ...fresh.map((d) => ({ key: d.dropId, drop: d }))].slice(-3))
  }, [drops])

  const dismiss = (key: string): void => setQueue((q) => q.filter((t) => t.key !== key))

  return (
    <div
      className="pointer-events-none fixed bottom-24 right-4 z-50 flex w-80 flex-col-reverse gap-2"
      role="status"
      aria-live="polite"
    >
      {queue.map((t) => (
        <DropToast key={t.key} toast={t} onDismiss={() => dismiss(t.key)} />
      ))}
    </div>
  )
}

function DropToast({ toast, onDismiss }: { toast: ActiveToast; onDismiss: () => void }) {
  const item = getItem(toast.drop.itemId)
  const meta = RARITY_META[toast.drop.rarity]

  // auto-dismiss ~7s
  useEffect(() => {
    const t = setTimeout(onDismiss, 7000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="pointer-events-auto relative overflow-hidden rounded-2xl border-2 bg-cream p-3 shadow-[0_10px_36px_-8px_rgba(43,27,18,0.55)]" style={{ borderColor: meta.glow, animation: "rfcl-toast-in 260ms ease-out" }}>
      <style>{`@keyframes rfcl-toast-in { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes rfcl-sparkle { 0%,100% { opacity:.15; transform:scale(.6) rotate(0deg); } 50% { opacity:1; transform:scale(1.15) rotate(20deg); } }`}</style>
      {/* sparkle field */}
      {[
        { top: "6%", left: "4%", size: 12, delay: "0ms" },
        { top: "14%", right: "8%", size: 9, delay: "260ms" },
        { bottom: "18%", left: "10%", size: 10, delay: "520ms" },
        { top: "42%", right: "3%", size: 8, delay: "380ms" },
      ].map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute"
          style={{
            ...s,
            width: s.size,
            height: s.size,
            background: meta.glow,
            clipPath:
              "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
            animation: `rfcl-sparkle 1.6s ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}
      {/* glow aura */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: `inset 0 0 22px -6px ${meta.glow}55` }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-sun-soft/60"
          style={{ borderColor: meta.glow }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item?.image ?? `/assets/items/${toast.drop.itemId}.svg`} alt="" width={48} height={48} className="h-11 w-11 object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: meta.glow }}>
            Rare drop! {meta.label}
          </p>
          <p className="truncate text-base font-black text-bark" lang="th">
            {item?.name ?? `Item #${toast.drop.itemId}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <a
              href={`/market?dropId=${toast.drop.dropId}`}
              className="rounded-full bg-clay-deep px-3 py-1.5 text-xs font-bold text-cream shadow-sm transition hover:bg-clay"
            >
              Mint &amp; sell →
            </a>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full border border-bark/25 px-3 py-1.5 text-xs font-bold text-bark-soft transition hover:bg-sun-soft/60"
            >
              Keep playing
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
