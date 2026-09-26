"use client";

import { useEffect, useState } from "react";

/** Clipboard with a graceful legacy fallback; resolves false when unavailable. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * In-browser signature proof: recovers the EIP-712 signer from the
 * attestation's stored values + the signature decoded out of the relayer's
 * onchain calldata — runs in the visitor's browser, not on our server.
 */
export function SignatureVerify({
  domain,
  types,
  primaryType,
  message,
  signature,
  expected,
  label,
}: {
  domain: { name: string; version: string; chainId: string; verifyingContract: string };
  types: readonly { readonly name: string; readonly type: string }[];
  primaryType: string;
  message: Record<string, string>;
  signature: string;
  expected: string;
  label: string;
}) {
  const [state, setState] = useState<"checking" | "ok" | "fail">("checking");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { recoverTypedDataAddress } = await import("viem");
        const recovered = await recoverTypedDataAddress({
          domain: { ...domain, chainId: BigInt(domain.chainId), verifyingContract: domain.verifyingContract as `0x${string}` },
          types: { [primaryType]: types },
          primaryType,
          message,
          signature: signature as `0x${string}`,
        } as never);
        if (alive) setState(recovered.toLowerCase() === expected.toLowerCase() ? "ok" : "fail");
      } catch {
        if (alive) setState("fail");
      }
    })();
    return () => { alive = false; };
  }, [domain, types, primaryType, message, signature, expected]);

  if (state === "checking") {
    return <span className="text-[11px] uppercase tracking-wider opacity-60">verifying signature…</span>;
  }
  if (state === "fail") {
    return <span className="font-bold">✗ signature mismatch — do not trust this record</span>;
  }
  const short = `${expected.slice(0, 6)}…${expected.slice(-4)}`;
  return (
    <>
      <span className="text-base font-bold">✓</span>
      <span>
        {label} recovered to <strong className="font-mono">{short}</strong> — the Ninlanee Farm key
      </span>
      <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">verified in your browser via EIP-712</span>
    </>
  );
}

/**
 * Hero proof row: one onchain fact, a Sepolia chip, an Etherscan link and a
 * copy button. Client-side only for the copy interaction.
 */
export function ProofRow({
  label,
  value,
  href,
  copy,
}: {
  label: string;
  value: string;
  href?: string;
  copy?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-emerald-800/10 py-1.5 last:border-b-0">
      <span className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-emerald-900/70">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-emerald-950" title={value}>
        {href ? (
          <a
            className="underline decoration-emerald-600/50 decoration-2 underline-offset-2 hover:decoration-emerald-800"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            {value} ↗
          </a>
        ) : (
          value
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          copyText(copy ?? value).then((ok) => {
            setCopied(ok);
            if (ok) setTimeout(() => setCopied(false), 1200);
          });
        }}
        className="shrink-0 rounded border border-emerald-800/20 bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900 transition hover:bg-white"
        aria-label={`Copy ${label}`}
      >
        {copied ? "copied ✓" : "copy"}
      </button>
    </div>
  );
}
