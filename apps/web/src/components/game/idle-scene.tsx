"use client";

// Dynamic wrapper for the Phaser idle scene — loads the canvas (and Phaser)
// only in the browser. The frame's placeholder shows while the chunk loads.

import nextDynamic from "next/dynamic";
import type { Drop, Player } from "@/game/types";
import { ScenePlaceholder } from "./scene-frame";

const IdleCanvas = nextDynamic(() => import("./idle-canvas"), {
  ssr: false,
  loading: () => <ScenePlaceholder />,
});

export function IdleScene({
  player,
  drops,
  demoMode,
}: {
  player: Player;
  drops: Drop[];
  demoMode: boolean;
}) {
  return <IdleCanvas player={player} drops={drops} demoMode={demoMode} />;
}
