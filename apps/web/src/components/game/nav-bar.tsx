"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useConnection } from "wagmi";
import { ConnectButton } from "./connect-button";
import { RoosterMark } from "./rooster-mark";
import { GameChromeIcon } from "./game-chrome-icon";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/game", label: "Game" },
  { href: "/roosters", label: "My Roosters" },
  { href: "/market", label: "Market" },
];

// Only routes that exist can use <Link>; typedRoutes rejects <Link> to
// pages other lanes haven't created yet, so those stay plain <a>.
function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const className = `rounded-full px-3 py-1.5 text-sm font-medium transition md:px-4 md:py-2 ${
    active
      ? "bg-sun-soft text-bark"
      : "text-bark-soft hover:bg-sun-soft/50 hover:text-bark"
  }`;

  if (href === "/") {
    return (
      <Link href="/" aria-current={active ? "page" : undefined} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} aria-current={active ? "page" : undefined} className={className}>
      {label}
    </a>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { address, isConnected } = useConnection();

  // GAME MODE (/game): the chrome collapses to a floating brand + menu
  // button so the canvas keeps the viewport.
  if (pathname?.startsWith("/game")) {
    return (
      <header data-riverside-nav className="pointer-events-none fixed right-2 top-2 z-40 flex items-center gap-1.5 text-[#fff8e8]">
        <style>{`
          [data-riverside-nav] { top: max(8px, env(safe-area-inset-top)); right: max(8px, env(safe-area-inset-right)); }
          [data-riverside-nav] .game-site-action { display: grid; width: 44px; height: 44px; place-items: center; pointer-events: auto; border: 2px solid #c69a5b; border-radius: 14px 7px; background: rgba(27,49,83,.96); box-shadow: 0 3px 0 rgba(66,38,21,.7); }
          [data-riverside-nav] .game-site-action:focus-visible { outline: 2px solid #fff1bd; outline-offset: 2px; }
          [data-riverside-nav] .game-site-links a { display: flex; min-height: 44px; align-items: center; color: #fff8e8; }
          [data-riverside-nav] .game-site-links a[aria-current] { color: #102b43; }
        `}</style>
        {isConnected && address ? (
          <button
            type="button"
            title={`${address} (click to copy)`}
            aria-label="Copy wallet address"
            onClick={() => { void navigator.clipboard?.writeText(address).catch(() => {}); }}
            className="game-site-action relative"
          >
            <GameChromeIcon name="wallet" className="h-5 w-5" />
            <span aria-hidden className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Site menu"
          className="game-site-action"
        >
          <GameChromeIcon name="menu" width={25} height={25} />
        </button>
        {menuOpen ? (
          <div className="game-site-links pointer-events-auto absolute right-0 top-[52px] flex max-h-[calc(100dvh-68px-env(safe-area-inset-top))] w-64 overflow-y-auto overscroll-contain max-w-[calc(100vw-16px)] flex-col gap-1 rounded-2xl border-2 border-[#c69a5b] bg-[#142a4c] p-3 shadow-xl">
            <Link href="/" aria-label="RFC Legends home" className="gap-2 font-bold">
              <RoosterMark size={26} riverside /> RFC Legends
            </Link>
            {process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? (
              <span className="py-1 text-xs font-bold text-[#f2c66d]">Demo <span lang="th">(อัตราเร่งสำหรับสาธิต)</span></span>
            ) : null}
            {NAV_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} />
            ))}
            <ConnectButton className="!min-h-11 !px-2.5 !py-1 !text-xs" />
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 border-b border-clay/20 bg-cream/90 backdrop-blur">
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <RoosterMark size={36} />
          <span className="text-lg font-bold tracking-tight text-bark">
            RFC <span className="text-clay">Legends</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={pathname === link.href}
            />
          ))}
        </div>

        <ConnectButton />
      </nav>

      <div className="flex items-center justify-center gap-1 border-t border-clay/10 pb-2 md:hidden">
        {NAV_LINKS.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            label={link.label}
            active={pathname === link.href}
          />
        ))}
      </div>
    </header>
  );
}
