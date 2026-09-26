"use client";

import { useState } from "react";
import type { SireLine } from "@/game/types";
import { sireLineInfo } from "./sire-lines";

/**
 * Sire-line rooster art with a graceful fallback: the committed sprite
 * (`/assets/sprites/rooster-<line>.svg`) if it loads, else a colored breed
 * badge — never a broken image.
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
  const [failed, setFailed] = useState(false);

  return (
    <span
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 ${info.badge} ${info.ring} ${className}`}
      aria-hidden
    >
      {!failed ? (
        // Plain <img> on purpose: sprites may not be committed yet, and we need
        // onError to swap to the badge — next/image adds loader complexity here.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/assets/sprites/rooster-${line}.svg`}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <span className="text-4xl leading-none">🐓</span>
      )}
    </span>
  );
}
