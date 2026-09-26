import type { SVGProps } from "react";

type GameChromeIconName =
  | "sparkle"
  | "bag"
  | "guild"
  | "wallet"
  | "sync"
  | "market"
  | "menu";

const paths: Record<GameChromeIconName, React.ReactNode> = {
  sparkle: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm6 12 .9 3.1L22 18l-3.1.9L18 22l-.9-3.1L14 18l3.1-.9L18 14Z" />,
  bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  guild: <><path d="m12 2 8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3Z" /><path d="m8 12 2.5 2.5L16 9" /></>,
  wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" /><path d="M4 7h16v4h-5a2 2 0 0 0 0 4h5v4" /><path d="M15 13h.01" /></>,
  sync: <><path d="M20 7v5h-5" /><path d="M4.9 9A8 8 0 0 1 18.4 6L20 12M4 17v-5h5" /><path d="M19.1 15A8 8 0 0 1 5.6 18L4 12" /></>,
  market: <><path d="M4 10h16l-1-5H5l-1 5Z" /><path d="M6 10v10h12V10M9 20v-6h6v6" /><path d="M4 10c0 1.2 1 2 2.2 2s2.1-.8 2.1-2c0 1.2 1 2 2.2 2s2.1-.8 2.1-2c0 1.2 1 2 2.2 2s2.1-.8 2.1-2c0 1.2 1 2 2.2 2s2-.8 2-2" /></>,
  menu: <><path d="M5 7h14M5 12h14M5 17h14" /><path d="M3 7h.01M3 12h.01M3 17h.01" /></>,
};

export function GameChromeIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: GameChromeIconName }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {paths[name]}
    </svg>
  );
}
