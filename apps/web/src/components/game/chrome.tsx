"use client";

// Site chrome that steps aside on /game: the demo banner shrinks to a tiny
// inline pill and the footer disappears, so the canvas owns the viewport.

import { usePathname } from "next/navigation";
import { DemoBadge } from "./demo-badge";

export function DemoBanner({ demo }: { demo: boolean }) {
  const pathname = usePathname();
  if (!demo) return null;
  if (pathname?.startsWith("/game")) {
    return (
      <p className="pointer-events-none fixed right-3 top-2 z-30">
        <span className="rounded-full border-2 border-sun/80 bg-bark/95 px-2.5 py-0.5 text-xs font-black text-cream shadow-[0_2px_0_rgba(0,0,0,0.45)] backdrop-blur">
          ⚡ Demo <span lang="th">(อัตราเร่งสำหรับสาธิต)</span>
        </span>
      </p>
    );
  }
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
