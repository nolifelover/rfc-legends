"use client";

import { useState } from "react";

/** Game-only item art. A missing replacement uses a themed glyph. */
export function GameItemIcon({ id, src, className, width, height, style }: {
  id: number;
  src: string;
  className: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
}) {
  const [fallbackLevel, setFallbackLevel] = useState(0);
  if (fallbackLevel > 1) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-[#c69a5b]/70 bg-[#283b63] text-[#f2b45b] ${className}`}
        style={{ width, height, ...style }}
      >
        <svg viewBox="0 0 24 24" className="h-3/4 w-3/4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h16l1 12H3L4 8Z"/><path d="M8 9V6a4 4 0 0 1 8 0v3"/><path d="M8 14h8"/></svg>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={fallbackLevel === 0 ? `/assets/game/riverside/items/${id}.png` : src} alt="" width={width} height={height} className={className} style={style} onError={() => setFallbackLevel((level) => level + 1)} />;
}
