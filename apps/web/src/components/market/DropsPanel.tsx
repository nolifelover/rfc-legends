"use client";

// "Your rare drops": unminted Legendary / Monster Card / MVP Card drops from the
// game, each with a Mint button that asks the server for a voucher (World ID +
// level + ownership + daily limit) and then calls RareItems.mintWithVoucher.

import { useEffect, useRef, useState } from "react";

const COLLAPSED_COUNT = 6;
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useConfig } from "wagmi";
import { signMessage } from "wagmi/actions";
import { rareItemsAbi } from "@/lib/contracts/abis";
import { txUrl } from "@/lib/worldid/client";
import { ownershipMessage, randomNonce } from "@/lib/worldid/ownership";
import type { Hex, VoucherResponse } from "@/lib/worldid/types";
import { describeError, itemInfo, runTx, useSingleFlight, useTxBlocked, WRONG_CHAIN_LABEL } from "./chain";
import { CONTRACT_REASONS } from "./errors";
import { ItemArt, ItemTitle } from "./ItemArt";
import { RejectionCard } from "./RejectionCard";

type Drop = { dropId: Hex; itemId: number; rarity: string; status: "unminted" | "minting" | "minted"; txHash?: string };
type DropsResponse = {
  player: { name: string | null; baseLevel: number } | null;
  minBaseLevel: number;
  drops: Drop[];
  mintsToday: number;
  dailyLimit: number;
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
  const [showAll, setShowAll] = useState(false);
  const isFocus = (d: Drop) => focusDropId?.toLowerCase() === d.dropId.toLowerCase();
  // Linked drop first, then drops still to mint, then minted ones (kept so the tx stays visible).
  const rank = (d: Drop) => (isFocus(d) ? 0 : d.status === "minted" ? 2 : 1);
  const sorted = [...(data?.drops ?? [])].sort((a, b) => rank(a) - rank(b));
  const list = showAll ? sorted : sorted.slice(0, COLLAPSED_COUNT);
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
              focused={isFocus(d)}
              mintedTx={d.status === "minted" ? (d.txHash ?? "") : undefined}
            />
          ))}
        </ul>
      )}
      {sorted.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-bold text-clay-deep underline hover:text-clay"
        >
          {showAll ? "Show fewer" : `Show all ${sorted.length} drops`}
        </button>
      ) : null}
    </section>
  );
}

function DropCard({
  address,
  dropId,
  itemId,
  rarity,
  focused,
  mintedTx,
}: {
  address: Hex;
  dropId: Hex;
  itemId?: number;
  rarity?: string;
  focused?: boolean;
  /** Set when the game already records this drop as minted ("" if the tx hash is unknown). */
  mintedTx?: string;
}) {
  const config = useConfig();
  const flight = useSingleFlight();
  const blocked = useTxBlocked();
  const queryClient = useQueryClient();
  const [state, setState] = useState<MintState>({ kind: "idle" });
  const ref = useRef<HTMLLIElement>(null);
  const info = itemId ? itemInfo(itemId) : { name: "Drop from the game", kind: "Unknown drop", glyph: "🎁", tone: "from-bark-soft to-bark" };

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focused]);

  // One mint flow at a time per card; a double click can't send two transactions.
  const mint = () => flight.run(doMint);

  async function doMint() {
    try {
      // Prove this wallet is asking (single-use signature), so nobody else can spend its daily mints.
      setState({ kind: "busy", step: "Sign the mint request in your wallet…" });
      const nonce = randomNonce();
      const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
      const signature: Hex = await signMessage(config, {
        account: address,
        message: ownershipMessage({ purpose: "mint-rare-drop", address, dropId, nonce, expiresAt }),
      });

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

      const v = body.voucher;
      if (Number(v.deadline) <= Math.floor(Date.now() / 1000) + 30) {
        setState({ kind: "rejected", source: "server", code: "VoucherExpired", reason: CONTRACT_REASONS.VoucherExpired });
        return;
      }
      setState({ kind: "busy", step: "Confirm the mint in your wallet…" });
      const receipt = await runTx(config, address, {
        address: body.rareItems,
        abi: rareItemsAbi,
        functionName: "mintWithVoucher",
        args: [
          { to: v.to, itemId: BigInt(v.itemId), amount: BigInt(v.amount), dropId: v.dropId, deadline: BigInt(v.deadline) },
          body.signature,
        ],
        revertHint: "The voucher probably expired or the drop was minted elsewhere. Press Mint again.",
      });
      setState({ kind: "busy", step: "Recording the mint…" });
      // The mint is onchain either way; if recording fails the server heals it on the next read.
      await fetch("/api/voucher/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, dropId, txHash: receipt.transactionHash }),
      }).catch(() => undefined);
      setState({ kind: "minted", txHash: receipt.transactionHash });
    } catch (err) {
      const { message, errorName } = describeError(err);
      setState({ kind: "rejected", source: errorName ? "contract" : "wallet", code: errorName, reason: message });
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["market-drops"] });
      void queryClient.invalidateQueries({ queryKey: ["market-balances"] });
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
        <ItemArt info={info} />
        <div className="min-w-0">
          <ItemTitle info={info} />
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

      {state.kind === "minted" || (mintedTx !== undefined && state.kind !== "busy") ? (
        <p className="rounded-2xl border-2 border-field/40 bg-field/10 px-4 py-3 text-sm font-bold text-field-deep">
          Minted as ERC-1155 ✓{" "}
          {(state.kind === "minted" ? state.txHash : mintedTx) ? (
            <a
              className="font-normal underline"
              href={txUrl(state.kind === "minted" ? state.txHash : mintedTx!)}
              target="_blank"
              rel="noreferrer"
            >
              view tx ↗
            </a>
          ) : null}
        </p>
      ) : (
        <button
          type="button"
          onClick={mint}
          disabled={state.kind === "busy" || blocked}
          className="rounded-full bg-clay px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-clay-deep disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state.kind === "busy"
            ? state.step
            : blocked
              ? WRONG_CHAIN_LABEL
              : state.kind === "rejected"
                ? "Try mint again"
                : "Mint as NFT"}
        </button>
      )}
    </li>
  );
}
