"use client";

import { useState } from "react";

/** Game-only item art. A missing replacement uses a themed glyph. */
export function GameItemIcon({ id, className, width, height, style }: {
  id: number;
  src: string;
  className: string;
  width: number;
  height: number;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-[#c69a5b]/70 bg-[#283b63] text-[#f2b45b] ${className}`}
        style={{ width, height, ...style }}
      >
        <RiversideItemFallback id={id} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/assets/game/riverside/items/${id}.png`} alt="" width={width} height={height} className={className} style={style} onError={() => setFailed(true)} />;
}

function RiversideItemFallback({ id }: { id: number }) {
  const variant = id % 10;
  const tier = id >= 3000 ? "#b64d6a" : id >= 2000 ? "#795b9a" : id >= 1000 ? "#3f7880" : id >= 200 ? "#566d8f" : "#76523a";
  return (
    <svg viewBox="0 0 48 48" className="h-[88%] w-[88%]" aria-hidden="true">
      <circle cx="24" cy="24" r="18" fill={tier} stroke="#f2b45b" strokeWidth="2" />
      {id < 200 ? (
        <g fill="#f4e7c8" stroke="#17213a" strokeWidth="2" strokeLinejoin="round">
          <ellipse cx="24" cy="29" rx="10" ry="9" />
          <path d="M18 21h12l-2-9h-8Z" />
          <path d="M16 22h16" fill="none" />
        </g>
      ) : id < 1000 ? (
        <g stroke="#17213a" strokeWidth="2" strokeLinejoin="round">
          <path d="M23 11h5v27h-5Z" fill="#ffdda0" />
          {variant % 3 === 0 ? <path d="M12 13h26v7H12Z" fill="#f4e7c8" /> : variant % 3 === 1 ? <path d="m10 19 14-9v15Z" fill="#f4e7c8" /> : <ellipse cx="31" cy="16" rx="10" ry="5" fill="#f4e7c8" />}
        </g>
      ) : id < 2000 ? (
        <g stroke="#17213a" strokeWidth="2" strokeLinejoin="round">
          <path d="m24 8 14 13-6 19-8-9-8 9-6-19Z" fill="#f4e7c8" />
          <circle cx="24" cy="25" r="7" fill="#f2b45b" />
          <circle cx="24" cy="25" r="2.5" fill={tier} stroke="none" />
        </g>
      ) : id < 3000 ? (
        <g stroke="#17213a" strokeWidth="2" strokeLinejoin="round">
          <rect x="13" y="7" width="22" height="34" rx="5" fill="#f4e7c8" />
          <circle cx="24" cy="23" r="8" fill={tier} />
          <circle cx="24" cy="23" r="3" fill="#f2b45b" stroke="none" />
          <path d="M18 35h12" />
        </g>
      ) : (
        <g stroke="#17213a" strokeWidth="2" strokeLinejoin="round">
          <path d="m24 6 5 11 12-2-8 9 8 9-12-2-5 11-5-11-12 2 8-9-8-9 12 2Z" fill="#f2b45b" />
          <circle cx="24" cy="24" r="5" fill="#f4e7c8" />
        </g>
      )}
      <circle cx="39" cy="9" r="3" fill={variant % 2 === 0 ? "#ffdda0" : "#d67878"} stroke="#17213a" strokeWidth="1.5" />
    </svg>
  );
}
