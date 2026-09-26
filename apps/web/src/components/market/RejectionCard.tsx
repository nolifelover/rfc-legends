// The "rejected" path World wants to see: which check failed, and why, in plain words.

export function RejectionCard({
  title = "Rejected",
  code,
  reason,
  source,
  onDismiss,
  action,
}: {
  title?: string;
  code?: string;
  reason: string;
  /** Who refused: our game server (after World ID) or the contract itself. */
  source: "server" | "contract" | "wallet" | "precheck";
  onDismiss?: () => void;
  /** Optional next step offered right in the card (e.g. the USDC faucet). */
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  const by = {
    server: "Refused by the game server's mint checks",
    contract: "Refused onchain by the contract",
    wallet: "Stopped in your wallet",
    precheck: "Checked before sending: nothing was sent",
  }[source];
  return (
    <div role="alert" className="rounded-2xl border-2 border-clay/60 bg-clay/10 px-4 py-3 text-sm text-clay-deep">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold">
          <span aria-hidden className="mr-1.5">⛔</span>
          {title}
        </p>
        {code ? <code className="shrink-0 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px]">{code}</code> : null}
      </div>
      <p className="mt-1 leading-relaxed break-words [overflow-wrap:anywhere] text-bark">{reason}</p>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="mt-2 rounded-full bg-field px-3 py-1.5 text-xs font-bold text-cream hover:bg-field-deep disabled:opacity-60"
        >
          {action.label}
        </button>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-bark-soft">
        <span>{by}</span>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="underline hover:text-bark">
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
