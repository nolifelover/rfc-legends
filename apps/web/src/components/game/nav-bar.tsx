"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useConnection } from "wagmi";
import { ConnectButton } from "./connect-button";
import { RoosterMark } from "./rooster-mark";

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
  const { isConnected } = useConnection();

  // GAME MODE (/game): the chrome collapses to a floating brand + menu
  // button so the canvas keeps the viewport.
  if (pathname?.startsWith("/game")) {
    return (
      <header className="pointer-events-none fixed left-3 top-2 z-40 flex items-center gap-2">
        <Link
          href="/"
          className="pointer-events-auto flex items-center gap-1.5 rounded-full border-2 border-sun/80 bg-bark/95 px-2.5 py-1 shadow-[0_2px_0_rgba(0,0,0,0.45)] backdrop-blur transition hover:border-sun"
          aria-label="RFC Legends home"
        >
          <RoosterMark size={22} />
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
        {/* the connected chip stays reachable while playing (the demo
            badge pill sits further right; they stack without overlap) */}
        {isConnected ? (
          <span className="pointer-events-auto ml-1 [&_button]:!px-3 [&_button]:!py-1 [&_button]:!text-xs">
            <ConnectButton />
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
