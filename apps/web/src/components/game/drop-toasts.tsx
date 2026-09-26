"use client";

// Rare-drop celebration. New unminted mintable drops arriving on the 4s poll
// fire a toast; card rarities (MVP/Monster) first get a brief full-screen
// MOMENT — a light pillar, "Dropped by <monster> · <Rarity>", and the card
// flying to the bag (≤2.5s, click-through, no pack-reveal theatrics). Every
// handoff to the market goes through `/market?dropId=<bytes32>`
// (worldid-builder contract).

import { useEffect, useRef, useState } from "react";
import type { Drop } from "@/game/types";
import { getItem, MINTABLE_RARITIES } from "@/game/data/items";
import { MAPS } from "@/game/data/maps";
import { isJackpotRarity, RARITY_META } from "./rarity-meta";

const isToastable = (d: Drop): boolean =>
  d.status === "unminted" && (MINTABLE_RARITIES as readonly string[]).includes(d.rarity)

/** itemId → the monster whose card it is, for the "Dropped by" line. */
const CARD_OWNER: Record<number, { name: string; emoji: string }> = (() => {
  const out: Record<number, { name: string; emoji: string }> = {}
  for (const map of Object.values(MAPS)) {
    for (const spawn of map.monsters) {
      if (spawn.monster.cardId != null) out[spawn.monster.cardId] = { name: spawn.monster.name, emoji: spawn.monster.emoji }
    }
    if (map.mvp && map.mvp.cardId != null) out[map.mvp.cardId] = { name: map.mvp.name, emoji: map.mvp.emoji }
  }
  return out
})()

type ActiveToast = { key: string; drop: Drop }

const JACKPOT_MS = 2400

export function DropToasts({ drops }: { drops: Drop[] }) {
  // Seeded on the first poll — drops that already existed are history, not news.
  const seen = useRef<Set<string> | null>(null)
  const [queue, setQueue] = useState<ActiveToast[]>([])
  const [jackpot, setJackpot] = useState<Drop | null>(null)

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(drops.map((d) => d.dropId))
      return
    }
    const seenSet = seen.current
    const fresh = drops.filter((d) => !seenSet.has(d.dropId) && isToastable(d))
    if (fresh.length === 0) return
    for (const d of fresh) seenSet.add(d.dropId)
    for (const drop of fresh) {
      if (isJackpotRarity(drop.rarity)) {
        // moment first; the toast joins the queue as the moment ends
        setJackpot((current) => current ?? drop)
        window.setTimeout(() => {
          setJackpot((current) => (current?.dropId === drop.dropId ? null : current))
          setQueue((q) => [...q, { key: drop.dropId, drop }].slice(-3))
        }, JACKPOT_MS)
      } else {
        setQueue((q) => [...q, { key: drop.dropId, drop }].slice(-3))
      }
    }
  }, [drops])

  const dismiss = (key: string): void => setQueue((q) => q.filter((t) => t.key !== key))

  return (
    <>
      {jackpot ? <JackpotMoment drop={jackpot} /> : null}
      <div
        className="pointer-events-none fixed right-4 top-16 z-50 flex w-80 flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {queue.map((t) => (
          <DropToast key={t.key} toast={t} onDismiss={() => dismiss(t.key)} />
        ))}
      </div>
    </>
  )
}

// ------------------------------------------------------------- jackpot moment

function JackpotMoment({ drop }: { drop: Drop }) {
  const item = getItem(drop.itemId)
  const meta = RARITY_META[drop.rarity]
  const owner = CARD_OWNER[drop.itemId]
  // no state, no dismiss handler: the moment is brief and click-through by
  // design, so the rehearsed timing around it stays predictable.
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // fly the card to the bag button (bottom-left HUD) as the moment ends
    const t = window.setTimeout(() => {
      cardRef.current?.animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          {
            transform: `translate(calc(-50vw + 90px), calc(46vh)) scale(.12)`,
            opacity: 0,
          },
        ],
        { duration: 650, easing: "cubic-bezier(.5,-0.1,.75,.4)", fill: "forwards" },
      )
    }, JACKPOT_MS - 700)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex flex-col items-center justify-end gap-4 pb-[10vh]"
      role="alert"
      aria-live="assertive"
    >
      <style>{`
@keyframes rfcl-jp-fade { 0% { opacity: 0; } 12% { opacity: 1; } 82% { opacity: 1; } 100% { opacity: 0; } }
@keyframes rfcl-jp-rise { 0% { transform: translateY(16px) scale(.82); opacity: 0; } 100% { transform: none; opacity: 1; } }
@keyframes rfcl-jp-pillar { 0% { opacity: 0; transform: scaleY(.4); } 25% { opacity: .9; } 100% { opacity: .55; transform: scaleY(1); } }`}</style>
      <div className="absolute inset-0 bg-bark/55 backdrop-blur-[2px]" style={{ animation: "rfcl-jp-fade 2400ms ease-out both" }} />
      {/* light pillar */}
      <div
        aria-hidden
        className="absolute bottom-[6%] top-auto h-[78%] w-[46vmin] rounded-full"
        style={{
          background: `linear-gradient(to bottom, ${meta.hex}00 0%, ${meta.hex}59 38%, ${meta.hex}2e 72%, transparent 100%)`,
          filter: "blur(6px)",
          animation: "rfcl-jp-pillar 900ms cubic-bezier(.2,.8,.3,1) both",
          transformOrigin: "top center",
        }}
      />
      <div ref={cardRef} className="relative" style={{ animation: "rfcl-jp-rise 480ms cubic-bezier(.2,1.2,.4,1) both" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item?.image ?? `/assets/items/${drop.itemId}.svg`}
          alt=""
          className="h-[38vh] w-auto rounded-2xl border-4 bg-cream/95 p-3 drop-shadow-[0_24px_48px_rgba(0,0,0,0.55)]"
          style={{ borderColor: meta.hex }}
        />
      </div>
      <div className="relative text-center" style={{ animation: "rfcl-jp-rise 420ms 220ms ease-out both" }}>
        <p className="text-2xl font-black tracking-wide text-cream sm:text-3xl" style={{ textShadow: "0 2px 0 #2b1b12, 0 0 22px rgba(0,0,0,.65)" }}>
          Dropped by <span lang="th">{owner?.name ?? "the field"}</span> {owner?.emoji ?? ""} ·{" "}
          <span style={{ color: meta.hex }}>{meta.label}</span>
        </p>
        <p className="mt-1 text-sm font-bold text-cream/80" lang="th" style={{ textShadow: "0 1px 0 #2b1b12" }}>
          {item?.name ?? `#${drop.itemId}`}
        </p>
      </div>
    </div>
  )
}

// -------------------------------------------------------------------- toast

function DropToast({ toast, onDismiss }: { toast: ActiveToast; onDismiss: () => void }) {
  const item = getItem(toast.drop.itemId)
  const meta = RARITY_META[toast.drop.rarity]

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className="pointer-events-auto relative overflow-hidden rounded-2xl border-2 bg-cream p-3 shadow-[0_10px_36px_-8px_rgba(43,27,18,0.55)]"
      style={{ borderColor: meta.hex, animation: "rfcl-toast-in 260ms ease-out" }}
    >
      <style>{`@keyframes rfcl-toast-in { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes rfcl-sparkle { 0%,100% { opacity:.15; transform:scale(.6) rotate(0deg); } 50% { opacity:1; transform:scale(1.15) rotate(20deg); } }`}</style>
      {/* sparkle field */}
      {[
        { top: -6, left: 8, size: 12, delay: "0ms" },
        { top: 10, right: 10, size: 9, delay: "300ms" },
        { bottom: -4, left: "38%", size: 10, delay: "150ms" },
      ].map((s, i) => (
        <span
          key={i}
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            ...s,
            width: s.size,
            height: s.size,
            background: meta.hex,
            clipPath:
              "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
            animation: `rfcl-sparkle 1.6s ease-in-out ${s.delay} infinite`,
          }}
        />
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ boxShadow: `inset 0 0 22px -6px ${meta.hex}55` }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 bg-sun-soft/60"
          style={{ borderColor: meta.hex }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item?.image ?? `/assets/items/${toast.drop.itemId}.svg`}
            alt=""
            width={48}
            height={48}
            className="h-11 w-11 object-contain"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider" style={{ color: meta.hex }}>
            {meta.label}
          </p>
          <p className="truncate text-sm font-bold text-bark" lang="th">
            {item?.name ?? `#${toast.drop.itemId}`}
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <a
              href={`/market?dropId=${toast.drop.dropId}`}
              className="rounded-full border border-clay/40 bg-sun-soft/70 px-2.5 py-0.5 text-[11px] font-black text-clay-deep transition hover:bg-sun-soft"
            >
              Mint &amp; sell →
            </a>
            <span className="text-xs font-bold text-bark/75">auto-hides</span>
          </div>
        </div>
      </div>
    </div>
  )
}
