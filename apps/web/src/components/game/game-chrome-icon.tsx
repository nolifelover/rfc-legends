import type { SVGProps } from "react";

type GameChromeIconName = "sparkle" | "bag" | "guild" | "wallet";

const paths: Record<GameChromeIconName, React.ReactNode> = {
  sparkle: <path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm6 12 .9 3.1L22 18l-3.1.9L18 22l-.9-3.1L14 18l3.1-.9L18 14Z" />,
  bag: <><path d="M5 8h14l1 13H4L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
  guild: <><path d="m12 2 8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5l8-3Z" /><path d="m8 12 2.5 2.5L16 9" /></>,
  wallet: <><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v16H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" /><path d="M4 7h16v4h-5a2 2 0 0 0 0 4h5v4" /><path d="M15 13h.01" /></>,
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
