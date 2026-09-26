import type { Metadata } from "next";
import { RwaCard } from "@/components/pedigree/rwa-card";
import { ensClient, listRoosters, PARENT_NAME } from "@/lib/ens/resolve";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roosters — RFC Legends",
  description: "Real Thai gamefowl from Ninlanee Farm as RWA cards, with onchain ENSv2 pedigree.",
};

export default async function RoostersPage() {
  const client = ensClient();
  const roosters = await listRoosters(client);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-bark">Roosters of Ninlanee Farm</h1>
        <p className="mt-2 max-w-2xl text-sm text-bark-soft">
          Each card is one real bird — a Thai native breed raised at Ninlanee Farm — minted as an
          RWA with its pedigree written straight into the ENSv2 hierarchy on Sepolia
          (<span className="font-mono text-xs">{PARENT_NAME}</span>). Weight and health records are
          attested weekly by the farm&apos;s key and can only be written by that key.
        </p>
        <div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <strong>Sample data</strong> — placeholder ring IDs until Ninlanee Farm&apos;s real records
          arrive. The onchain pedigree structure, permissions and attestation flow are live.
        </div>
      </header>

      {roosters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-clay/30 p-10 text-center text-sm text-bark-soft">
          No roosters found under <span className="font-mono">{PARENT_NAME}</span> yet — run the ENS
          seed scripts (<span className="font-mono">ens/scripts/setup-parent.ts</span> →{" "}
          <span className="font-mono">seed.ts</span>).
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {roosters.map((r) => (
            <RwaCard key={r.name} rooster={r} />
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-bark-soft/70">
        Names resolve live through the ENSv2 Universal Resolver ·{" "}
        <a className="underline" href={`https://app.ens.dev/name/${PARENT_NAME}`} target="_blank" rel="noreferrer">
          view {PARENT_NAME} in the ENS app ↗
        </a>
      </p>
    </main>
  );
}
