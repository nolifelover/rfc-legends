import Link from "next/link";
import { sireLineInfo } from "@/lib/ens/resolve";
import type { RoosterSummary } from "@/lib/ens/resolve";

const LINE_GRADIENTS: Record<string, string> = {
  kumarnjeen: "from-amber-300 to-orange-400",
  kingkong: "from-stone-400 to-stone-600",
  chaokhunthong: "from-yellow-300 to-amber-500",
  thepbut: "from-sky-300 to-indigo-400",
  raptor: "from-emerald-300 to-teal-500",
};

export function RwaCard({ rooster }: { rooster: RoosterSummary }) {
  const line = sireLineInfo(rooster.sireLine ?? "");
  const gradient = LINE_GRADIENTS[rooster.sireLine ?? ""] ?? "from-amber-200 to-orange-300";
  const label = rooster.name.replace(/\.eth$/, "").split(".")[0];
  const hatched = rooster.hatchedAt ? new Date(Number(rooster.hatchedAt) * 1000).getFullYear() : null;

  return (
    <Link
      href={`/roosters/${encodeURIComponent(rooster.name)}`}
      className="group block overflow-hidden rounded-2xl border border-clay/20 bg-cream shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className={`relative flex h-36 items-center justify-center bg-gradient-to-br ${gradient}`}>
        <span className="text-6xl drop-shadow-sm transition group-hover:scale-110">🐓</span>
        <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bark">
          Mythic · RWA
        </span>
        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          ✓ Verified
        </span>
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-bold text-bark">
            {rooster.displayName ?? label}
          </h3>
          {line ? <span className="text-xs text-bark-soft">{line.roman} {line.thai}</span> : null}
        </div>
        <p className="font-mono text-xs text-bark-soft">{rooster.ringId ?? "—"}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {rooster.weight ? (
            <span className="rounded bg-sun-soft px-1.5 py-0.5 font-medium text-bark">{rooster.weight} g</span>
          ) : null}
          {rooster.health ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">health {rooster.health}</span>
          ) : null}
          {hatched && hatched > 1970 ? <span className="text-bark-soft">hatched {hatched}</span> : null}
          {rooster.offspringNames.length > 0 ? (
            <span className="rounded bg-clay/15 px-1.5 py-0.5 font-medium text-bark">
              {rooster.offspringNames.length} offspring
            </span>
          ) : null}
        </div>
        <p className="truncate font-mono text-[10px] text-bark-soft/70">{rooster.name}</p>
      </div>
    </Link>
  );
}
