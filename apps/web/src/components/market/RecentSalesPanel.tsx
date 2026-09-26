"use client";

// Rare Market sale history as indexed by Curvegrid MultiBaas (eth-dev1's
// GET /api/market/sales reads the saved Sold-event query). If the route had to
// fall back to plain RPC logs, the chip says so instead of claiming MultiBaas.

import { useQuery } from "@tanstack/react-query";
import { shortAddress, txUrl } from "@/lib/worldid/client";
import type { Hex } from "@/lib/worldid/types";
import { fmtUsdc, itemInfo } from "./chain";

type Sale = {
  listingId: string;
  buyer: Hex;
  seller: Hex;
  total: string;
  sellerProceeds: string;
  fee: string;
  txHash: Hex;
  itemId?: string;
  blockTimestamp?: number;
};
type SalesResponse = { source: "multibaas" | "rpc-fallback" | "rpc"; sales: Sale[]; multibaasError?: string };

export const salesKey = ["market-sales"] as const;

function ago(ts?: number) {
  if (!ts) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function RecentSalesPanel({ pendingTx }: { pendingTx?: Hex }) {
  const q = useQuery({
    queryKey: salesKey,
    queryFn: async (): Promise<SalesResponse> => {
      const res = await fetch("/api/market/sales?limit=5", { cache: "no-store" });
      if (!res.ok) throw new Error(`sales ${res.status}`);
      return res.json();
    },
    // Poll faster while we wait for MultiBaas to index a sale made on this page.
    refetchInterval: (query) => {
      const data = query.state.data as SalesResponse | undefined;
      const waiting = pendingTx && !data?.sales.some((s) => s.txHash.toLowerCase() === pendingTx.toLowerCase());
      return waiting ? 4_000 : 20_000;
    },
  });
  const data = q.data;
  const viaMultiBaas = data?.source === "multibaas";
  const waiting = pendingTx && data && !data.sales.some((s) => s.txHash.toLowerCase() === pendingTx.toLowerCase());

  return (
    <section className="rounded-3xl border-2 border-clay/15 bg-cream p-5 text-sm">
      <header className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-bark">Recent sales</h3>
          <p className="text-xs text-bark-soft">indexed by Curvegrid MultiBaas</p>
        </div>
        {data ? (
          <span
            title={data.multibaasError ?? undefined}
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              viaMultiBaas ? "border-field/40 bg-field/10 text-field-deep" : "border-sun/60 bg-sun-soft/60 text-bark"
            }`}
          >
            {viaMultiBaas ? "source: MultiBaas ✓" : "source: RPC fallback"}
          </span>
        ) : null}
      </header>

      {q.isLoading ? (
        <p className="text-xs text-bark-soft">Reading sale history…</p>
      ) : q.isError ? (
        <p className="text-xs text-clay-deep">Couldn&apos;t load sale history.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {waiting ? (
            <li className="rounded-2xl border border-dashed border-field/40 px-3 py-2 text-xs text-field-deep">
              <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-field" aria-hidden />
              Your sale is onchain; waiting for MultiBaas to index it…
            </li>
          ) : null}
          {data?.sales.length ? (
            data.sales.map((s) => {
              const fresh = pendingTx && s.txHash.toLowerCase() === pendingTx.toLowerCase();
              return (
                <li
                  key={s.txHash}
                  className={`rounded-2xl border px-3 py-2 ${fresh ? "border-field/50 bg-field/10" : "border-clay/10 bg-background/60"}`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-bold text-bark">
                      {s.itemId && s.itemId !== "0" ? itemInfo(Number(s.itemId)).name : `Listing #${s.listingId}`}
                    </span>
                    <span className="shrink-0 font-bold text-bark">{fmtUsdc(BigInt(s.total))} USDC</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-bark-soft">
                    <span className="font-mono">
                      {shortAddress(s.seller)} → {shortAddress(s.buyer)}
                    </span>
                    <span>
                      <span className="text-field-deep">90% {fmtUsdc(BigInt(s.sellerProceeds))}</span> ·{" "}
                      <span className="text-clay-deep">10% {fmtUsdc(BigInt(s.fee))}</span>
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-bark-soft">
                    <span>{ago(s.blockTimestamp)}</span>
                    <a className="underline hover:text-bark" href={txUrl(s.txHash)} target="_blank" rel="noreferrer">
                      Etherscan ↗
                    </a>
                  </div>
                </li>
              );
            })
          ) : (
            <li className="text-xs text-bark-soft">No sales yet.</li>
          )}
        </ul>
      )}
    </section>
  );
}
