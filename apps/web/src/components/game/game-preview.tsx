import { RoosterMark } from "./rooster-mark";

/**
 * Reserved slot for the live idle-gameplay scene (Phaser canvas).
 *
 * G4: replace the placeholder scene inside the <figure> with the live canvas —
 * keep the frame and caption so the landing layout doesn't shift.
 */
export function GamePreview() {
  return (
    <figure className="mx-auto w-full max-w-2xl">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-clay/25 shadow-[0_20px_60px_-16px_rgba(74,50,32,0.45)]">
        {/* placeholder scene: dawn sky, hills, rice paddies */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 640 360"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden
        >
          <defs>
            <linearGradient id="rfcl-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--sun-soft)" />
              <stop offset="100%" stopColor="var(--cream)" />
            </linearGradient>
          </defs>

          <rect width="640" height="360" fill="url(#rfcl-sky)" />

          {/* sun */}
          <circle cx="520" cy="84" r="58" fill="var(--sun)" opacity="0.25" />
          <circle cx="520" cy="84" r="38" fill="var(--sun)" />

          {/* clouds */}
          <g fill="var(--cream)" opacity="0.85">
            <rect x="96" y="64" width="92" height="17" rx="8.5" />
            <rect x="126" y="50" width="52" height="15" rx="7.5" />
            <rect x="292" y="108" width="70" height="14" rx="7" />
          </g>

          {/* far hills */}
          <path
            d="M0 200 C120 160 240 212 360 186 C480 162 560 206 640 190 L640 360 L0 360 Z"
            fill="var(--field-deep)"
            opacity="0.55"
          />

          {/* paddy bands */}
          <path
            d="M0 235 C140 215 300 252 640 228 L640 360 L0 360 Z"
            fill="var(--field)"
            opacity="0.8"
          />
          <path
            d="M0 235 C140 215 300 252 640 228"
            fill="none"
            stroke="var(--cream)"
            strokeOpacity="0.3"
            strokeWidth="2"
          />
          <path
            d="M0 285 C180 262 420 302 640 275 L640 360 L0 360 Z"
            fill="var(--field-deep)"
          />
          <path
            d="M0 285 C180 262 420 302 640 275"
            fill="none"
            stroke="var(--cream)"
            strokeOpacity="0.25"
            strokeWidth="2"
          />
          <path
            d="M0 330 C200 312 420 342 640 322 L640 360 L0 360 Z"
            fill="var(--field)"
          />

          {/* water sparkle */}
          <g
            stroke="var(--cream)"
            strokeOpacity="0.3"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M90 248 H170" />
            <path d="M420 254 H520" />
            <path d="M180 298 H290" />
          </g>
        </svg>

        {/* trainer (straw-hat farmer) */}
        <svg
          aria-hidden
          className="absolute h-[15%] w-auto"
          style={{ left: "17%", bottom: "13%" }}
          viewBox="0 0 48 72"
        >
          <ellipse cx="24" cy="13" rx="19" ry="5.5" fill="#e0bd62" />
          <path d="M9 13 C11 4 37 4 39 13 Z" fill="#cfa63e" />
          <circle cx="24" cy="21" r="7.5" fill="#e8b98a" />
          <path d="M15 30 L33 30 L36 56 L12 56 Z" fill="#b4552d" />
          <rect x="17" y="56" width="5" height="12" rx="2.5" fill="#4a3220" />
          <rect x="26" y="56" width="5" height="12" rx="2.5" fill="#4a3220" />
        </svg>

        {/* companion rooster */}
        <div
          aria-hidden
          className="absolute w-[11%]"
          style={{ left: "26%", bottom: "12%" }}
        >
          <RoosterMark size={52} className="h-auto w-full" />
        </div>
      </div>

      <figcaption className="mt-3 text-center text-sm font-medium text-bark-soft">
        Live gameplay — <span lang="th">ทุ่งนาบ้านเกิด</span> (Home Fields)
      </figcaption>
    </figure>
  );
}
