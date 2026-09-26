"use client";

// Seller side: ERC-1155 rare items this wallet holds onchain, each with a list
// form (setApprovalForAll once, then RareMarket.list). An unverified wallet
// is refused by the contract; we simulate first so the refusal shows up
// before any wallet prompt.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { useConfig, usePublicClient } from "wagmi";
import { readContract, simulateContract } from "wagmi/actions";
import { rareItemsAbi, rareMarketAbi } from "@/lib/contracts/abis";
import type { Deployment } from "@/lib/worldid/deployment";
import type { Hex } from "@/lib/worldid/types";
import { txUrl } from "@/lib/worldid/client";
import { describeError, itemInfo, runTx, useSingleFlight, useTxBlocked, WRONG_CHAIN_LABEL } from "./chain";
import { ItemArt, ItemTitle } from "./ItemArt";
import { RejectionCard } from "./RejectionCard";

export function InventoryPanel({
  address,
  deployment,
  candidateItemIds,
  verified,
}: {
  address?: Hex;
  deployment: Deployment | null | undefined;
  /** Item ids worth checking: minted drops + anything seen in listings. */
  candidateItemIds: number[];
  /** World ID status of the wallet; undefined while loading. */
  verified?: boolean;
}) {
  const client = usePublicClient({ chainId: sepolia.id });
  // Lives here, not in the form: a listed item leaves the wallet (escrow), so its form unmounts.
  const [lastListed, setLastListed] = useState<{ itemId: number; txHash: Hex } | null>(null);
  const ids = [...new Set(candidateItemIds)].sort((a, b) => a - b);
  const balances = useQuery({
    queryKey: ["market-balances", address, deployment?.RareItems, ids.join(",")],
    enabled: Boolean(address && deployment && client && ids.length),
    queryFn: async () => {
      const values = await Promise.all(
        ids.map((id) =>
          client!.readContract({
            address: deployment!.RareItems,
            abi: rareItemsAbi,
            functionName: "balanceOf",
            args: [address!, BigInt(id)],
          }),
        ),
      );
      return ids.map((id, i) => ({ itemId: id, balance: values[i] })).filter((b) => b.balance > BigInt(0));
    },
  });

  return (
    <section className="rounded-3xl border-2 border-clay/20 bg-cream p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-bark">
        Your minted items
      </h2>
      {lastListed ? (
        <p className="mb-4 rounded-2xl border-2 border-field/40 bg-field/10 px-4 py-3 text-sm font-bold text-field-deep">
          Listed ✓ {itemInfo(lastListed.itemId).name} is in escrow and shows up in the listings below.{" "}
          <a className="font-normal underline" href={txUrl(lastListed.txHash)} target="_blank" rel="noreferrer">
            view tx ↗
          </a>
        </p>
      ) : null}
      {address && verified === false ? (
        <p role="status" className="mb-4 rounded-2xl border-2 border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay-deep">
          <b>Selling is locked for this wallet.</b> Only World ID verified humans can list on the Rare Market, and
          RareMarket checks HumanRegistry onchain, so a bot wallet can&apos;t sell even if it holds items.
        </p>
      ) : null}
      {!address || !deployment ? (
        <p className="text-sm text-bark-soft">{!address ? "Connect a wallet." : "Contracts aren't deployed yet."}</p>
      ) : balances.isLoading && ids.length ? (
        <p className="text-sm text-bark-soft">Reading balances…</p>
      ) : !balances.data?.length ? (
        <p className="rounded-2xl bg-sun-soft/40 px-4 py-6 text-center text-sm text-bark-soft">
          No minted items in this wallet. Mint a rare drop first.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {balances.data.map((b) => (
            <ListForm
              key={b.itemId}
              address={address}
              deployment={deployment}
              itemId={b.itemId}
              balance={b.balance}
              verified={verified}
              onListed={(txHash) => setLastListed({ itemId: b.itemId, txHash })}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ListForm({
  address,
  deployment,
  itemId,
  balance,
  verified,
  onListed,
}: {
  address: Hex;
  deployment: Deployment;
  itemId: number;
  balance: bigint;
  verified?: boolean;
  onListed: (txHash: Hex) => void;
}) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const flight = useSingleFlight();
  const blocked = useTxBlocked();
  const [price, setPrice] = useState("10");
  const [qty, setQty] = useState("1");
  const [step, setStep] = useState<string | null>(null);
  const [rejection, setRejection] = useState<{ code?: string; reason: string; precheck?: boolean } | null>(null);
  const info = itemInfo(itemId);

  const list = () => flight.run(doList);

  async function doList() {
    setRejection(null);
    const amount = Number(qty);
    if (!Number.isInteger(amount) || amount < 1 || BigInt(amount) > balance) {
      setRejection({ reason: `Quantity must be a whole number from 1 to ${balance.toString()}.`, precheck: true });
      return;
    }
    let unitPrice: bigint;
    try {
      unitPrice = parseUnits(price, 6);
    } catch {
      setRejection({ reason: "Enter a price like 10 or 12.5.", precheck: true });
      return;
    }
    if (unitPrice <= BigInt(0)) {
      setRejection({ reason: "Price must be more than 0 USDC.", precheck: true });
      return;
    }
    const listArgs = {
      address: deployment.RareMarket,
      abi: rareMarketAbi,
      functionName: "list",
      args: [BigInt(itemId), BigInt(amount), unitPrice],
    } as const;

    try {
      setStep("Checking you can list…");
      // Surfaces RareMarket.NotVerifiedHuman before asking for an approval.
      await simulateContract(config, { ...listArgs, account: address, chainId: sepolia.id }).catch((err) => {
        if (describeError(err).errorName === "NotVerifiedHuman") throw err;
      });
      const approved = await readContract(config, {
        address: deployment.RareItems,
        abi: rareItemsAbi,
        functionName: "isApprovedForAll",
        args: [address, deployment.RareMarket],
        chainId: sepolia.id,
      });
      if (!approved) {
        setStep("Approve the market in your wallet…");
        await runTx(config, address, {
          address: deployment.RareItems,
          abi: rareItemsAbi,
          functionName: "setApprovalForAll",
          args: [deployment.RareMarket, true],
        });
      }
      setStep("Confirm the listing in your wallet…");
      const receipt = await runTx(config, address, listArgs);
      onListed(receipt.transactionHash);
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
        <ItemArt info={info} />
        <div className="min-w-0">
          <ItemTitle info={info} />
          <p className="text-xs text-bark-soft">You hold {balance.toString()}</p>
        </div>
      </div>
      {rejection ? (
        <RejectionCard
          source={rejection.precheck ? "precheck" : rejection.code ? "contract" : "wallet"}
          code={rejection.code}
          reason={rejection.reason}
          onDismiss={() => setRejection(null)}
        />
      ) : null}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void list();
        }}
      >
        <label className="flex min-w-[7rem] flex-1 items-center gap-1 rounded-full border-2 border-clay/20 bg-cream px-3 py-1.5 text-sm">
          <span className="sr-only">Price per unit in USDC</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-transparent font-bold text-bark outline-none"
          />
          <span className="text-xs text-bark-soft">USDC each</span>
        </label>
        {balance > BigInt(1) ? (
          <label className="flex w-24 items-center gap-1 rounded-full border-2 border-clay/20 bg-cream px-3 py-1.5 text-sm">
            <span className="text-xs text-bark-soft">×</span>
            <span className="sr-only">Quantity to list</span>
            <input
              inputMode="numeric"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full bg-transparent font-bold text-bark outline-none"
            />
          </label>
        ) : null}
        <button
          type="submit"
          disabled={!!step || blocked}
          className="rounded-full bg-clay px-4 py-2 text-sm font-bold text-cream hover:bg-clay-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {step ?? (blocked ? WRONG_CHAIN_LABEL : verified === false ? "Verify with World ID to list" : `List ${qty || "1"}`)}
        </button>
      </form>
    </li>
  );
}
