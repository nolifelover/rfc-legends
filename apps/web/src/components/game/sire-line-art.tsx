"use client";

import { useState } from "react";
import type { SireLine } from "@/game/types";
import { sireLineInfo } from "./sire-lines";

/** Sire-line art. Shared routes keep legacy art unless /game opts into riverside. */
export function SireLineArt({
  line,
  size = 112,
  className = "",
  theme = "legacy",
}: {
  line: SireLine;
  size?: number;
  className?: string;
  theme?: "legacy" | "riverside";
}) {
  const info = sireLineInfo(line);
  const [failed, setFailed] = useState(false);
  const palette: Record<SireLine, { body: string; wing: string; tail: string; accent: string }> = {
    kumarnjeen: { body: "#b95542", wing: "#d68055", tail: "#315b65", accent: "#f2b45b" },
    kingkong: { body: "#5b463e", wing: "#7e6858", tail: "#253550", accent: "#bd5a43" },
    chaokhunthong: { body: "#c99143", wing: "#e7bd66", tail: "#75503b", accent: "#f4d28a" },
    thepbut: { body: "#e7dfc9", wing: "#b9c3d0", tail: "#67799a", accent: "#f2b45b" },
    raptor: { body: "#334f49", wing: "#547668", tail: "#1d3547", accent: "#b74f32" },
  };
  const colors = palette[line];
  return (
    <span
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 bg-sun-soft/50 ${info.badge} ${info.ring} ${className}`}
      aria-hidden
    >
      {!failed ? (
        // Plain <img> keeps error handling deterministic for generated assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={theme === "riverside" ? `/assets/game/riverside/characters/rooster-${line}.webp` : `/assets/sprites/rooster-${line}.svg`}
          alt=""
          width={size}
          height={size}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1.5"
        />
      ) : theme === "riverside" ? (
        <svg viewBox="0 0 96 96" className="h-[88%] w-[88%]" aria-hidden="true">
          <path d="M34 57C23 49 15 37 12 22c12 5 20 14 25 26M34 60C20 59 11 53 6 43c14-1 24 3 31 11" fill="none" stroke="#17213a" strokeWidth="9" strokeLinecap="round" />
          <path d="M34 57C23 49 15 37 12 22c12 5 20 14 25 26" fill="none" stroke={colors.tail} strokeWidth="5" strokeLinecap="round" />
          <path d="M34 60C20 59 11 53 6 43c14-1 24 3 31 11" fill="none" stroke={colors.accent} strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="48" cy="61" rx="27" ry="21" fill={colors.body} stroke="#17213a" strokeWidth="3" />
          <circle cx="67" cy="38" r="15" fill={colors.body} stroke="#17213a" strokeWidth="3" />
          <ellipse cx="47" cy="61" rx="14" ry="10" fill={colors.wing} stroke="#17213a" strokeWidth="3" />
          <circle cx="62" cy="22" r="5" fill="#c84e42" stroke="#17213a" strokeWidth="2" />
          <circle cx="69" cy="19" r="6" fill="#c84e42" stroke="#17213a" strokeWidth="2" />
          <circle cx="76" cy="23" r="5" fill="#c84e42" stroke="#17213a" strokeWidth="2" />
          <path d="M80 37l13 6-13 7Z" fill="#f2b45b" stroke="#17213a" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="71" cy="35" r="2.5" fill="#17213a" />
          <path d="M45 79l-2 11m15-12 3 12M36 90h13m6 0h13" fill="none" stroke="#17213a" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ) : (
        <span className="text-4xl leading-none">🐓</span>
      )}
    </span>
  );
}
