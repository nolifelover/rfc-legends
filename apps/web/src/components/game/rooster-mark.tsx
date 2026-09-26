export function RoosterMark({
  size = 40,
  className = "",
  riverside = false,
}: {
  size?: number;
  className?: string;
  riverside?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="ตราไก่ RFC Legends"
      className={className}
      data-riverside-mark={riverside ? "" : undefined}
    >
      {riverside ? <style>{`[data-riverside-mark] { --mark-tail:#57745a; --mark-tail-light:#829b76; --mark-comb:#c16b52; --mark-body:#f2b45b; --mark-ink:#183946; --mark-beak:#c69a5b; }`}</style> : null}
      {/* tail feathers */}
      <ellipse
        cx="9"
        cy="32"
        rx="3.2"
        ry="7.5"
        transform="rotate(28 9 32)"
        fill="var(--mark-tail, #3e6130)"
      />
      <ellipse
        cx="12"
        cy="35"
        rx="3"
        ry="7"
        transform="rotate(8 12 35)"
        fill="var(--mark-tail-light, #55803c)"
      />
      {/* comb */}
      <circle cx="13.5" cy="20" r="4" fill="var(--mark-comb, #d2452f)" />
      <circle cx="20.5" cy="15.5" r="4.6" fill="var(--mark-comb, #d2452f)" />
      <circle cx="27.5" cy="19" r="3.8" fill="var(--mark-comb, #d2452f)" />
      {/* head */}
      <circle cx="22" cy="28" r="11.5" fill="var(--mark-body, #f0a71d)" />
      {/* wattle */}
      <circle cx="30.5" cy="37.5" r="3.4" fill="var(--mark-comb, #d2452f)" />
      {/* beak */}
      <path d="M32.5 26.5 L41 29.8 L32.5 33.2 Z" fill="var(--mark-beak, #c47b10)" />
      {/* eye */}
      <circle cx="26.5" cy="25.5" r="2.1" fill="var(--mark-ink, #3d2817)" />
      <circle cx="27.2" cy="24.8" r="0.6" fill="#fffdf6" />
    </svg>
  );
}
