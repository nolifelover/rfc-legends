import { GamePreview } from "@/components/game/game-preview";
import { RoosterMark } from "@/components/game/rooster-mark";

const PROOFS = [
  { icon: "🐓", label: "Real rooster RWA" },
  { icon: "🧬", label: "ENSv2 pedigree" },
  { icon: "💎", label: "Rare drops, 90/10 onchain split, human-verified by World ID" },
] as const;

const FEATURES = [
  {
    icon: "⚔️",
    tag: "Idle MMORPG",
    title: "Trainer & companion rooster",
    body: "Create your trainer character, head out on adventures, and level up idle-style — even while you're away, your companion rooster keeps the journey going.",
  },
  {
    icon: "🐓",
    tag: "RWA + ENSv2",
    title: "Real roosters from Ninlanee Farm",
    body: "Genuine Thai native breeds, raised at Ninlanee Farm and minted as RWA cards onchain. Each bird carries a verifiable pedigree and a family-tree ENS name, sire to chick.",
  },
  {
    icon: "💎",
    tag: "90/10 on-chain",
    title: "Rare drops & the Rare Market",
    body: "Legendary loot from the game can be minted as NFTs and traded in the Rare Market — every sale splits 90% seller / 10% RFC Club, enforced by the smart contract.",
  },
] as const;

const SIRE_LINES = [
  { roman: "Kumarnjeen", thai: "กุมารจีน" },
  { roman: "Kingkong", thai: "คิงคอง" },
  { roman: "Chaokhunthong", thai: "เจ้าขุนทอง" },
  { roman: "Thepbut", thai: "เทพบุตร" },
  { roman: "Raptor", thai: "แร๊พเตอร์" },
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-[-8%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,var(--sun-soft),transparent_70%)]"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-20">
          <p className="inline-flex items-center gap-2.5 text-sm font-bold uppercase tracking-[0.25em] text-clay-deep">
            <RoosterMark size={28} />
            RFC Legends
          </p>

          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-3xl font-bold leading-tight tracking-tight text-bark sm:text-5xl">
            Your idle-RPG rooster is a real bird on a real Thai farm, with its
            pedigree onchain.
          </h1>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {PROOFS.map((proof) => (
              <li
                key={proof.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-clay/20 bg-cream px-3.5 py-1.5 text-sm font-medium text-bark-soft"
              >
                <span aria-hidden>{proof.icon}</span>
                {proof.label}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <GamePreview />
          </div>

          <a
            href="/game"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-clay px-10 py-4 text-lg font-bold text-cream shadow-lg shadow-clay/30 transition hover:-translate-y-0.5 hover:bg-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
          >
            Play now
            <span aria-hidden>→</span>
          </a>
        </div>

        {/* rice-field hills rolling into the feature band */}
        <div aria-hidden className="relative h-24 sm:h-36">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1440 144"
            preserveAspectRatio="none"
          >
            <path
              d="M0 96 C180 48 360 120 560 88 C760 56 900 128 1100 96 C1260 72 1360 104 1440 88 L1440 144 L0 144 Z"
              fill="var(--field-deep)"
            />
            <path
              d="M0 120 C240 84 480 140 720 116 C960 92 1200 148 1440 116 L1440 144 L0 144 Z"
              fill="var(--field)"
            />
          </svg>
        </div>
      </section>

      {/* ============ Features ============ */}
      <section className="bg-field pb-20 pt-4">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-cream sm:text-3xl">
            Adventure together — every rooster is real
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-cream/80 sm:text-base">
            Raise, train, and carry on the bloodline — everything verifiable
            onchain.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="flex flex-col rounded-2xl border border-clay/15 bg-cream p-7 shadow-[0_10px_40px_-12px_rgba(38,54,26,0.35)] transition hover:-translate-y-1 hover:shadow-[0_18px_50px_-12px_rgba(38,54,26,0.45)]"
              >
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-sun-soft text-2xl">
                  <span aria-hidden>{feature.icon}</span>
                </div>
                <h3 className="text-lg font-bold text-bark">{feature.title}</h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-bark-soft">
                  {feature.body}
                </p>
                <p className="mt-5">
                  <span className="inline-flex rounded-full border border-clay/30 bg-sun-soft/40 px-3 py-1 text-xs font-bold text-clay-deep">
                    {feature.tag}
                  </span>
                </p>
              </article>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-cream/70">
              The five sire lines
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-2.5">
              {SIRE_LINES.map((line) => (
                <li
                  key={line.roman}
                  className="rounded-full border border-cream/40 px-4 py-1.5 text-sm font-medium text-cream"
                >
                  {line.roman}{" "}
                  <span lang="th" className="text-cream/80">
                    {line.thai}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
