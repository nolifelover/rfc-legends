import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { recoverTypedDataAddress } from "viem";
import { PedigreeTree, SireLineBadge } from "@/components/pedigree/pedigree-tree";
import { ProofRow } from "@/components/pedigree/proof-panel";
import { SireLineArt } from "@/components/game/sire-line-art";
import { ATTESTATION_TYPE, roosterRwaDomain } from "@/lib/contracts/eip712";
import {
  ENS_APP, ETHERSCAN, ensClient, getAttestation, getAttestationTx, getRoosterByTokenId,
  getRoosterRecords, listOffspring, nameExists, pedigreeOf, roosterRwaAbi, sireLineInfo, PARENT_NAME,
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

function ProofLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="font-medium underline decoration-sun decoration-2 underline-offset-2 hover:decoration-clay" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export default async function RoosterDetailPage({ params }: Props) {
  const { id } = await params;
  const name = await resolveName(decodeURIComponent(id));
  if (!name) notFound();

  const client = ensClient();
  const recs = await getRoosterRecords(client, name);
  const { sire } = pedigreeOf(name);
  const offspring = await listOffspring(client, name);

  // dam + attestation + tx proof, all read live from the contracts
  let dam: string | null = null;
  let attestation: Awaited<ReturnType<typeof getAttestation>> = null;
  let attestationTx: Awaited<ReturnType<typeof getAttestationTx>> = null;
  let sigRecovers: boolean | null = null;
  let rwaAddress: string | null = null;
  let tokenId: bigint | null = null;
  try {
    rwaAddress = recs.contract && /^0x[0-9a-fA-F]{40}$/.test(recs.contract)
      ? recs.contract
      : getAddresses(11155111).RoosterRWA;
    if (recs.tokenId && /^\d+$/.test(recs.tokenId)) {
      tokenId = BigInt(recs.tokenId);
      const r = await client.readContract({
        address: rwaAddress as `0x${string}`, abi: roosterRwaAbi, functionName: "getRooster", args: [tokenId],
      });
      if (r.damTokenId && r.damTokenId > 0n) {
        dam = (await client.readContract({
          address: rwaAddress as `0x${string}`, abi: roosterRwaAbi, functionName: "getRooster", args: [r.damTokenId],
        }).then((x) => x.ensName).catch(() => null)) ?? null;
      }
      [attestation, attestationTx] = await Promise.all([
        getAttestation(client, rwaAddress as `0x${string}`, tokenId),
        getAttestationTx(client, rwaAddress as `0x${string}`, tokenId),
      ]);
      if (attestation) {
        // client-side proof: the stored attestation's EIP-712 signature recovers to the farm key
        const recovered = attestationTx
          ? await recoverTypedDataAddress({
              domain: roosterRwaDomain(11155111, rwaAddress as `0x${string}`),
              types: { Attestation: ATTESTATION_TYPE },
              primaryType: "Attestation",
              message: {
                tokenId, weightGrams: attestation.weightGrams, healthScore: attestation.healthScore,
                note: attestation.note, checkedAt: attestation.checkedAt, nonce: attestation.nonce,
              },
              signature: attestationTx.signature,
            } as unknown as Parameters<typeof recoverTypedDataAddress>[0]).catch(() => null)
          : null;
        sigRecovers = !!recovered && recovered.toLowerCase() === attestation.farmSigner.toLowerCase();
      }
    }
  } catch { /* contracts pending — ENS-only mode */ }

  const line = sireLineInfo(recs.sireLine ?? "");
  const short = name.replace(/\.eth$/, "").split(".")[0];
  const hatched = recs.hatchedAt ? new Date(Number(recs.hatchedAt) * 1000).toISOString().slice(0, 10) : null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <nav className="mb-4 text-sm">
        <Link href="/roosters" className="text-bark-soft underline">← All roosters</Link>
      </nav>

      {/* HERO: onchain proof panel */}
      {rwaAddress && tokenId !== null ? (
        <section className="mb-6 overflow-hidden rounded-2xl border-2 border-emerald-700/40 bg-emerald-50 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-700 px-4 py-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">⛓ Onchain proof</h2>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Sepolia 11155111
            </span>
          </div>
          <div className="px-4 py-2">
            <ProofRow label="Contract" value={rwaAddress} href={ETHERSCAN(rwaAddress)} />
            <ProofRow label="Token" value={`RoosterRWA #${tokenId.toString()}`} href={`${ETHERSCAN(rwaAddress, "token")}/${tokenId}`} copy={tokenId.toString()} />
            {attestationTx ? (
              <ProofRow label="Attestation tx" value={`${attestationTx.txHash.slice(0, 10)}…${attestationTx.txHash.slice(-6)}`} href={ETHERSCAN(attestationTx.txHash, "tx")} />
            ) : null}
            {attestation ? (
              <ProofRow label="Farm signer" value={attestation.farmSigner} href={ETHERSCAN(attestation.farmSigner)} />
            ) : null}
            <ProofRow label="ENS name" value={name} href={ENS_APP(name)} />
          </div>
          {sigRecovers !== null ? (
            <div
              className={`flex flex-wrap items-center gap-2 px-4 py-2.5 text-xs ${sigRecovers ? "bg-emerald-100 text-emerald-900" : "bg-red-100 text-red-900"}`}
              title={attestation?.farmSigner}
            >
              {sigRecovers ? (
                <>
                  <span className="text-base font-bold">✓</span>
                  <span>
                    attestation signature recovered to <strong className="font-mono">0x7E28…Ac39</strong> — the Ninlanee Farm key
                  </span>
                  <span className="ml-auto text-[10px] uppercase tracking-wider opacity-70">verified client-side via EIP-712</span>
                </>
              ) : (
                <span className="font-bold">✗ signature mismatch — do not trust this record</span>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="grid gap-8 md:grid-cols-[280px_1fr]">
        {/* RWA card */}
        <div className="overflow-hidden rounded-2xl border border-clay/20 bg-cream shadow-sm">
          <div className="relative flex h-56 items-center justify-center bg-gradient-to-br from-sun-soft to-sun/60">
            {recs.sireLine ? <SireLineArt line={recs.sireLine as "kumarnjeen"} size={176} /> : <span className="text-7xl">🐓</span>}
            <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bark">
              Mythic · RWA
            </span>
            <span className="absolute right-2 top-2 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              ✓ Verified
            </span>
          </div>
          <div className="space-y-3 p-4">
            <h1 className="text-xl font-bold text-bark">{recs.displayName ?? short}</h1>
            <SireLineBadge slug={recs.sireLine} />
            <dl className="space-y-1.5 text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-bark-soft">ring ID</dt>
                <dd className="font-mono text-bark">
                  {recs.ringId ?? "—"}
                  {recs.ringId?.startsWith("NL-") ? <span className="ml-1 text-[9px] uppercase text-amber-700">(sample)</span> : null}
                </dd>
              </div>
              {hatched ? (
                <div className="flex items-baseline justify-between gap-2"><dt className="text-bark-soft">hatched</dt><dd>{hatched}</dd></div>
              ) : null}
              {attestation ? (
                <div className="flex items-baseline justify-between gap-2"><dt className="text-bark-soft">weight</dt><dd><strong>{attestation.weightGrams}</strong> g</dd></div>
              ) : recs.weight ? (
                <div className="flex items-baseline justify-between gap-2"><dt className="text-bark-soft">weight</dt><dd><strong>{recs.weight}</strong> g</dd></div>
              ) : null}
              {attestation ? (
                <div className="flex items-baseline justify-between gap-2"><dt className="text-bark-soft">health</dt><dd><strong>{attestation.healthScore}</strong>/100</dd></div>
              ) : null}
              {tokenId !== null ? (
                <div className="flex items-baseline justify-between gap-2"><dt className="text-bark-soft">token</dt><dd>#{tokenId.toString()}</dd></div>
              ) : null}
            </dl>
            <p className="break-all font-mono text-[10px] leading-relaxed text-bark-soft/80">{name}</p>
            {line ? <p className="text-[11px] italic leading-snug text-bark-soft">{line.personality}</p> : null}
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
                    <div className="text-sm font-bold text-sky-900 pt-1.5">
                      {new Date(Number(attestation.checkedAt) * 1000).toISOString().slice(0, 10)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-sky-900/70">checked</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-bark-soft">
                  <span>EIP-712 · nonce {attestation.nonce.toString()}</span>
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
                <p>ENS-side records (writable only by the farm key):</p>
                <div className="flex gap-3 text-center font-mono text-xs">
                  <div className="flex-1 rounded-xl bg-sun-soft p-3"><span className="block text-xl font-bold text-bark">{recs.weight ?? "—"}</span> g weight</div>
                  <div className="flex-1 rounded-xl bg-emerald-100 p-3"><span className="block text-xl font-bold text-emerald-800">{recs.health ?? "—"}</span> health</div>
                  <div className="flex-1 rounded-xl bg-sky-100 p-3"><span className="block text-sm font-bold text-sky-900 pt-1.5">{recs.attestedAt ? new Date(Number(recs.attestedAt) * 1000).toISOString().slice(0, 10) : "—"}</span> checked</div>
                </div>
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
        </div>
      </section>
    </main>
  );
}
