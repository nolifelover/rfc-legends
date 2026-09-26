"use client";

import { useState } from "react";
import type { SireLine } from "@/game/types";
import { sireLineInfo } from "./sire-lines";

/**
 * Sire-line rooster art with a themed badge fallback if a replacement sprite
 * fails — never a broken image.
 */
export function SireLineArt({
  line,
  size = 112,
  className = "",
}: {
  line: SireLine;
  size?: number;
  className?: string;
}) {
  const info = sireLineInfo(line);
  const [fallbackLevel, setFallbackLevel] = useState(0);
  return (
    <span
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 bg-sun-soft/50 ${info.badge} ${info.ring} ${className}`}
      aria-hidden
    >
      {fallbackLevel < 2 ? (
        // Plain <img> on purpose: sprites may not be committed yet, and we need
        // onError to fall back to the existing rooster SVG before the drawn mark.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fallbackLevel === 0 ? `/assets/game/riverside/characters/rooster-${line}.webp` : `/assets/sprites/rooster-${line}.svg`}
          alt=""
          width={size}
          height={size}
          onError={() => setFallbackLevel((level) => level + 1)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <svg viewBox="0 0 64 64" className="h-3/4 w-3/4 text-[#b74f32]" fill="currentColor" aria-hidden="true">
          <path d="M38 19c1-5 4-7 7-8 0 5-1 8-4 10 3-3 7-3 10-1-2 5-6 7-12 6l-3 4c10 1 17 9 17 18 0 8-7 12-20 12H19c-9 0-14-5-14-12 0-8 5-13 13-16l6-3-6-5c-2-2-2-5 0-7 2-2 5-2 7 0l4 5 4-1 2-2c-2-4-1-8 3-10 4 3 5 6 3 10l-3 2Zm9 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM17 55l-7 7h7l7-7h-7Zm16 0-7 7h7l7-7h-7Z" />
        </svg>
      )}
    </span>
  );
}
