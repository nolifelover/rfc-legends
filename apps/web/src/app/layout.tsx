import type { Metadata } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import { Providers } from "@/components/providers";
import { DemoBanner, SiteFooter } from "@/components/game/chrome";
import { NavBar } from "@/components/game/nav-bar";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://rfclegends.rfcclub.app"),
  title: "RFC Legends",
  description:
    "Idle RPG · rooster cards with a farm-signed onchain pedigree. Real birds at a Thai farm, verifiable bloodlines via ENSv2, rare drops gated by World ID.",
  openGraph: {
    type: "website",
    url: "https://rfclegends.rfcclub.app",
    siteName: "RFC Legends",
    title: "RFC Legends",
    description:
      "Idle RPG · rooster cards with a farm-signed onchain pedigree. Real birds at a Thai farm, verifiable bloodlines via ENSv2.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "RFC Legends — idle RPG with real-rooster RWAs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "RFC Legends",
    description: "Idle RPG · rooster cards with a farm-signed onchain pedigree.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <html lang="en" className={`${notoSansThai.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <Providers>
          <NavBar />
          <DemoBanner demo={demo} />
          <div className="flex flex-1 flex-col">{children}</div>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
