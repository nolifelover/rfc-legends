"use client";

// /market: boss drop → World ID → mint → list → buy → 90/10 split.

import { useState } from "react";
import { useConnection } from "wagmi";
import { VerifyHuman } from "@/components/worldid/VerifyHuman";
import { addressUrl, shortAddress, useHumanStatus } from "@/lib/worldid/client";
import type { Hex } from "@/lib/worldid/types";
import { useDeployment } from "./chain";
import { DropsPanel, useDrops } from "./DropsPanel";
import { InventoryPanel } from "./InventoryPanel";
import { ListingsPanel, useListings } from "./ListingsPanel";
import { SplitReceipt, type SaleReceipt } from "./SplitReceipt";

export function MarketClient({ focusDropId }: { focusDropId?: Hex }) {
  const { address } = useConnection();
  const wallet = address?.toLowerCase() as Hex | undefined;
  const config = useDeployment();
  const deployment = config.data?.deployment;
  const status = useHumanStatus(wallet);
  const drops = useDrops(wallet);
  const listings = useListings(deployment);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);

  const mintedIds = drops.data?.drops.filter((d) => d.status === "minted").map((d) => d.itemId) ?? [];
  const listedIds = listings.data?.everListedItemIds ?? [];
  const steps = [
    { label: "Verify human", sub: "World ID", done: Boolean(status.data?.verified) },
    { label: "Mint drop", sub: "ERC-1155", done: mintedIds.length > 0 },
    {
      label: "List",
      sub: "escrow",
      done: Boolean(wallet && listings.data?.active.some((l) => l.seller.toLowerCase() === wallet)),
    },
    { label: "Sold", sub: "90 / 10 split", done: Boolean(receipt) },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-6">
        <p className="text-sm font-medium text-clay-deep">ตลาดของหายาก · Rare Market</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-bark sm:text-4xl">
          Rare drops, owned by real players
        </h1>
        <p className="mt-2 max-w-2xl text-bark-soft">
          Legendary gear, Monster Cards and MVP Cards only enter the world as boss drops. To mint or sell one you
          prove you&apos;re a unique human with World ID, so bot farms can&apos;t cash out. Every sale pays the seller
          90% and the RFC Club treasury 10%, split by the contract.
        </p>
      </header>

      <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Progress">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2 text-sm ${
              s.done ? "border-field/40 bg-field/10 text-field-deep" : "border-clay/15 bg-cream text-bark-soft"
            }`}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                s.done ? "bg-field text-cream" : "bg-sun-soft text-bark"
              }`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span className="leading-tight">
              <b className="block text-bark">{s.label}</b>
              <span className="text-xs">{s.sub}</span>
            </span>
          </li>
        ))}
      </ol>

      {config.data && !deployment ? (
        <p className="mb-6 rounded-2xl border-2 border-sun/50 bg-sun-soft/50 px-4 py-3 text-sm text-bark">
          Contracts aren&apos;t deployed to Sepolia yet, so onchain steps are disabled. World ID verification and the
          mint checks still run.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <VerifyHuman address={wallet} />
          <div className="rounded-3xl border-2 border-clay/15 bg-cream p-5 text-sm text-bark-soft">
            <h3 className="mb-2 font-bold text-bark">Rules of the Rare Market</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>One World ID backs one wallet. A second wallet of the same person is refused.</li>
              <li>Minting needs Base Lv {drops.data?.minBaseLevel ?? 30}+ and a drop you actually own.</li>
              <li>Daily mint limit: {config.data?.dailyLimit ?? 3} per wallet.</li>
              <li>Only World ID verified humans can list. Anyone can buy.</li>
            </ul>
            {deployment ? (
              <p className="mt-3 text-xs">
                Contracts:{" "}
                <a className="underline" href={addressUrl(deployment.RareMarket)} target="_blank" rel="noreferrer">
                  RareMarket {shortAddress(deployment.RareMarket)}
                </a>{" "}
                ·{" "}
                <a className="underline" href={addressUrl(deployment.HumanRegistry)} target="_blank" rel="noreferrer">
                  HumanRegistry {shortAddress(deployment.HumanRegistry)}
                </a>
              </p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {receipt ? <SplitReceipt r={receipt} onClose={() => setReceipt(null)} /> : null}
          <DropsPanel address={wallet} focusDropId={focusDropId} />
          <InventoryPanel address={wallet} deployment={deployment} candidateItemIds={[...mintedIds, ...listedIds]} />
          <ListingsPanel address={wallet} deployment={deployment} onSold={setReceipt} />
        </div>
      </div>
    </main>
  );
}
