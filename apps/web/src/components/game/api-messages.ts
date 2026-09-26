// Engine/HTTP reason codes → friendly English copy (the codes stay ASCII for
// transport; this is where they become human).

export const REASON_TEXT: Record<string, string> = {
  PLAYER_EXISTS: "A trainer already exists for this wallet.",
  NOT_ENOUGH_POINTS: "Not enough stat points.",
  STAT_CAP_EXCEEDED: "That stat has reached its cap (99).",
  NO_ALLOCATION: "Nothing to allocate.",
  INVALID_STAT: "Unknown stat.",
  INVALID_AMOUNT: "Amounts must be whole numbers of at least 0.",
  INVALID_NAME: "Name must be 1–24 characters.",
  INVALID_SIRE_LINE: "Pick one of the five sire lines.",
  INVALID_ADDRESS: "Invalid wallet address.",
  INVALID_BODY: "Invalid request.",
  PLAYER_NOT_FOUND: "No trainer found for this wallet — create one first.",
  INTERNAL: "Server error — please retry.",
};

export function reasonText(reason?: string): string {
  return (reason && REASON_TEXT[reason]) || `Something went wrong${reason ? ` (${reason})` : ""}.`;
}
