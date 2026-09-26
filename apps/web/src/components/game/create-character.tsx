"use client";

// Character creation — the centerpiece: pick a trainer name and one of the five
// sire lines (GDD §3.2), then begin the journey at Home Fields.

import { useState } from "react";
import type { SireLine } from "@/game/types";
import { SireLineArt } from "./sire-line-art";
import { SIRE_LINES } from "./sire-lines";

export type CreateOutcome = { ok: boolean; reason?: string };

export function CreateCharacter({
  onCreate,
}: {
  onCreate: (name: string, sireLine: SireLine) => Promise<CreateOutcome>;
}) {
  const [name, setName] = useState("");
  const [line, setLine] = useState<SireLine | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const ready = trimmed.length >= 1 && trimmed.length <= 24 && line !== null;

  async function submit() {
    if (!ready || !line) return;
    setPending(true);
    setError(null);
    const res = await onCreate(trimmed, line);
    // PLAYER_EXISTS is handled by the caller (it refetches); other codes stay here.
    if (!res.ok && res.reason !== "PLAYER_EXISTS") setError(res.reason ?? "FAILED");
    setPending(false);
  }

  return (
    <section className="mx-auto w-full max-w-6xl rounded-2xl border border-clay/25 bg-cream p-5 shadow-sm sm:p-7">
      <header className="mb-5">
        <h1 className="text-2xl font-black tracking-tight text-bark sm:text-3xl">
          A new trainer arrives at the farm
        </h1>
        <p className="mt-1 text-sm text-bark-soft">
          Every นายไก่ needs a name and a first companion. The sire line shapes how your
          rooster grows — choose the temper that fits your style.
        </p>
      </header>

      <div className="mb-5 max-w-md">
        <label htmlFor="trainer-name" className="mb-1.5 block text-sm font-bold text-bark">
          Trainer name
        </label>
        <input
          id="trainer-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Khun Gai"
          maxLength={24}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border-2 border-clay/30 bg-background px-4 py-2.5 text-base font-semibold text-bark placeholder:text-bark-soft/60 focus:border-clay focus:outline-none"
        />
        <p className="mt-1 text-right text-[11px] text-bark-soft">{trimmed.length}/24</p>
      </div>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-bold text-bark">Sire line</legend>
        <div
          role="radiogroup"
          aria-label="Sire line"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
        >
          {SIRE_LINES.map((info) => {
            const selected = line === info.id;
            return (
              <button
                key={info.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLine(info.id)}
                className={`group flex h-full flex-col items-center gap-2 rounded-2xl border-2 p-3 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay ${
                  selected
                    ? "border-sun bg-sun-soft/50 shadow-[0_0_0_3px_rgba(237,166,20,0.25)]"
                    : "border-clay/25 bg-background hover:border-clay/60 hover:bg-sun-soft/20"
                }`}
              >
                <SireLineArt line={info.id} size={96} theme="riverside" />
                <span className="text-sm font-black text-bark">
                  {info.roman}{" "}
                  <span lang="th" className="font-semibold text-bark-soft">
                    {info.thai}
                  </span>
                </span>
                <span className="text-[11px] leading-snug text-bark-soft">{info.personality}</span>
                <span className="rounded-full bg-clay/10 px-2 py-0.5 text-[11px] font-black text-clay-deep">
                  {info.bias}
                </span>
                <span className="text-[11px] leading-snug text-bark-soft">
                  <span className="font-bold text-bark">{info.skill.roman}</span>{" "}
                  <span lang="th">({info.skill.thai})</span>
                  <br />
                  {info.skill.effect}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-bark-soft">
          You start as a <strong className="text-bark">Novice</strong> at{" "}
          <strong className="text-bark">
            Home Fields <span lang="th">ทุ่งนาบ้านเกิด</span>
          </strong>{" "}
          with <strong className="text-bark">48 stat points</strong>.
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="rounded-2xl bg-field px-8 py-3 text-lg font-black text-cream shadow-md transition hover:bg-field-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-field disabled:cursor-not-allowed disabled:bg-bark/25 disabled:text-bark-soft"
        >
          {pending ? "Hatching your rooster…" : "Begin the journey"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl bg-clay/10 px-3 py-2 text-sm font-bold text-clay-deep">
          {error === "INVALID_NAME"
            ? "Name must be 1–24 characters."
            : error === "INVALID_SIRE_LINE"
              ? "Pick one of the five sire lines."
              : `Something went wrong (${error}). Try again.`}
        </p>
      ) : null}
    </section>
  );
}
