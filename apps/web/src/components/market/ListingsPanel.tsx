"use client";

// Buyer side: active listings read from RareMarket (Listed events + getListing),
// test-USDC faucet, approve + buy, then the 90/10 split receipt. Sellers see
// Cancel on their own listings.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { erc20Abi, parseEventLogs, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { useConfig, usePublicClient } from "wagmi";
import { readContract } from "wagmi/actions";
import { mockUsdcAbi, rareMarketAbi } from "@/lib/contracts/abis";
import type { Deployment } from "@/lib/worldid/deployment";
import { shortAddress } from "@/lib/worldid/client";
import type { Hex } from "@/lib/worldid/types";
import { describeError, fmtUsdc, itemInfo, runTx } from "./chain";
import { RejectionCard } from "./RejectionCard";
import type { SaleReceipt } from "./SplitReceipt";

export type ActiveListing = { id: bigint; seller: Hex; itemId: bigint; amount: bigint; unitPrice: bigint };

export function useListings(deployment: Deployment | null | undefined) {
  const client = usePublicClient({ chainId: sepolia.id });
  return useQuery({
    queryKey: ["market-listings", deployment?.RareMarket],
    enabled: Boolean(deployment && client),
    refetchInterval: 15_000,
    queryFn: async (): Promise<{
      active: ActiveListing[];
      everListedItemIds: number[];
      /** Lowercase addresses that ever listed, and parties to past sales (for the progress row). */
      sellers: string[];
      soldParties: string[];
    }> => {
      const market = deployment!.RareMarket;
      // Public Sepolia RPCs refuse getLogs from block 0, and the address export
      // has no deploy block, so scan a recent window (~1 week of blocks).
      const fromBlock = (await client!.getBlockNumber()) - BigInt(50_000);
      const [logs, sales] = await Promise.all([
        client!.getContractEvents({ address: market, abi: rareMarketAbi, eventName: "Listed", fromBlock, toBlock: "latest" }),
        client!.getContractEvents({ address: market, abi: rareMarketAbi, eventName: "Sold", fromBlock, toBlock: "latest" }),
      ]);
      const ids = [...new Set(logs.map((l) => l.args.listingId!))];
      const rows = await Promise.all(
        ids.map((id) => client!.readContract({ address: market, abi: rareMarketAbi, functionName: "getListing", args: [id] })),
      );
      const active = ids
        .map((id, i) => ({ id, ...rows[i] }))
        .filter((l) => l.active && l.amount > BigInt(0))
        .map(({ id, seller, itemId, amount, unitPrice }) => ({ id, seller: seller as Hex, itemId, amount, unitPrice }))
        .reverse();
      // Sold-out listings still tell a buyer which item ids to check balances for.
      const everListedItemIds = [...new Set(logs.map((l) => Number(l.args.itemId!)))];
      const sellers = [...new Set(logs.map((l) => l.args.seller!.toLowerCase()))];
      const soldParties = [...new Set(sales.flatMap((s) => [s.args.seller!.toLowerCase(), s.args.buyer!.toLowerCase()]))];
      return { active, everListedItemIds, sellers, soldParties };
    },
  });
}

export function ListingsPanel({
  address,
  deployment,
  onSold,
}: {
  address?: Hex;
  deployment: Deployment | null | undefined;
  onSold: (r: SaleReceipt) => void;
}) {
  const listings = useListings(deployment);
  const client = usePublicClient({ chainId: sepolia.id });
  const usdc = useQuery({
    queryKey: ["market-usdc", address, deployment?.MockUSDC],
    enabled: Boolean(address && deployment && client),
    queryFn: () =>
      client!.readContract({ address: deployment!.MockUSDC, abi: mockUsdcAbi, functionName: "balanceOf", args: [address!] }),
  });

  return (
    <section className="rounded-3xl border-2 border-clay/20 bg-cream p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-bark">
          Rare Market listings
        </h2>
        {address && deployment ? (
          <UsdcFaucet address={address} deployment={deployment} balance={usdc.data} onDone={() => usdc.refetch()} />
        ) : null}
      </header>

      {!deployment ? (
        <p className="text-sm text-bark-soft">Contracts aren&apos;t deployed yet.</p>
      ) : listings.isLoading ? (
        <p className="text-sm text-bark-soft">Reading listings from RareMarket…</p>
      ) : listings.error ? (
        <p className="text-sm text-clay-deep">Couldn&apos;t read listings: {describeError(listings.error).message}</p>
      ) : !listings.data?.active.length ? (
        <p className="rounded-2xl bg-sun-soft/40 px-4 py-6 text-center text-sm text-bark-soft">
          Nothing listed right now. Verified players list minted drops here.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {listings.data.active.map((l) => (
            <ListingCard
              key={l.id.toString()}
              listing={l}
              address={address}
              deployment={deployment}
              onSold={(r) => {
                void usdc.refetch();
                onSold(r);
              }}
            />
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-bark-soft">
        Every sale splits in the contract: 90% to the seller, 10% to the RFC Club treasury. Prices are in test USDC on
        Sepolia. Items only come from in-game drops; there is no shop.
      </p>
    </section>
  );
}

function UsdcFaucet({
  address,
  deployment,
  balance,
  onDone,
}: {
  address: Hex;
  deployment: Deployment;
  balance?: bigint;
  onDone: () => void;
}) {
  const config = useConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2 text-xs text-bark-soft">
      <span>
        Balance: <b className="text-bark">{balance === undefined ? "…" : fmtUsdc(balance)}</b> USDC
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await runTx(config, address, {
              address: deployment.MockUSDC,
              abi: mockUsdcAbi,
              functionName: "mint",
              args: [address, parseUnits("100", 6)],
            });
            onDone();
          } catch (err) {
            setError(describeError(err).message);
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full border-2 border-field/40 px-3 py-1 font-bold text-field-deep hover:bg-field/10 disabled:opacity-60"
      >
        {busy ? "Minting…" : "+100 test USDC"}
      </button>
      {error ? <span className="text-clay-deep">{error}</span> : null}
    </div>
  );
}

function ListingCard({
  listing,
  address,
  deployment,
  onSold,
}: {
  listing: ActiveListing;
  address?: Hex;
  deployment: Deployment;
  onSold: (r: SaleReceipt) => void;
}) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<string | null>(null);
  const [rejection, setRejection] = useState<{ code?: string; reason: string } | null>(null);
  const info = itemInfo(listing.itemId);
  const mine = address?.toLowerCase() === listing.seller.toLowerCase();

  async function buy() {
    if (!address) return;
    setRejection(null);
    const total = listing.unitPrice; // buys one unit
    try {
      setStep("Checking USDC…");
      const [balance, allowance] = await Promise.all([
        readContract(config, { address: deployment.MockUSDC, abi: mockUsdcAbi, functionName: "balanceOf", args: [address], chainId: sepolia.id }),
        readContract(config, {
          address: deployment.MockUSDC,
          abi: mockUsdcAbi,
          functionName: "allowance",
          args: [address, deployment.RareMarket],
          chainId: sepolia.id,
        }),
      ]);
      if (balance < total) {
        setRejection({ reason: `You need ${fmtUsdc(total)} USDC but have ${fmtUsdc(balance)}. Use the +100 test USDC button.` });
        return;
      }
      if (allowance < total) {
        setStep("Approve USDC in your wallet…");
        await runTx(config, address, {
          address: deployment.MockUSDC,
          abi: mockUsdcAbi,
          functionName: "approve",
          args: [deployment.RareMarket, total],
        });
      }
      setStep("Confirm the purchase in your wallet…");
      const receipt = await runTx(config, address, {
        address: deployment.RareMarket,
        abi: rareMarketAbi,
        functionName: "buy",
        args: [listing.id, BigInt(1)],
      });
      const [sold] = parseEventLogs({ abi: rareMarketAbi, logs: receipt.logs, eventName: "Sold" });
      const transfers = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: "Transfer" })
        .filter((t) => t.address.toLowerCase() === deployment.MockUSDC.toLowerCase())
        .map((t) => ({ to: t.args.to as Hex, value: t.args.value }));
      // Treasury is owner-settable, so read it rather than trust a config value.
      const treasury = ((await readContract(config, {
          address: deployment.RareMarket,
          abi: rareMarketAbi,
          functionName: "treasury",
          chainId: sepolia.id,
        })) as Hex);
      onSold({
        txHash: receipt.transactionHash,
        listingId: sold.args.listingId,
        itemId: listing.itemId,
        buyer: sold.args.buyer as Hex,
        seller: sold.args.seller as Hex,
        amount: sold.args.amount,
        total: sold.args.total,
        sellerProceeds: sold.args.sellerProceeds,
        fee: sold.args.fee,
        treasury,
        transfers,
      });
      void queryClient.invalidateQueries({ queryKey: ["market-listings"] });
      void queryClient.invalidateQueries({ queryKey: ["market-balances"] });
    } catch (err) {
      const { message, errorName } = describeError(err);
      setRejection({ code: errorName, reason: message });
    } finally {
      setStep(null);
    }
  }

  async function cancel() {
    if (!address) return;
    setRejection(null);
    try {
      setStep("Confirm cancel in your wallet…");
      await runTx(config, address, {
        address: deployment.RareMarket,
        abi: rareMarketAbi,
        functionName: "cancel",
        args: [listing.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["market-listings"] });
      void queryClient.invalidateQueries({ queryKey: ["market-balances"] });
    } catch (err) {
      const { message, errorName } = describeError(err);
      setRejection({ code: errorName, reason: message });
    } finally {
      setStep(null);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-clay/15 bg-background/60 p-4">
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-2xl shadow-inner ${info.tone}`}
        >
          {info.glyph}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-bark">{info.name}</p>
          <p className="text-xs text-bark-soft">
            #{listing.id.toString()} · {listing.amount.toString()} left · seller{" "}
            <span className="font-mono">{mine ? "you" : shortAddress(listing.seller)}</span>
          </p>
        </div>
        <p className="text-right text-lg font-bold text-bark">
          {fmtUsdc(listing.unitPrice)}
          <span className="block text-[11px] font-medium text-bark-soft">USDC</span>
        </p>
      </div>

      {rejection ? (
        <RejectionCard
          title="Couldn't complete"
          source={rejection.code ? "contract" : "wallet"}
          code={rejection.code}
          reason={rejection.reason}
          onDismiss={() => setRejection(null)}
        />
      ) : null}

      {mine ? (
        <button
          type="button"
          onClick={cancel}
          disabled={!!step}
          className="rounded-full border-2 border-clay/40 px-4 py-2 text-sm font-bold text-clay-deep hover:bg-clay/10 disabled:opacity-60"
        >
          {step ?? "Cancel listing"}
        </button>
      ) : (
        <button
          type="button"
          onClick={buy}
          disabled={!address || !!step}
          className="rounded-full bg-field px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-field-deep disabled:cursor-wait disabled:opacity-60"
        >
          {step ?? (address ? `Buy for ${fmtUsdc(listing.unitPrice)} USDC` : "Connect a wallet to buy")}
        </button>
      )}
    </li>
  );
}
