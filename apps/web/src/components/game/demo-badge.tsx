export function DemoBadge({ demo }: { demo: boolean }) {
  if (!demo) return null;

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sun/60 bg-sun/20 px-3 py-0.5 text-xs font-bold text-bark">
      ⚡ Demo mode: boosted rates{" "}
      <span lang="th">(อัตราเร่งสำหรับสาธิต)</span>
    </span>
  );
}
