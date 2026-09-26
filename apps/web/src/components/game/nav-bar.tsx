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
      <header data-riverside-nav className="static z-40 flex w-full items-center gap-2 bg-[#102b43] px-3 py-1.5 lg:pointer-events-none lg:fixed lg:left-3 lg:top-2 lg:w-auto lg:bg-transparent lg:px-0 lg:py-0">
        <style>{`
          [data-riverside-nav] [class*="bg-bark"] { background-color: #283b63 !important; }
          [data-riverside-nav] [class*="border-sun"] { border-color: #c69a5b !important; }
        `}</style>
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border-2 border-sun/80 bg-bark/95 px-2.5 py-1 shadow-[0_2px_0_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-sun"
          aria-label="RFC Legends home"
        >
          <RoosterMark size={22} riverside />
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label="Site menu"
          className="pointer-events-auto rounded-full border-2 border-sun/80 bg-bark/95 px-3.5 py-1 text-lg font-black text-cream shadow-[0_2px_0_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-sun"
        >
          ☰
        </button>
        {process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? (
          <span className="pointer-events-auto whitespace-nowrap rounded-full border-2 border-sun/80 bg-bark/95 px-2.5 py-0.5 text-xs font-black text-cream shadow-[0_2px_0_rgba(0,0,0,0.45)] backdrop-blur">
            ⚡ <span className="md:hidden">Demo</span>
            <span className="hidden md:inline">Demo <span lang="th">(อัตราเร่งสำหรับสาธิต)</span></span>
          </span>
        ) : null}
        {/* wallet tucked behind an icon + green dot; the address reveals on
            hover (critic r6 #4) */}
        {isConnected && address ? (
          <span className="group pointer-events-auto relative ml-1 inline-flex">
            <span
              title={`${address}
(click to copy)`}
              onClick={() => {
                void navigator.clipboard?.writeText(address).catch(() => {});
              }}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-sun/80 bg-bark/95 px-2.5 py-1 text-lg font-black text-cream shadow-[0_2px_0_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-sun"
            >
              <GameChromeIcon name="wallet" className="h-5 w-5" />
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden whitespace-nowrap rounded-md border border-sun/60 bg-[#1d130c] px-2 py-1 text-xs font-bold text-cream/90 shadow-lg group-hover:block">
              {address.slice(0, 8)}…{address.slice(-6)}
            </span>
          </span>
        ) : null}
        {menuOpen ? (
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border-2 border-sun/80 bg-bark/95 px-2 py-1 shadow-[0_3px_0_rgba(0,0,0,0.45)] backdrop-blur">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={pathname === link.href}
              />
            ))}
            <ConnectButton className="!px-2.5 !py-1 !text-xs" />
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
