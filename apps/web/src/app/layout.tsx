import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { Providers } from "@/components/providers";
import { DemoBadge } from "@/components/game/demo-badge";
import { NavBar } from "@/components/game/nav-bar";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RFC Legends",
  description:
    "Idle MMORPG where your companion rooster is a real bird on a real Thai farm — verifiable pedigree onchain via ENSv2.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <html lang="en" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Providers>
          <NavBar />
          {demo ? (
            <div className="border-b border-sun/40 bg-sun-soft/60 py-1.5 text-center">
              <DemoBadge demo={demo} />
            </div>
          ) : null}
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="border-t border-clay/15 bg-cream/70">
            <p className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-bark-soft">
              Built at ETHGlobal Tokyo 2026 · Sepolia testnet
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
