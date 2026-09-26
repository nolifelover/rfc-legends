// After a buy: the 90/10 split, read back from the Sold event and the two USDC
// transfers in the same transaction, with a Sepolia Etherscan link.

import { addressUrl, shortAddress, txUrl } from "@/lib/worldid/client";
import type { Hex } from "@/lib/worldid/types";
import { fmtUsdc, itemInfo } from "./chain";

export type SaleReceipt = {
  txHash: Hex;
  listingId: bigint;
  itemId: bigint;
  buyer: Hex;
  seller: Hex;
  amount: bigint;
  total: bigint;
  sellerProceeds: bigint;
  fee: bigint;
  treasury?: Hex;
  /** USDC Transfer events in the tx (from the buyer). */
  transfers: { to: Hex; value: bigint }[];
};

export function SplitReceipt({ r, onClose }: { r: SaleReceipt; onClose?: () => void }) {
  const sellerPct = r.total > BigInt(0) ? Number((r.sellerProceeds * BigInt(10000)) / r.total) / 100 : 0;
  const feePct = r.total > BigInt(0) ? Number((r.fee * BigInt(10000)) / r.total) / 100 : 0;
  const toSeller = r.transfers.find((t) => t.to.toLowerCase() === r.seller.toLowerCase());
  const toTreasury = r.treasury ? r.transfers.find((t) => t.to.toLowerCase() === r.treasury!.toLowerCase()) : undefined;

  return (
    <section
      aria-label="Sale receipt"
      className="rounded-3xl border-2 border-field/40 bg-cream p-5 shadow-[0_18px_50px_-24px_rgba(62,97,48,0.6)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wide text-field-deep uppercase">Sold ✓ · split onchain</p>
          <h3 className="text-lg font-bold text-bark">
            {itemInfo(r.itemId).name} × {r.amount.toString()} for {fmtUsdc(r.total)} USDC
          </h3>
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} className="text-xs text-bark-soft underline hover:text-bark">
            Close
          </button>
        ) : null}
      </header>

      <div className="mt-4 flex h-9 overflow-hidden rounded-full text-xs font-bold text-cream" aria-hidden>
        <div className="flex items-center justify-center bg-field" style={{ width: `${sellerPct}%` }}>
          Seller {sellerPct}%
        </div>
        <div className="flex items-center justify-center bg-clay" style={{ width: `${Math.max(feePct, 8)}%` }}>
          {feePct}%
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-field/10 p-3">
          <dt className="text-xs text-bark-soft">Seller receives (90%)</dt>
          <dd className="text-xl font-bold text-field-deep">{fmtUsdc(r.sellerProceeds)} USDC</dd>
          <dd className="text-xs text-bark-soft">
            to{" "}
            <a className="font-mono underline" href={addressUrl(r.seller)} target="_blank" rel="noreferrer">
              {shortAddress(r.seller)}
            </a>
            {toSeller ? ` · USDC transfer ${fmtUsdc(toSeller.value)} ✓` : null}
          </dd>
        </div>
        <div className="rounded-2xl bg-clay/10 p-3">
          <dt className="text-xs text-bark-soft">RFC Club treasury (10%)</dt>
          <dd className="text-xl font-bold text-clay-deep">{fmtUsdc(r.fee)} USDC</dd>
          <dd className="text-xs text-bark-soft">
            {r.treasury ? (
              <>
                to{" "}
                <a className="font-mono underline" href={addressUrl(r.treasury)} target="_blank" rel="noreferrer">
                  {shortAddress(r.treasury)}
                </a>
              </>
            ) : (
              "to the treasury"
            )}
            {toTreasury ? ` · USDC transfer ${fmtUsdc(toTreasury.value)} ✓` : null}
          </dd>
        </div>
      </dl>

      <details className="mt-3 text-xs text-bark-soft">
        <summary className="cursor-pointer">Decoded Sold event</summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-background p-3 font-mono text-[11px] leading-relaxed text-bark">
{`Sold(
  listingId:      ${r.listingId}
  buyer:          ${r.buyer}
  seller:         ${r.seller}
  amount:         ${r.amount}
  total:          ${r.total}   // ${fmtUsdc(r.total)} USDC
  sellerProceeds: ${r.sellerProceeds}   // ${fmtUsdc(r.sellerProceeds)} USDC
  fee:            ${r.fee}   // ${fmtUsdc(r.fee)} USDC
)`}
        </pre>
      </details>

      <a
        href={txUrl(r.txHash)}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 rounded-full bg-bark px-4 py-2 text-sm font-bold text-cream hover:opacity-90"
      >
        View on Sepolia Etherscan ↗
      </a>
    </section>
  );
}
