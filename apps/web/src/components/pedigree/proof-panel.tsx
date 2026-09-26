"use client";

import { useState } from "react";

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
