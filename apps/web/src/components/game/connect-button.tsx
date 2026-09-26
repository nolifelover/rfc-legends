"use client";

import { useSyncExternalStore } from "react";
import {
  ConnectorNotFoundError,
  ProviderNotFoundError,
  useConnect,
  useConnectors,
  useConnection,
  useDisconnect,
} from "wagmi";

function hasInjectedProvider() {
  return typeof (window as { ethereum?: unknown }).ethereum !== "undefined";
}

const noopSubscribe = () => () => {};
// Optimistic on the server (assume a wallet exists) so the "install MetaMask"
// hint never flashes for users who have one; the client snapshot is the truth.
const useHasInjectedWallet = () =>
  useSyncExternalStore(
    noopSubscribe,
    hasInjectedProvider,
    () => true,
  );

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function ConnectButton({ className = "" }: { className?: string }) {
  const { address, isConnected } = useConnection();
  const connectors = useConnectors();
  const { mutate: connect, isPending, error } = useConnect();
  const { mutate: disconnect } = useDisconnect();

  const hasWallet = useHasInjectedWallet();
  const connector = connectors.find((c) => c.id === "injected");
  const walletMissing =
    !isConnected &&
    (!hasWallet ||
      error instanceof ProviderNotFoundError ||
      error instanceof ConnectorNotFoundError);

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        title="Click to disconnect your wallet"
        className={`inline-flex items-center gap-2 rounded-full bg-field px-4 py-2 text-sm font-bold text-cream shadow-sm transition hover:bg-field-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-field ${className}`}
      >
        <span aria-hidden className="h-2 w-2 rounded-full bg-sun" />
        <span className="font-mono tracking-tight">{truncateAddress(address)}</span>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={isPending || !connector}
        onClick={() => connector && connect({ connector })}
        className={`inline-flex items-center gap-2 rounded-full border-2 border-clay/40 bg-cream px-4 py-2 text-sm font-bold text-clay-deep transition hover:border-clay hover:bg-sun-soft/60 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${className}`}
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {walletMissing ? (
        <span className="text-xs text-bark-soft">
          Install MetaMask or open in a browser wallet
        </span>
      ) : null}
    </span>
  );
}
