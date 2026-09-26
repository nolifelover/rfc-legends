import Link from "next/link";
import { sireLineInfo } from "@/lib/ens/resolve";

/**
 * Live pedigree tree: sire ↑ above, offspring ↓ below. Every node is an ENS
 * name resolved from Sepolia — the hierarchy IS the family tree
 * (chick01.theprawang.rfclegends.eth means "chick01, child of theprawang").
 */
export function PedigreeTree({
  name,
  sire,
  offspring,
  sireExists,
}: {
  name: string;
  sire: string | null;
  offspring: string[];
  sireExists: boolean;
}) {
  const short = (n: string) => n.replace(/\.eth$/, "");
  return (
    <div className="flex flex-col items-center gap-4">
      {sire && sireExists ? (
        <div className="flex flex-col items-center">
          <Link
            href={`/roosters/${encodeURIComponent(sire)}`}
            className="rounded-xl border-2 border-clay/30 bg-cream px-4 py-2 text-center transition hover:border-clay"
          >
            <span className="text-sm font-bold text-bark">▲ {short(sire).split(".")[0]}</span>
            <span className="block font-mono text-[10px] text-bark-soft">{sire}</span>
          </Link>
          <span className="text-bark-soft">│</span>
        </div>
      ) : null}

      <div className="rounded-xl border-2 border-sun bg-sun-soft px-5 py-2.5 text-center shadow-sm">
        <span className="font-bold text-bark">{short(name).split(".")[0]}</span>
        <span className="block font-mono text-[10px] text-bark-soft">{name}</span>
        <span className="mt-0.5 inline-block rounded bg-bark/80 px-1.5 text-[9px] font-bold uppercase tracking-wider text-cream">
          this bird
        </span>
      </div>

      {offspring.length > 0 ? (
        <div className="flex w-full flex-col items-center">
          <span className="text-bark-soft">│</span>
          <div className="flex flex-wrap items-start justify-center gap-3">
            {offspring.map((child) => {
              const label = short(child).split(".")[0];
              return (
                <Link
                  key={child}
                  href={`/roosters/${encodeURIComponent(child)}`}
                  className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3.5 py-2 text-center transition hover:border-emerald-500"
                >
                  <span className="text-sm font-bold text-bark">▼ {label}</span>
                  <span className="block font-mono text-[10px] text-bark-soft">{child}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-bark-soft">No offspring registered under this sire yet.</p>
      )}
    </div>
  );
}

export function SireLineBadge({ slug }: { slug: string | null }) {
  const line = sireLineInfo(slug ?? "");
  if (!line) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-clay/30 bg-cream px-2.5 py-0.5 text-xs font-medium text-bark">
      <span>{line.emoji}</span> {line.roman} <span className="text-bark-soft">{line.thai}</span>
    </span>
  );
}
