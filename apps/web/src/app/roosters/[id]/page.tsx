import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PedigreeTree, SireLineBadge } from "@/components/pedigree/pedigree-tree";
import {
  ENS_APP, ETHERSCAN, ensClient, getAttestation, getRoosterByTokenId, getRoosterRecords,
  listOffspring, nameExists, pedigreeOf, roosterRwaAbi, PARENT_NAME,
} from "@/lib/ens/resolve";
import { getAddresses } from "@/lib/contracts/addresses";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const name = await resolveName(decoded);
  return { title: name ? `${name} — RFC Legends` : "Rooster — RFC Legends" };
}

/** id is either a RoosterRWA tokenId (once minted) or a full ENS name (ENS-only demo mode). */
async function resolveName(id: string): Promise<string | null> {
  const client = ensClient();
  if (/^\d+$/.test(id)) {
    try {
      const { RoosterRWA } = getAddresses(11155111);
      const r = await getRoosterByTokenId(client, RoosterRWA as `0x${string}`, BigInt(id));
      return r?.ensName ?? null;
    } catch { return null; }
  }
  const name = id.endsWith(".eth") ? id : `${id}.${PARENT_NAME}`;
  return (await nameExists(client, name)) ? name : null;
}

export default async function RoosterDetailPage({ params }: Props) {
  const { id } = await params;
  const name = await resolveName(decodeURIComponent(id));
  if (!name) notFound();

  const client = ensClient();
  const recs = await getRoosterRecords(client, name);
  const { sire } = pedigreeOf(name);
  const offspring = await listOffspring(client, name);

  // dam comes from the contract's pedigree (damTokenId -> that bird's ENS name)
  let dam: string | null = null;
  try {
    const rwaAddr = recs.contract && /^0x[0-9a-fA-F]{40}$/.test(recs.contract)
      ? recs.contract
      : getAddresses(11155111).RoosterRWA;
    if (recs.tokenId && /^\d+$/.test(recs.tokenId)) {
      const damId = await client.readContract({
        address: rwaAddr as `0x${string}`, abi: roosterRwaAbi, functionName: "roosters", args: [BigInt(recs.tokenId)],
      }).then((r) => r[5]).catch(() => 0n);
      if (damId && damId > 0n) {
        dam = (await client.readContract({
          address: rwaAddr as `0x${string}`, abi: roosterRwaAbi, functionName: "roosters", args: [damId],
        }).then((r) => r[6]).catch(() => null)) ?? null;
      }
    }
  } catch { /* contracts pending — dam simply unknown */ }

  // contract-side attestation when the NFT is minted
  let attestation: Awaited<ReturnType<typeof getAttestation>> = null;
  let rwaAddress: string | null = null;
  try {
    rwaAddress = recs.contract && /^0x[0-9a-fA-F]{40}$/.test(recs.contract)
      ? recs.contract
      : getAddresses(11155111).RoosterRWA;
    if (recs.tokenId && /^\d+$/.test(recs.tokenId)) {
      attestation = await getAttestation(client, rwaAddress as `0x${string}`, BigInt(recs.tokenId));
    }
  } catch { /* contracts not deployed yet — ENS-only mode */ }

  const short = name.replace(/\.eth$/, "").split(".")[0];

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
      <nav className="mb-6 text-sm">
        <Link href="/roosters" className="text-bark-soft underline">← All roosters</Link>
      </nav>

      <div className="rounded-2xl border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <strong>Sample data</strong> — placeholder ring ID until Ninlanee Farm&apos;s real records arrive.
      </div>

      <section className="mt-6 grid gap-8 md:grid-cols-[280px_1fr]">
        {/* RWA card */}
        <div className="overflow-hidden rounded-2xl border border-clay/20 bg-cream shadow-sm">
          <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-amber-300 to-orange-400">
            <span className="text-8xl drop-shadow-sm">🐓</span>
            <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bark">
              Mythic · RWA
            </span>
            <span className="absolute right-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              ✓ Verified
            </span>
          </div>
          <div className="space-y-2 p-4">
            <h1 className="text-xl font-bold text-bark">{recs.displayName ?? short}</h1>
            <SireLineBadge slug={recs.sireLine} />
            <dl className="space-y-1 font-mono text-xs text-bark-soft">
              <div className="flex justify-between gap-2"><dt>ring ID</dt><dd className="text-bark">{recs.ringId ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt>hatched</dt><dd>{recs.hatchedAt ? new Date(Number(recs.hatchedAt) * 1000).toISOString().slice(0, 10) : "—"}</dd></div>
              {recs.tokenId && /^\d+$/.test(recs.tokenId) ? (
                <div className="flex justify-between gap-2"><dt>token</dt><dd className="text-bark">#{recs.tokenId}</dd></div>
              ) : null}
            </dl>
          </div>
        </div>

        <div className="space-y-6">
          {/* attestation */}
          <section className="rounded-2xl border border-clay/20 bg-cream p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-bark">
              🩺 Latest farm attestation
            </h2>
            {attestation ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-sun-soft p-3">
                    <div className="text-2xl font-bold text-bark">{attestation.weightGrams}<span className="text-sm"> g</span></div>
                    <div className="text-[10px] uppercase tracking-wider text-bark-soft">weight</div>
                  </div>
                  <div className="rounded-xl bg-emerald-100 p-3">
                    <div className="text-2xl font-bold text-emerald-800">{attestation.healthScore}<span className="text-sm">/100</span></div>
                    <div className="text-[10px] uppercase tracking-wider text-emerald-800/70">health</div>
                  </div>
                  <div className="rounded-xl bg-sky-100 p-3">
                    <div className="text-sm font-bold text-sky-900">
                      {new Date(Number(attestation.checkedAt) * 1000).toISOString().slice(0, 10)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-sky-900/70">checked</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-bark-soft">
                  <span className="rounded-full border border-clay/20 px-2 py-0.5">signed by farm key{" "}
                    <a className="font-mono underline" href={ETHERSCAN(attestation.farmSigner)} target="_blank" rel="noreferrer">
                      {attestation.farmSigner.slice(0, 8)}…{attestation.farmSigner.slice(-4)}
                    </a>
                  </span>
                  <span className="text-bark-soft/60">EIP-712 · nonce {attestation.nonce.toString()}</span>
                  {attestation.note ? <span className="italic">“{attestation.note}”</span> : null}
                </div>
                <div className="rounded-lg bg-bark/5 p-2.5 text-[11px] leading-relaxed text-bark-soft">
                  <strong className="text-bark">Trust split:</strong> RFC Club issues the card, but only
                  Ninlanee Farm&apos;s key can attest health — on the contract (EIP-712 signature) and on ENS
                  (scoped resolver roles). Neither party can fake the other&apos;s part.
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-bark-soft">
                <p>ENS-side records (written only by the farm key):</p>
                <div className="flex gap-3 text-center font-mono text-xs">
                  <div className="flex-1 rounded-xl bg-sun-soft p-3"><span className="block text-xl font-bold text-bark">{recs.weight ?? "—"}</span> g weight</div>
                  <div className="flex-1 rounded-xl bg-emerald-100 p-3"><span className="block text-xl font-bold text-emerald-800">{recs.health ?? "—"}</span> health</div>
                  <div className="flex-1 rounded-xl bg-sky-100 p-3"><span className="block text-sm font-bold text-sky-900 pt-1.5">{recs.attestedAt ? new Date(Number(recs.attestedAt) * 1000).toISOString().slice(0, 10) : "—"}</span> checked</div>
                </div>
                {recs.tokenId !== null && recs.contract === "pending-deployment" ? (
                  <p className="text-xs text-bark-soft/70">RoosterRWA not deployed yet — attestation shown from ENS text records.</p>
                ) : null}
              </div>
            )}
          </section>

          {/* pedigree */}
          <section className="rounded-2xl border border-clay/20 bg-cream p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-bark">
              🌳 Pedigree <span className="text-xs font-normal text-bark-soft">(resolved live from ENSv2 — the name hierarchy is the family tree)</span>
            </h2>
            <PedigreeTree name={name} sire={sire} dam={dam} offspring={offspring} parentExists={(n) => nameExists(client, n)} />
          </section>

          {/* links */}
          <section className="flex flex-wrap gap-2 text-xs">
            <a className="rounded-full border border-clay/30 bg-cream px-3 py-1.5 font-medium text-bark underline-offset-2 hover:underline" href={ENS_APP(name)} target="_blank" rel="noreferrer">
              ENS app ↗
            </a>
            {rwaAddress && recs.tokenId && /^\d+$/.test(recs.tokenId) ? (
              <a className="rounded-full border border-clay/30 bg-cream px-3 py-1.5 font-medium text-bark underline-offset-2 hover:underline" href={ETHERSCAN(rwaAddress, "token")} target="_blank" rel="noreferrer">
                Etherscan token #{recs.tokenId} ↗
              </a>
            ) : null}
            {recs.contract && /^0x/.test(recs.contract) ? (
              <a className="rounded-full border border-clay/30 bg-cream px-3 py-1.5 font-mono text-bark underline-offset-2 hover:underline" href={ETHERSCAN(recs.contract)} target="_blank" rel="noreferrer">
                RoosterRWA {recs.contract.slice(0, 6)}…{recs.contract.slice(-4)} ↗
              </a>
            ) : null}
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 font-medium text-emerald-800">
              records above = live getEnsText reads
            </span>
          </section>
        </div>
      </section>
    </main>
  );
}
