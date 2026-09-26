"use client";

// "Your rare drops": unminted Legendary / Monster Card / MVP Card drops from the
// game, each with a Mint button that asks the server for a voucher (World ID +
// level + ownership + daily limit) and then calls RareItems.mintWithVoucher.

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { signMessage } from "wagmi/actions";
import { rareItemsAbi } from "@/lib/contracts/abis";
import { txUrl } from "@/lib/worldid/client";
import { ownershipMessage, randomNonce } from "@/lib/worldid/ownership";
import type { Hex, VoucherResponse } from "@/lib/worldid/types";
import { describeError, itemInfo, runTx } from "./chain";
import { RejectionCard } from "./RejectionCard";

type Drop = { dropId: Hex; itemId: number; rarity: string; status: "unminted" | "minting" | "minted" };
type DropsResponse = {
  player: { name: string | null; baseLevel: number } | null;
  minBaseLevel: number;
  drops: Drop[];
  mintsToday: number;
  dailyLimit: number;
  devFixtures?: boolean;
};

export const dropsKey = (address?: string) => ["market-drops", address?.toLowerCase()] as const;

export function useDrops(address?: Hex) {
  return useQuery({
    queryKey: dropsKey(address),
    enabled: Boolean(address),
    queryFn: async (): Promise<DropsResponse> => {
      const res = await fetch(`/api/voucher/drops?address=${address}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't load drops");
      return res.json();
    },
  });
}

type MintState =
  | { kind: "idle" }
  | { kind: "busy"; step: string }
  | { kind: "rejected"; source: "server" | "contract" | "wallet"; code?: string; reason: string }
  | { kind: "minted"; txHash: Hex };

export function DropsPanel({ address, focusDropId }: { address?: Hex; focusDropId?: Hex }) {
  const drops = useDrops(address);
  const data = drops.data;
  const list = data?.drops.filter((d) => d.status !== "minted") ?? [];
  // A drop linked from the game popup that the server doesn't list for this
  // wallet still gets a card, so trying to mint it shows the real reason.
  const orphan =
    focusDropId && data && !data.drops.some((d) => d.dropId.toLowerCase() === focusDropId.toLowerCase())
      ? focusDropId
      : null;

  return (
    <section className="rounded-3xl border-2 border-clay/20 bg-cream p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-bark">
          Your rare drops
        </h2>
        {data ? (
          <p className="text-xs text-bark-soft">
            {data.player ? `Base Lv ${data.player.baseLevel}` : "No character yet"} · mints today {data.mintsToday}/
            {data.dailyLimit}
          </p>
        ) : null}
      </header>

      {data?.devFixtures ? (
        <p className="mb-3 rounded-xl border border-dashed border-bark-soft/50 px-3 py-1.5 text-xs text-bark-soft">
          Dev fixtures: these drops are fake local test data, not from the game.
        </p>
      ) : null}
      {!address ? (
        <p className="text-sm text-bark-soft">Connect a wallet to see your drops.</p>
      ) : drops.isLoading ? (
        <p className="text-sm text-bark-soft">Loading drops…</p>
      ) : list.length === 0 && !orphan ? (
        <p className="rounded-2xl bg-sun-soft/40 px-4 py-6 text-center text-sm text-bark-soft">
          No mintable drops yet. Legendary gear, Monster Cards and MVP Cards drop from bosses in the game.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {orphan ? <DropCard key={orphan} address={address} dropId={orphan} focused /> : null}
          {list.map((d) => (
            <DropCard
              key={d.dropId}
              address={address}
              dropId={d.dropId}
              itemId={d.itemId}
              rarity={d.rarity}
              focused={focusDropId?.toLowerCase() === d.dropId.toLowerCase()}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DropCard({
  address,
  dropId,
  itemId,
  rarity,
  focused,
}: {
  address: Hex;
  dropId: Hex;
  itemId?: number;
  rarity?: string;
  focused?: boolean;
}) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [state, setState] = useState<MintState>({ kind: "idle" });
  const ref = useRef<HTMLLIElement>(null);
  const info = itemId ? itemInfo(itemId) : { name: "Drop from the game", kind: "Unknown drop", glyph: "🎁", tone: "from-bark-soft to-bark" };

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused]);

  async function mint() {
    // Prove this wallet is asking (single-use signature), so nobody else can spend its daily mints.
    setState({ kind: "busy", step: "Sign the mint request in your wallet…" });
    const nonce = randomNonce();
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    let signature: Hex;
    try {
      signature = await signMessage(config, {
        account: address,
        message: ownershipMessage({ purpose: "mint-rare-drop", address, dropId, nonce, expiresAt }),
      });
    } catch (err) {
      setState({ kind: "rejected", source: "wallet", reason: describeError(err).message });
      return;
    }
    setState({ kind: "busy", step: "Checking World ID, level and drop…" });
    const res = await fetch("/api/voucher/mint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, dropId, ownership: { nonce, expiresAt, signature } }),
    });
    const body = (await res.json().catch(() => null)) as VoucherResponse | null;
    if (!body || !body.ok) {
      setState({
        kind: "rejected",
        source: "server",
        code: body && !body.ok ? body.code : undefined,
        reason: body && !body.ok ? body.reason : `Voucher request failed (HTTP ${res.status}).`,
      });
      return;
    }

    try {
      setState({ kind: "busy", step: "Confirm the mint in your wallet…" });
      const v = body.voucher;
      const receipt = await runTx(config, address, {
        address: body.rareItems,
        abi: rareItemsAbi,
        functionName: "mintWithVoucher",
        args: [
          { to: v.to, itemId: BigInt(v.itemId), amount: BigInt(v.amount), dropId: v.dropId, deadline: BigInt(v.deadline) },
          body.signature,
        ],
      });
      setState({ kind: "busy", step: "Recording the mint…" });
      await fetch("/api/voucher/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, dropId, txHash: receipt.transactionHash }),
      });
      setState({ kind: "minted", txHash: receipt.transactionHash });
      void queryClient.invalidateQueries({ queryKey: ["market-drops"] });
      void queryClient.invalidateQueries({ queryKey: ["market-balances"] });
    } catch (err) {
      const { message, errorName } = describeError(err);
      setState({
        kind: "rejected",
        source: errorName ? "contract" : "wallet",
        code: errorName,
        reason: errorName === "NotVerifiedHuman" ? `${message}: RareItems only mints to World ID verified humans.` : message,
      });
    }
  }

  return (
    <li
      ref={ref}
      className={`flex flex-col gap-3 rounded-2xl border-2 bg-background/60 p-4 transition ${
        focused ? "border-sun ring-4 ring-sun/30" : "border-clay/15"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-2xl shadow-inner ${info.tone}`}
        >
          {info.glyph}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold text-bark">{info.name}</p>
          <p className="text-xs text-bark-soft">
            {rarity ? rarity.replace("_", " ") : info.kind} · drop <span className="font-mono">{dropId.slice(0, 10)}…</span>
          </p>
          {focused ? <p className="text-xs font-bold text-clay">From your latest boss drop</p> : null}
        </div>
      </div>

      {state.kind === "rejected" ? (
        <RejectionCard
          source={state.source}
          code={state.code}
          reason={state.reason}
          onDismiss={() => setState({ kind: "idle" })}
        />
      ) : null}

      {state.kind === "minted" ? (
        <p className="rounded-2xl border-2 border-field/40 bg-field/10 px-4 py-3 text-sm font-bold text-field-deep">
          Minted as ERC-1155 ✓{" "}
          <a className="font-normal underline" href={txUrl(state.txHash)} target="_blank" rel="noreferrer">
            view tx ↗
          </a>
        </p>
      ) : (
        <button
          type="button"
          onClick={mint}
          disabled={state.kind === "busy"}
          className="rounded-full bg-clay px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-clay-deep disabled:cursor-wait disabled:opacity-60"
        >
          {state.kind === "busy" ? state.step : state.kind === "rejected" ? "Try mint again" : "Mint as NFT"}
        </button>
      )}
    </li>
  );
}
