"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

function GameSiteLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  const className = `flex min-h-11 items-center rounded-xl px-3 text-xs font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff1bd] ${
    active
      ? "bg-[#f2c66d] text-[#102b43]"
      : "text-[#fff8e8] hover:bg-white/10"
  }`;

  if (href === "/") {
    return <Link href="/" aria-current={active ? "page" : undefined} className={className}>{label}</Link>;
  }
  return <a href={href} aria-current={active ? "page" : undefined} className={className}>{label}</a>;
}

/**
 * Compact site navigation for the wallet / character-creation states on
 * /game. The live game owns its navigation inside GameHudOverlay so there is
 * only one menu button over the scene.
 */
export function GameSiteNavigation({ className = "" }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Site navigation"
      data-game-site-navigation
      className={`flex w-full max-w-lg flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#c69a5b]/70 bg-[#142a4c]/95 p-2 shadow-lg ${className}`}
    >
      <Link
        href="/"
        aria-label="RFC Legends home"
        className="mr-auto flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-sm font-black text-[#fff8e8] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff1bd]"
      >
        <RoosterMark size={30} riverside />
        <span>RFC Legends</span>
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {NAV_LINKS.map((link) => (
          <GameSiteLink key={link.href} href={link.href} label={link.label} active={pathname === link.href} />
        ))}
      </div>
      <ConnectButton className="!min-h-11 !border-[#c69a5b] !bg-[#fff8e8] !px-3 !py-2 !text-xs !text-[#142a4c]" />
    </nav>
  );
}

export function NavBar() {
  const pathname = usePathname();

  // The live game and its pre-game cards provide their own navigation. This
  // prevents a second floating menu from competing with the game HUD.
  if (pathname?.startsWith("/game")) {
    return null;
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
