"use client";

// Client-only Phaser host. Dynamically imported (ssr: false) by idle-scene.tsx
// so the ~1MB Phaser bundle never loads on the server or blocks first paint.

import { useEffect, useRef } from "react";
import type { Drop, Player } from "@/game/types";
import { SceneBridge } from "@/game/scene/scene-bridge";

interface IdleCanvasProps {
  player: Player;
  drops: Drop[];
  demoMode: boolean;
}

export default function IdleCanvas({ player, drops, demoMode }: IdleCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bridgeRef = useRef<SceneBridge | null>(null);
  // Latest props, readable from the mount-once effect without re-running it.
  const propsRef = useRef({ player, drops, demoMode });
  useEffect(() => {
    propsRef.current = { player, drops, demoMode };
  }, [player, drops, demoMode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const bridge = new SceneBridge();
    bridgeRef.current = bridge;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Match canvas text to the page font (Noto Sans Thai first) for Thai glyphs.
    const fontFamily = getComputedStyle(document.body).fontFamily || "Arial, sans-serif";
    const start = propsRef.current;
    void bridge.mount(host, {
      player: start.player,
      drops: start.drops,
      demoMode: start.demoMode,
      reducedMotion: reduced,
      fontFamily,
    });
    return () => {
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, []);

  useEffect(() => {
    bridgeRef.current?.updateState(player, drops, demoMode);
  }, [player, drops, demoMode]);

  // No forced canvas sizing — Phaser's Scale.FIT letterboxes correctly if the
  // frame is ever width-clamped away from exact 16:9.
  return <div ref={hostRef} className="absolute inset-0" aria-hidden />;
}
