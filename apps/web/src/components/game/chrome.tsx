"use client";

// Site chrome that steps aside on /game: the demo banner shrinks to a tiny
// inline pill and the footer disappears, so the canvas owns the viewport.

import { usePathname } from "next/navigation";
import { DemoBadge } from "./demo-badge";

export function DemoBanner({ demo }: { demo: boolean }) {
  const pathname = usePathname();
  if (!demo) return null;
  // On /game the pill renders inside the nav-bar's top-left cluster (see
  // nav-bar.tsx) so it can never sit on the canvas' KILL chip.
  if (pathname?.startsWith("/game")) return null;
  return (
    <div className="border-b border-sun/40 bg-sun-soft/60 py-1.5 text-center">
      <DemoBadge demo={demo} />
    </div>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/game")) return null;
  return (
    <footer className="border-t border-clay/15 bg-cream/70">
      <p className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-bark-soft">
        Built at ETHGlobal Tokyo 2026 · Sepolia testnet
      </p>
    </footer>
  );
}
