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
import { describeError, itemInfo, runTx } from "./chain";
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
}: {
  address: Hex;
  deployment: Deployment;
  itemId: number;
  balance: bigint;
  verified?: boolean;
}) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState("10");
  const [step, setStep] = useState<string | null>(null);
  const [listed, setListed] = useState(false);
  const [rejection, setRejection] = useState<{ code?: string; reason: string } | null>(null);
  const info = itemInfo(itemId);

  async function list() {
    setRejection(null);
    setListed(false);
    let unitPrice: bigint;
    try {
      unitPrice = parseUnits(price, 6);
    } catch {
      setRejection({ reason: "Enter a price like 10 or 12.5." });
      return;
    }
    if (unitPrice <= BigInt(0)) {
      setRejection({ reason: "Price must be more than 0 USDC." });
      return;
    }
    const listArgs = {
      address: deployment.RareMarket,
      abi: rareMarketAbi,
      functionName: "list",
      args: [BigInt(itemId), BigInt(1), unitPrice],
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
      await runTx(config, address, listArgs);
      setListed(true);
      void queryClient.invalidateQueries({ queryKey: ["market-listings"] });
      void queryClient.invalidateQueries({ queryKey: ["market-balances"] });
    } catch (err) {
      const { message, errorName } = describeError(err);
      setRejection({
        code: errorName,
        reason:
          errorName === "NotVerifiedHuman"
            ? `${message}: RareMarket only lets World ID verified humans sell. Verify with World ID first.`
            : message,
      });
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
        <div className="min-w-0">
          <p className="truncate font-bold text-bark">{info.name}</p>
          <p className="text-xs text-bark-soft">You hold {balance.toString()}</p>
        </div>
      </div>
      {rejection ? (
        <RejectionCard
          source={rejection.code ? "contract" : "wallet"}
          code={rejection.code}
          reason={rejection.reason}
          onDismiss={() => setRejection(null)}
        />
      ) : null}
      {listed ? (
        <p className="rounded-2xl border-2 border-field/40 bg-field/10 px-4 py-2 text-sm font-bold text-field-deep">
          Listed ✓ It&apos;s in escrow now and shows up in the listings below.
        </p>
      ) : null}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void list();
        }}
      >
        <label className="flex flex-1 items-center gap-1 rounded-full border-2 border-clay/20 bg-cream px-3 py-1.5 text-sm">
          <span className="sr-only">Price per unit in USDC</span>
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full bg-transparent font-bold text-bark outline-none"
          />
          <span className="text-xs text-bark-soft">USDC</span>
        </label>
        <button
          type="submit"
          disabled={!!step}
          className="rounded-full bg-clay px-4 py-2 text-sm font-bold text-cream hover:bg-clay-deep disabled:cursor-wait disabled:opacity-60"
        >
          {step ?? (verified === false ? "Verify with World ID to list" : "List 1")}
        </button>
      </form>
    </li>
  );
}
