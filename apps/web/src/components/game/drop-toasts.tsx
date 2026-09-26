"use client";

// New unminted mintable drops arriving on the poll show a compact, passive
// notification. The drop is already available from Bag, so this layer never
// blocks movement, combat, or the navigation menus.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Drop } from "@/game/types";
import { getItem, MINTABLE_RARITIES } from "@/game/data/items";
import { RARITY_META } from "./rarity-meta";
import { GameItemIcon } from "./game-item-icon";
import { remainingToastMs, TOAST_VISIBLE_MS } from "./drop-toast-timing";
import styles from "./drop-toasts.module.css";

const isToastable = (d: Drop): boolean =>
  d.status === "unminted" && (MINTABLE_RARITIES as readonly string[]).includes(d.rarity)

type ActiveToast = { key: string; drop: Drop; expiresAt: number }

export function DropToasts({ drops, hold = false }: { drops: Drop[]; hold?: boolean }) {
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
    // While the welcome-back card is open, its summary already carries the
    // drops ("Rare drops: N") — celebrating on top would stack two modals.
    if (hold) return
    const discoveredAt = Date.now()
    // Show the latest item only: stacked cards can cover the entire combat lane
    // on portrait phones. Every item is already stored in Bag.
    setQueue((q) => [
      ...q,
      ...fresh.map((drop) => ({
        key: drop.dropId,
        drop,
        expiresAt: discoveredAt + TOAST_VISIBLE_MS,
      })),
    ].slice(-1))
  }, [drops, hold])

  const dismiss = useCallback((key: string): void => {
    setQueue((q) => q.filter((t) => t.key !== key))
  }, [])

  return (
    <div
      className={styles.dock}
      data-game-drop-notice
      role="status"
      aria-live="polite"
    >
      {queue.map((toast) => (
        <DropToast key={toast.key} toast={toast} dismiss={dismiss} />
      ))}
    </div>
  )
}

// -------------------------------------------------------------------- toast

function DropToast({
  toast,
  dismiss,
}: {
  toast: ActiveToast
  dismiss: (key: string) => void
}) {
  const item = getItem(toast.drop.itemId)
  const meta = RARITY_META[toast.drop.rarity]

  useEffect(() => {
    const timer = window.setTimeout(
      () => dismiss(toast.key),
      remainingToastMs(toast.expiresAt),
    )
    return () => window.clearTimeout(timer)
  }, [dismiss, toast.expiresAt, toast.key])

  return (
    <div
      className={styles.toast}
      style={{ borderColor: meta.hex, animation: "rfcl-toast-in 260ms ease-out" }}
    >
      <style>{`@keyframes rfcl-toast-in { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes rfcl-toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{ boxShadow: `inset 0 0 22px -6px ${meta.hex}55` }}
      />
      <div className={styles.content}>
        <span
          className={styles.icon}
          style={{ borderColor: meta.hex }}
        >
            <GameItemIcon id={toast.drop.itemId} src={item?.image ?? `/assets/items/${toast.drop.itemId}.svg`} width={32} height={32} className="h-full w-full object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={styles.rarity}>
            {meta.label} drop
          </p>
          <p className={styles.name} lang="th" title={item?.name}>
            {item?.name ?? `#${toast.drop.itemId}`}
          </p>
          <p className={styles.saved}>Saved to Bag</p>
        </div>
      </div>
      <span
        aria-hidden
        className={styles.progress}
        style={{
          background: meta.hex,
          animation: `rfcl-toast-progress ${TOAST_VISIBLE_MS}ms linear forwards`,
        }}
      />
    </div>
  )
}
