"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction, GameActionResponse, MovementDirection } from "@/game/manual-controls";
import type { SceneBridge } from "@/game/scene/scene-bridge";
import type { Player } from "@/game/types";

const ACTION_MESSAGES: Record<string, string> = {
  OUT_OF_RANGE: "Move closer to attack.",
  KNOCKED_OUT: "Recovering…",
  NO_TARGET: "Waiting for the next enemy…",
  STALE_SEQUENCE: "Controls refreshed. Try again.",
  NO_ITEM: "No herbal tonic left.",
  FULL_HP: "HP is already full.",
};

/** A bounded command queue: one latest move, one mode change and one attack.
 * Server time, range and cooldowns decide the result of every command. */
export function useGameControls({ address, player, bridge, onState, blocked }: {
  address?: string;
  player: Player | null;
  bridge: SceneBridge | null;
  onState: (response: GameActionResponse) => void;
  blocked: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const current = useRef({ address, player, bridge, onState, blocked });
  const sequence = useRef(0);
  const direction = useRef<MovementDirection>(0);
  const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const pending = useRef<Partial<Record<GameAction["type"], { action: GameAction; order: number }>>>({});
  const enqueueOrder = useRef(0);
  const running = useRef(false);
  const generation = useRef(0);
  const resumeDrain = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    if (current.current.address !== address) sequence.current = player?.control?.sequence ?? 0;
    current.current = { address, player, bridge, onState, blocked };
    sequence.current = Math.max(sequence.current, player?.control?.sequence ?? 0);
  }, [address, player, bridge, onState, blocked]);

  const stopLocal = useCallback(() => {
    direction.current = 0;
    if (heartbeat.current) clearInterval(heartbeat.current);
    heartbeat.current = null;
    current.current.bridge?.pauseManualMovement();
  }, []);

  const drain = useCallback(async (): Promise<void> => {
    if (running.current) return;
    running.current = true;
    const epoch = generation.current;
    setBusy(true);
    try {
      while (epoch === generation.current) {
        const key = (Object.keys(pending.current) as GameAction["type"][])
          .sort((a, b) => pending.current[a]!.order - pending.current[b]!.order)[0];
        if (!key) break;
        const action = pending.current[key]!.action;
        delete pending.current[key];
        const state = current.current;
        if (!state.address || !state.player) break;
        const nextSequence = Math.max(sequence.current, state.player.control?.sequence ?? 0) + 1;
        sequence.current = nextSequence;
        const response = await fetch("/api/game/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address: state.address, sequence: nextSequence, action }),
        });
        const data = await response.json() as GameActionResponse & { reason?: string };
        if (epoch !== generation.current) return;
        if (!response.ok || !data.player) throw new Error(data.reason ?? "ACTION_FAILED");
        sequence.current = Math.max(data.player.control?.sequence ?? 0, current.current.player?.control?.sequence ?? 0);
        const latest = current.current.player?.control;
        if ((data.player.control?.sequence ?? 0) >= (latest?.sequence ?? 0)
          && (data.player.control?.updatedAt ?? 0) >= (latest?.updatedAt ?? 0)) {
          current.current.player = data.player;
          state.onState(data);
          state.bridge?.updateState(data.player, data.drops, data.demoMode);
        }
        if (action.type === "attack") state.bridge?.showActionResult(data.result);
        if (data.result.reason && data.result.reason !== "COOLDOWN") {
          setFeedback(ACTION_MESSAGES[data.result.reason] ?? "Try again.");
        } else if (action.type === "mode") {
          setFeedback(data.player.control?.mode === "manual" ? "Manual control" : "Auto battle on");
        } else if (data.result.accepted) setFeedback("");
      }
    } catch {
      if (epoch === generation.current) {
        pending.current = {};
        stopLocal();
        setFeedback("Connection interrupted. Try again.");
      }
    } finally {
      running.current = false;
      setBusy(false);
      if (Object.keys(pending.current).length > 0) void resumeDrain.current();
    }
  }, [stopLocal]);

  useEffect(() => { resumeDrain.current = drain; }, [drain]);

  const enqueue = useCallback((action: GameAction) => {
    // Replacing a held movement keeps its place; it cannot starve a tap to attack.
    const order = pending.current[action.type]?.order ?? ++enqueueOrder.current;
    pending.current[action.type] = { action, order };
    void drain();
  }, [drain]);

  const move = useCallback((value: MovementDirection) => {
    if (value !== 0 && current.current.blocked) return;
    if (value === direction.current) return;
    stopLocal();
    direction.current = value;
    current.current.bridge?.setMovement(value);
    enqueue({ type: "move", direction: value });
    if (value !== 0) heartbeat.current = setInterval(() => {
      enqueue({ type: "move", direction: direction.current });
    }, 250);
  }, [enqueue, stopLocal]);

  const attack = useCallback(() => {
    if (!current.current.blocked) enqueue({ type: "attack" });
  }, [enqueue]);

  const potion = useCallback(() => {
    if (!current.current.blocked) enqueue({ type: "potion" });
  }, [enqueue]);

  const toggleAuto = useCallback(() => {
    if (current.current.blocked) return;
    stopLocal();
    pending.current = {};
    enqueue({ type: "mode", mode: current.current.player?.control?.mode === "manual" ? "auto" : "manual" });
  }, [enqueue, stopLocal]);

  useEffect(() => {
    if (blocked) move(0);
  }, [blocked, move]);

  useEffect(() => {
    const release = () => move(0);
    const visibility = () => { if (document.hidden) release(); };
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", visibility);
      generation.current += 1;
      pending.current = {};
      stopLocal();
    };
  }, [address, bridge, move, stopLocal]);

  return { move, attack, potion, toggleAuto, busy, feedback };
}
