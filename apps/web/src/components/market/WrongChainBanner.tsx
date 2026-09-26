"use client";

// Shown while the connected wallet is on another chain. Every tx button is
// disabled through TxBlockedContext until the wallet switches to Sepolia.

import { useState } from "react";
import { sepolia } from "viem/chains";
import { useConfig } from "wagmi";
import { switchChain } from "wagmi/actions";
import { describeError } from "./errors";

export function WrongChainBanner({ chainId }: { chainId: number }) {
  const config = useConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-clay/50 bg-clay/10 px-4 py-3 text-sm text-clay-deep">
      <p>
        <b>Wrong network.</b> Your wallet is on chain {chainId}; the Rare Market runs on <b>Sepolia</b> ({sepolia.id}).
        Minting, listing and buying are paused until you switch.
        {error ? <span className="mt-1 block text-bark">{error}</span> : null}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await switchChain(config, { chainId: sepolia.id });
          } catch (err) {
            setError(describeError(err).message);
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full bg-clay px-4 py-2 font-bold text-cream hover:bg-clay-deep disabled:opacity-60"
      >
        {busy ? "Switching…" : "Switch to Sepolia"}
      </button>
    </div>
  );
}
