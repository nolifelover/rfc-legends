"use client";

// World ID gate for the drop economy. States a viewer can see:
//   checking status → not verified → (widget) → verifying → verified ✓
//                                              ↘ rejected (server reason) / cancelled
// Rejections come from our own server, which verifies the proof with World and
// enforces one human = one wallet, so the reason shown is the real one.

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { IDKitErrorCodes, IDKitResult } from "@worldcoin/idkit";
import {
  fetchRpContext,
  humanStatusKey,
  shortAddress,
  txUrl,
  useHumanStatus,
} from "@/lib/worldid/client";
import type { RpContextResponse, VerifyResponse } from "@/lib/worldid/types";

const WorldIdWidget = dynamic(() => import("./WorldIdWidget"), { ssr: false });

type Phase =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "scanning"; ctx: RpContextResponse }
  | { kind: "verifying"; ctx: RpContextResponse }
  | { kind: "verified"; res: Extract<VerifyResponse, { verified: true }> }
  | { kind: "rejected"; code: string; reason: string }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

type Rejection = Extract<VerifyResponse, { verified: false }>;

export type VerifyHumanProps = {
  address?: `0x${string}`;
  onVerified?: () => void;
  className?: string;
};

export function VerifyHuman({ address, onVerified, className = "" }: VerifyHumanProps) {
  const queryClient = useQueryClient();
  const status = useHumanStatus(address);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const rejection = useRef<Rejection | null>(null);
  const accepted = useRef<Extract<VerifyResponse, { verified: true }> | null>(null);

  // Reset when the wallet changes (derived-state pattern, no effect needed).
  const [seenAddress, setSeenAddress] = useState(address);
  if (seenAddress !== address) {
    setSeenAddress(address);
    setPhase({ kind: "idle" });
    setOpen(false);
  }

  async function start() {
    if (!address) return;
    rejection.current = null;
    accepted.current = null;
    setPhase({ kind: "starting" });
    try {
      // Fresh RP signature every time: it expires after a few minutes.
      const ctx = await fetchRpContext(address);
      setPhase({ kind: "scanning", ctx });
      setOpen(true);
    } catch (err) {
      setPhase({ kind: "error", message: err instanceof Error ? err.message : "Couldn't start verification" });
    }
  }

  async function handleVerify(result: IDKitResult) {
    setPhase((p) => (p.kind === "scanning" ? { kind: "verifying", ctx: p.ctx } : p));
    const res = await fetch("/api/worldid/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, result }),
    });
    const body = (await res.json().catch(() => null)) as VerifyResponse | null;
    if (!res.ok || !body?.verified) {
      rejection.current =
        body && !body.verified
          ? body
          : { verified: false, code: "invalid_request", reason: `Verification failed (HTTP ${res.status}).` };
      setPhase({ kind: "rejected", code: rejection.current.code, reason: rejection.current.reason });
      setOpen(false);
      // Throwing fails the IDKit flow; handleError then closes it so our reason is what's on screen.
      throw new Error(rejection.current.reason);
    }
    accepted.current = body;
    setPhase({ kind: "verified", res: body });
    setOpen(false);
    void queryClient.invalidateQueries({ queryKey: humanStatusKey(address) });
    onVerified?.();
  }

  function handleSuccess() {
    // State already moved to "verified" in handleVerify; IDKit auto-closes its success screen.
  }

  function handleError(code: IDKitErrorCodes) {
    setOpen(false);
    if (rejection.current || accepted.current) {
      return;
    } else if (code === "user_rejected" || code === "cancelled") {
      setPhase({ kind: "cancelled" });
    } else if (code === "max_verifications_reached") {
      setPhase({
        kind: "rejected",
        code,
        reason: "World says this World ID has already been used for this action. One human, one wallet.",
      });
    } else {
      setPhase({ kind: "error", message: `World ID error: ${code}` });
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // Closing the widget before a proof arrived = cancelled.
    if (!next) setPhase((p) => (p.kind === "scanning" ? { kind: "cancelled" } : p));
  }

  const ctx = phase.kind === "scanning" || phase.kind === "verifying" ? phase.ctx : null;
  const alreadyVerified = status.data?.verified && phase.kind !== "rejected";

  return (
    <section
      aria-live="polite"
      className={`rounded-3xl border-2 border-clay/20 bg-cream p-5 shadow-sm ${className}`}
      data-worldid-state={alreadyVerified ? "verified" : phase.kind}
    >
      <header className="mb-3 flex items-center gap-2">
        <WorldMark />
        <h3 className="text-base font-bold text-bark">World ID · proof of human</h3>
      </header>

      {!address ? (
        <p className="text-sm text-bark-soft">Connect a wallet to verify you&apos;re a unique human.</p>
      ) : phase.kind === "verified" || (alreadyVerified && phase.kind === "idle") ? (
        <Verified
          address={address}
          txHash={phase.kind === "verified" ? phase.res.txHash : (status.data?.txHash ?? null)}
          note={phase.kind === "verified" ? phase.res.onchainNote : undefined}
          onchain={status.data?.onchain ?? null}
        />
      ) : status.isLoading ? (
        <p className="text-sm text-bark-soft">Checking World ID status…</p>
      ) : (
        <>
          {phase.kind === "rejected" ? (
            <Banner tone="bad" title="Rejected" code={phase.code}>
              <p>{phase.reason}</p>
            </Banner>
          ) : phase.kind === "cancelled" ? (
            <Banner tone="muted" title="Cancelled">
              <p>Verification was closed before it finished. Nothing was recorded.</p>
            </Banner>
          ) : phase.kind === "error" ? (
            <Banner tone="bad" title="Something went wrong">
              <p>{phase.message}</p>
            </Banner>
          ) : (
            <Banner tone="muted" title="Not verified">
              <p>
                Rare drops can only be minted and sold by verified humans. One World ID can back one wallet, so
                bot farms can&apos;t cash out drops.
              </p>
            </Banner>
          )}

          <button
            type="button"
            onClick={start}
            disabled={phase.kind === "starting" || phase.kind === "scanning" || phase.kind === "verifying"}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-bark px-5 py-3 text-sm font-bold text-cream transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bark"
          >
            <WorldMark light />
            {phase.kind === "starting"
              ? "Preparing request…"
              : phase.kind === "scanning"
                ? "Waiting for World App…"
                : phase.kind === "verifying"
                  ? "Verifying proof & recording onchain…"
                  : phase.kind === "idle"
                    ? "Verify with World ID"
                    : "Try again"}
          </button>
          {ctx?.environment === "staging" ? (
            <p className="mt-2 text-center text-xs text-bark-soft">
              Staging: scan the QR with the{" "}
              <a className="underline" href="https://simulator.worldcoin.org" target="_blank" rel="noreferrer">
                World ID simulator
              </a>
              .
            </p>
          ) : null}
        </>
      )}

      {ctx ? (
        <WorldIdWidget
          ctx={ctx}
          open={open}
          onOpenChange={handleOpenChange}
          handleVerify={handleVerify}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      ) : null}
    </section>
  );
}

function Verified({
  address,
  txHash,
  note,
  onchain,
}: {
  address: string;
  txHash: string | null;
  note?: string;
  onchain: boolean | null;
}) {
  return (
    <Banner tone="good" title="Verified human ✓">
      <p>
        Wallet <span className="font-mono">{shortAddress(address)}</span> is bound to one World ID. It can mint and
        sell rare drops.
      </p>
      <p className="mt-1 text-xs opacity-80">
        {txHash ? (
          <a className="underline" href={txUrl(txHash)} target="_blank" rel="noreferrer">
            HumanRegistry.markVerified tx ↗
          </a>
        ) : onchain ? (
          "Recorded in HumanRegistry onchain."
        ) : (
          (note ?? "Verified by the game server.")
        )}
      </p>
    </Banner>
  );
}

function Banner({
  tone,
  title,
  code,
  children,
}: {
  tone: "good" | "bad" | "muted";
  title: string;
  code?: string;
  children: React.ReactNode;
}) {
  const styles = {
    good: "border-field/40 bg-field/10 text-field-deep",
    bad: "border-clay/50 bg-clay/10 text-clay-deep",
    muted: "border-bark-soft/30 bg-sun-soft/30 text-bark",
  }[tone];
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 text-sm ${styles}`} role={tone === "bad" ? "alert" : undefined}>
      <p className="flex items-center justify-between gap-2 font-bold">
        <span>{title}</span>
        {code ? <code className="rounded bg-black/5 px-1.5 py-0.5 text-[11px] font-mono font-normal">{code}</code> : null}
      </p>
      <div className="mt-1 leading-relaxed">{children}</div>
    </div>
  );
}

function WorldMark({ light = false }: { light?: boolean }) {
  // Generic "orb" glyph (not World's logo).
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" className={light ? "text-cream" : "text-bark"}>
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  );
}
