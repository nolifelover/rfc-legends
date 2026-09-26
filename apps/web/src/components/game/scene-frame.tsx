import { RoosterMark } from "./rooster-mark";

/**
 * Framed live game scene with a keyboard-focusable play surface.
 *
 * G4 replaces the placeholder *contents* passed as children with the Phaser
 * canvas — keep the frame stable beneath the corner HUD.
 * The stage fills its parent at every aspect ratio. Phaser crops its art to
 * this surface while the HUD stays in CSS viewport coordinates.
 */
export function SceneFrame({
  children,
  className = "w-full",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-game-field
      tabIndex={0}
      role="region"
      aria-label="Game field. A or D to move, Space to attack."
      className={`relative min-h-0 ${className} overflow-hidden bg-[#102b43] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#f2c66d]`}
    >
      {children}
    </div>
  );
}

/** Calm placeholder while the fields wake up (G4 swaps this for the canvas). */
export function ScenePlaceholder() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#102b43] via-[#1c4053] to-[#102b43]">
      <span className="rfcl-bob" aria-hidden>
        <RoosterMark size={72} riverside />
      </span>
      <p className="flex items-center gap-2 text-sm font-medium text-[#fff8e8]">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#c69a5b]/40 border-t-[#f2c66d]"
          aria-hidden
        />
        The fields are waking up…
      </p>
    </div>
  );
}
