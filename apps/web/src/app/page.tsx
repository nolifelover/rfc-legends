import { ConnectButton } from "@/components/game/connect-button";
import { RoosterMark } from "@/components/game/rooster-mark";

const FEATURES = [
  {
    icon: "⚔️",
    tag: "Idle MMORPG",
    title: "นายไก่ + ไก่คู่หู",
    body: "สร้างตัวละครนายไก่ ออกผจญภัยเก็บแต้มประสบการณ์และเลเวลอัปแบบ idle — แม้ปิดเกมไว้ ไก่คู่หูก็ยังออกเดินทางให้คุณ",
  },
  {
    icon: "🐓",
    tag: "RWA + ENSv2",
    title: "ไก่ตัวจริงจากฟาร์มนิลหนานี",
    body: "ไก่ไทยพันธุ์แท้ที่ฟาร์มเลี้ยงจริง ถูกบันทึกเป็น RWA Card บนเชน ตรวจสอบสายพันธุ์ยืนยันได้ พร้อมชื่อ ENS แบบลำดับตระกูล พ่อพันธุ์สู่ลูกไก่",
  },
  {
    icon: "💎",
    tag: "90/10 on-chain",
    title: "ของหายากกับ Rare Market",
    body: "ไอเทมหายากจากดรอปในเกม mint เป็น NFT แล้วซื้อขายใน Rare Market โดยสัญญาแบ่งยอดขาย 90% ผู้ขาย / 10% RFC Club โปร่งใสทุกเทรด",
  },
] as const;

const SIRE_LINES = [
  "กุมารจีน",
  "คิงคอง",
  "เจ้าขุนทอง",
  "เทพบุตร",
  "แร๊พเตอร์",
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
        <div
          aria-hidden
          className="pointer-events-none absolute top-24 left-[-10%] h-72 w-72 rounded-full bg-[radial-gradient(circle,var(--sun-soft),transparent_70%)] opacity-70"
        />

        <div className="relative mx-auto w-full max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
          <div className="mb-8 flex justify-center">
            <div className="rounded-full bg-cream p-6 shadow-[0_14px_50px_-12px_rgba(157,71,40,0.45)] ring-4 ring-sun/40">
              <RoosterMark size={96} />
            </div>
          </div>

          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-clay/30 bg-sun-soft/50 px-4 py-1.5 text-sm font-medium text-clay-deep">
            เกม idle MMORPG บนบล็อกเชน
          </p>

          <h1 className="text-5xl font-bold tracking-tight text-bark sm:text-7xl">
            RFC <span className="text-clay">Legends</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-bark-soft sm:text-xl">
            เกม idle MMORPG: เลี้ยงไก่ไทยพันธุ์แท้ ออกผจญภัย
            เลเวลอัปไปพร้อมไก่คู่หู
          </p>
          <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-field-deep sm:text-base">
            ไก่ไทยพันธุ์แท้ + สายพันธุ์โปร่งใสบนบล็อกเชน
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/game"
              className="inline-flex items-center gap-2 rounded-full bg-clay px-9 py-3.5 text-lg font-bold text-cream shadow-lg shadow-clay/30 transition hover:-translate-y-0.5 hover:bg-clay-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
            >
              เริ่มเล่น
              <span aria-hidden>→</span>
            </a>
            <ConnectButton className="px-6 py-3 text-base" />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-bark-soft">
            <a href="/roosters" className="transition hover:text-clay-deep">
              ดูไก่ RWA <span aria-hidden>›</span>
            </a>
            <a href="/market" className="transition hover:text-clay-deep">
              Rare Market <span aria-hidden>›</span>
            </a>
          </div>
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
            ผจญภัยไปด้วยกัน ไก่ทุกตัวคือของจริง
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-cream/80 sm:text-base">
            เลี้ยง เทรน และสืบทอดสายพันธุ์ — ทุกอย่างตรวจสอบได้บนเชน
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
              สายพันธุ์พ่อพันธุ์ทั้ง 5
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-2.5">
              {SIRE_LINES.map((line) => (
                <li
                  key={line}
                  className="rounded-full border border-cream/40 px-4 py-1.5 text-sm font-medium text-cream"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
