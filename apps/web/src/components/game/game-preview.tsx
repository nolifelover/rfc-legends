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
        {/* placeholder scene: dawn sky, paddies, a fight in progress */}
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

        {/* ground shadows for the fighters */}
        <div
          aria-hidden
          className="absolute bottom-[13%] left-[7%] h-[2.5%] w-[24%] rounded-full bg-black/20 blur-[3px]"
        />
        <div
          aria-hidden
          className="absolute bottom-[13%] right-[8%] h-[2.5%] w-[18%] rounded-full bg-black/20 blur-[3px]"
        />

        {/* trainer (straw-hat farmer) */}
        <svg
          aria-hidden
          className="rfcl-bob absolute h-[27%] w-auto"
          style={{ left: "9%", bottom: "15%" }}
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
          className="rfcl-bob absolute w-[19%]"
          style={{ left: "20%", bottom: "14%", animationDelay: "0.4s" }}
        >
          <RoosterMark size={96} className="h-auto w-full" />
        </div>

        {/* monster blob */}
        <svg
          aria-hidden
          className="rfcl-bob absolute h-[27%] w-auto"
          style={{ right: "10%", bottom: "14%", animationDelay: "0.9s" }}
          viewBox="0 0 80 84"
        >
          <path d="M26 18 L20 6 L34 14 Z" fill="var(--clay-deep)" />
          <path d="M54 18 L60 6 L46 14 Z" fill="var(--clay-deep)" />
          <path
            d="M40 14 C60 12 72 26 71 44 C70 64 58 74 40 74 C22 74 10 64 9 44 C8 26 20 16 40 14 Z"
            fill="var(--clay)"
          />
          <circle cx="56" cy="30" r="3" fill="var(--clay-deep)" opacity="0.6" />
          <circle cx="24" cy="48" r="2.5" fill="var(--clay-deep)" opacity="0.6" />
          <circle cx="30" cy="38" r="7" fill="var(--cream)" />
          <circle cx="50" cy="38" r="7" fill="var(--cream)" />
          <circle cx="27.5" cy="39" r="2.8" fill="#3d2817" />
          <circle cx="47.5" cy="39" r="2.8" fill="#3d2817" />
          <path
            d="M22 28 L36 32"
            stroke="#3d2817"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M58 28 L44 32"
            stroke="#3d2817"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M29 52 Q40 64 51 52 Q40 58 29 52 Z" fill="#3d2817" />
          <path d="M36 56 L39 62 L42 56 Z" fill="var(--cream)" />
          <ellipse cx="30" cy="74" rx="6" ry="3.5" fill="var(--clay-deep)" />
          <ellipse cx="50" cy="74" rx="6" ry="3.5" fill="var(--clay-deep)" />
        </svg>

        {/* floating damage numbers */}
        <span
          aria-hidden
          className="rfcl-dmg rfcl-outline absolute text-xl font-black text-white sm:text-2xl"
          style={{ right: "16%", top: "20%" }}
        >
          128
        </span>
        <span
          aria-hidden
          className="rfcl-dmg rfcl-outline absolute text-sm font-black text-sun sm:text-lg"
          style={{ right: "27%", top: "27%", animationDelay: "0.7s" }}
        >
          CRIT 256!
        </span>

        {/* rare card drop burst */}
        <div aria-hidden className="rfcl-card absolute" style={{ left: "39%", top: "28%" }}>
          <div className="relative h-14 w-11 rounded-lg border-2 border-sun bg-cream shadow-lg shadow-black/25">
            <div className="absolute inset-1.5 rounded border border-sun/40" />
            <span className="absolute inset-0 grid place-items-center text-xl text-sun">
              ★
            </span>
          </div>
          <span className="rfcl-sparkle absolute -left-3 -top-2 text-sm text-sun">✦</span>
          <span
            className="rfcl-sparkle absolute -right-3 top-3 text-xs text-sun"
            style={{ animationDelay: "0.5s" }}
          >
            ✦
          </span>
          <span
            className="rfcl-sparkle absolute -bottom-1 left-5 text-xs text-cream"
            style={{ animationDelay: "0.9s" }}
          >
            ✦
          </span>
        </div>

        {/* EXP bar */}
        <div className="absolute inset-x-4 bottom-3 flex items-center gap-2.5 rounded-full bg-black/30 px-4 py-2 backdrop-blur-sm">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cream">
            EXP
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full w-[42%] rounded-full bg-sun" />
          </div>
          <span className="text-[10px] font-bold text-cream">42%</span>
        </div>
      </div>

      <figcaption className="mt-3 text-center text-sm font-medium text-bark-soft">
        Live gameplay — <span lang="th">ทุ่งนาบ้านเกิด</span> (Home Fields)
      </figcaption>
    </figure>
  );
}
