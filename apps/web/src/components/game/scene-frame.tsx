/**
 * Reserved framed 16:9 slot for the live game scene.
 *
 * G4 replaces the placeholder *contents* passed as children with the Phaser
 * canvas — keep the frame itself stable so the HUD below never shifts.
 */
export function SceneFrame({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-bark/30 bg-cream shadow-[0_16px_48px_-16px_rgba(74,50,32,0.45)]">
      {children}
    </div>
  );
}

/** Calm placeholder while the fields wake up (G4 swaps this for the canvas). */
export function ScenePlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-sun-soft/70 via-cream to-field/25">
      <span className="rfcl-bob" aria-hidden>
        <svg width="72" height="72" viewBox="0 0 48 48" fill="none" role="img" aria-hidden>
          <ellipse cx="9" cy="32" rx="3.2" ry="7.5" transform="rotate(28 9 32)" fill="#3e6130" />
          <ellipse cx="12" cy="35" rx="3" ry="7" transform="rotate(8 12 35)" fill="#55803c" />
          <circle cx="13.5" cy="20" r="4" fill="#d2452f" />
          <circle cx="20.5" cy="15.5" r="4.6" fill="#d2452f" />
          <circle cx="27.5" cy="19" r="3.8" fill="#d2452f" />
          <circle cx="22" cy="28" r="11.5" fill="#f0a71d" />
          <circle cx="30.5" cy="37.5" r="3.4" fill="#d2452f" />
          <path d="M32.5 26.5 L41 29.8 L32.5 33.2 Z" fill="#c47b10" />
          <circle cx="26.5" cy="25.5" r="2.1" fill="#3d2817" />
          <circle cx="27.2" cy="24.8" r="0.6" fill="#fffdf6" />
        </svg>
      </span>
      <p className="flex items-center gap-2 text-sm font-medium text-bark-soft">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-clay/40 border-t-clay"
          aria-hidden
        />
        The fields are waking up…
      </p>
    </div>
  );
}
