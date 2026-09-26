import type { Metadata } from "next";
import { MarketClient } from "@/components/market/MarketClient";

export const metadata: Metadata = {
  title: "Rare Market · RFC Legends",
  description: "Mint boss drops as NFTs after World ID verification, and trade them with a 90/10 onchain split.",
};

// ?dropId=0x… comes from the game's drop popup and highlights that drop.
export default async function MarketPage({ searchParams }: PageProps<"/market">) {
  const { dropId } = await searchParams;
  const focus = typeof dropId === "string" && /^0x[0-9a-fA-F]{64}$/.test(dropId) ? (dropId as `0x${string}`) : undefined;
  return <MarketClient focusDropId={focus} />;
}
