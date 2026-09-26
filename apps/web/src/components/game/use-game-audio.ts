"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameAudioController } from "@/game/audio/game-audio-controller";
import {
  DEFAULT_GAME_AUDIO_PREFERENCES,
  loadGameAudioPreferences,
  saveGameAudioPreferences,
  type GameAudioPreferences,
} from "@/game/audio/preferences";
import type { SceneBridge } from "@/game/scene/scene-bridge";

export interface UseGameAudioResult extends GameAudioPreferences {
  unlocked: boolean;
  setBackgroundEnabled(enabled: boolean): void;
  setEffectsEnabled(enabled: boolean): void;
  unlock(): Promise<void>;
}

export function useGameAudio(bridge: SceneBridge | null, enabled: boolean): UseGameAudioResult {
  const [preferences, setPreferences] = useState<GameAudioPreferences>(DEFAULT_GAME_AUDIO_PREFERENCES);
  const [unlocked, setUnlocked] = useState(false);
  const controllerRef = useRef<GameAudioController | null>(null);
  const preferencesReadyRef = useRef(false);

  useEffect(() => {
    const stored = loadGameAudioPreferences(window.localStorage);
    const controller = new GameAudioController(stored);
    controllerRef.current = controller;
    const hydratePreferences = window.setTimeout(() => {
      preferencesReadyRef.current = true;
      setPreferences(stored);
    }, 0);
    return () => {
      window.clearTimeout(hydratePreferences);
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setEnabled(enabled);
  }, [enabled]);

  useEffect(() => {
    if (!preferencesReadyRef.current) return;
    controllerRef.current?.setPreferences(preferences);
    saveGameAudioPreferences(typeof window === "undefined" ? null : window.localStorage, preferences);
  }, [preferences]);

  const unlock = useCallback(async () => {
    const didUnlock = await controllerRef.current?.unlock();
    if (didUnlock) setUnlocked(true);
  }, []);

  useEffect(() => {
    if (!enabled || unlocked) return;
    const unlockFromGesture = () => void unlock();
    window.addEventListener("pointerdown", unlockFromGesture, { capture: true });
    window.addEventListener("keydown", unlockFromGesture, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlockFromGesture, { capture: true });
      window.removeEventListener("keydown", unlockFromGesture, { capture: true });
    };
  }, [enabled, unlock, unlocked]);

  useEffect(() => {
    const onVisibilityChange = () => controllerRef.current?.setVisible(!document.hidden);
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!bridge) return;
    const cleanups = [
      bridge.on("levelup", () => controllerRef.current?.play("levelup")),
      bridge.on("rooster-levelup", () => controllerRef.current?.play("levelup")),
      bridge.on("drop", () => controllerRef.current?.play("drop")),
      bridge.on("boss-spawn", () => controllerRef.current?.play("boss-spawn")),
      bridge.on("boss-kill", () => controllerRef.current?.play("boss-kill")),
      bridge.on("combat-hit", ({ critical }) => controllerRef.current?.play(critical ? "critical" : "hit")),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [bridge]);

  const setBackgroundEnabled = useCallback((backgroundEnabled: boolean) => {
    const next = { ...preferences, backgroundEnabled };
    controllerRef.current?.setPreferences(next);
    setPreferences(next);
  }, [preferences]);

  const setEffectsEnabled = useCallback((effectsEnabled: boolean) => {
    const next = { ...preferences, effectsEnabled };
    controllerRef.current?.setPreferences(next);
    setPreferences(next);
  }, [preferences]);

  return {
    ...preferences,
    unlocked,
    setBackgroundEnabled,
    setEffectsEnabled,
    unlock,
  };
}
