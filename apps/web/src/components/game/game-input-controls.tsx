"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Player } from "@/game/types";
import { maxHp } from "@/server/game/stats";
import styles from "./game-input-controls.module.css";

export type MoveDirection = -1 | 0 | 1;

interface SharedInputProps {
  player: Player;
  busy?: boolean;
  blocked?: boolean;
  disabled?: boolean;
}

export interface GameMovementControlProps extends SharedInputProps {
  onMove: (direction: MoveDirection) => void;
}

export interface GameActionControlsProps extends SharedInputProps {
  onAttack: () => void;
  onToggleAuto: () => void;
  onOpenBag: () => void;
  onUsePotion: () => void;
}

function blockingSurfaceOpen(): boolean {
  return Boolean(document.querySelector(
    "[role='dialog'], [aria-modal='true'], [data-riverside-nav] [aria-expanded='true'], [data-game-menu-toggle][aria-expanded='true']",
  ));
}

function shouldIgnoreKeyboard(target: EventTarget | null, ownControl: "movement" | "attack"): boolean {
  if (!(target instanceof Element)) return false;
  if (ownControl === "movement" && target.closest("[data-game-input-controls]")) return false;
  if (ownControl === "attack" && target.closest("[data-game-attack-control]")) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, button, a, [contenteditable='true'], [role='button'], [role='dialog'], [data-site-menu]",
    ),
  );
}

function horizontalKey(key: string): MoveDirection | null {
  const normalized = key.toLowerCase();
  if (normalized === "arrowleft" || normalized === "a") return -1;
  if (normalized === "arrowright" || normalized === "d") return 1;
  return null;
}

export function GameMovementControl({
  player,
  busy = false,
  blocked = false,
  disabled = false,
  onMove,
}: GameMovementControlProps) {
  const inputDisabled = disabled || blocked;
  const [direction, setDirection] = useState<MoveDirection>(0);
  const directionRef = useRef<MoveDirection>(0);
  const activePointerRef = useRef<number | null>(null);
  const heldKeysRef = useRef(new Set<string>());
  const lastKeyDirectionRef = useRef<MoveDirection>(0);
  const onMoveRef = useRef(onMove);
  const mode = player.control?.mode ?? "auto";
  const previousModeRef = useRef(mode);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  const emitMove = useCallback((next: MoveDirection) => {
    const safeNext = inputDisabled || blockingSurfaceOpen() ? 0 : next;
    if (directionRef.current === safeNext) return;
    directionRef.current = safeNext;
    setDirection(safeNext);
    onMoveRef.current(safeNext);
  }, [inputDisabled]);

  const stop = useCallback(() => {
    activePointerRef.current = null;
    heldKeysRef.current.clear();
    lastKeyDirectionRef.current = 0;
    if (directionRef.current !== 0) {
      directionRef.current = 0;
      setDirection(0);
      onMoveRef.current(0);
    }
  }, []);

  useEffect(() => {
    if (inputDisabled) stop();
  }, [inputDisabled, stop]);

  useEffect(() => {
    if (previousModeRef.current === "manual" && mode === "auto") stop();
    previousModeRef.current = mode;
  }, [mode, stop]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const next = horizontalKey(event.key);
      if (next === null || inputDisabled || blockingSurfaceOpen() || shouldIgnoreKeyboard(event.target, "movement")) return;
      event.preventDefault();
      document.querySelector<HTMLElement>("[data-game-field]")?.focus({ preventScroll: true });
      heldKeysRef.current.add(event.key.toLowerCase());
      lastKeyDirectionRef.current = next;
      emitMove(next);
    }

    function onKeyUp(event: KeyboardEvent) {
      const released = horizontalKey(event.key);
      if (released === null) return;
      const normalized = event.key.toLowerCase();
      if (!heldKeysRef.current.has(normalized)) return;
      event.preventDefault();
      heldKeysRef.current.delete(normalized);
      const leftHeld = heldKeysRef.current.has("arrowleft") || heldKeysRef.current.has("a");
      const rightHeld = heldKeysRef.current.has("arrowright") || heldKeysRef.current.has("d");
      const next: MoveDirection = leftHeld && rightHeld
        ? lastKeyDirectionRef.current
        : leftHeld
          ? -1
          : rightHeld
            ? 1
            : 0;
      emitMove(next);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") stop();
    }

    const blockerObserver = new MutationObserver(() => {
      if (blockingSurfaceOpen()) stop();
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", stop);
    document.addEventListener("visibilitychange", onVisibilityChange);
    blockerObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-expanded", "aria-modal", "role"],
      childList: true,
      subtree: true,
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      blockerObserver.disconnect();
      stop();
    };
  }, [inputDisabled, emitMove, stop]);

  function directionAt(clientX: number, element: HTMLElement): MoveDirection {
    const bounds = element.getBoundingClientRect();
    const offset = (clientX - (bounds.left + bounds.width / 2)) / bounds.width;
    if (offset <= -0.18) return -1;
    if (offset >= 0.18) return 1;
    return 0;
  }

  function updatePointer(event: React.PointerEvent<HTMLButtonElement>) {
    emitMove(directionAt(event.clientX, event.currentTarget));
  }

  const directionText = direction < 0 ? "Moving left" : direction > 0 ? "Moving right" : "Standing";

  return (
    <section className={styles.movement} aria-label="Movement controls" aria-busy={busy} data-game-input-controls>
      <button
        type="button"
        className={`${styles.joystick}${inputDisabled ? ` ${styles.disabled}` : ""}`}
        aria-label="Move left or right"
        aria-describedby="movement-control-status"
        data-game-movement-control
        disabled={inputDisabled}
        aria-keyshortcuts="ArrowLeft ArrowRight A D"
        onPointerDown={(event) => {
          if (activePointerRef.current !== null) return;
          activePointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          updatePointer(event);
        }}
        onPointerMove={(event) => {
          if (
            activePointerRef.current === event.pointerId &&
            event.currentTarget.hasPointerCapture(event.pointerId)
          ) updatePointer(event);
        }}
        onPointerUp={(event) => {
          if (activePointerRef.current !== event.pointerId) return;
          activePointerRef.current = null;
          emitMove(0);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (activePointerRef.current !== event.pointerId) return;
          activePointerRef.current = null;
          emitMove(0);
        }}
        onLostPointerCapture={(event) => {
          if (activePointerRef.current !== event.pointerId) return;
          activePointerRef.current = null;
          emitMove(0);
        }}
      >
        <span className={styles.rail} aria-hidden="true" />
        <span className={`${styles.arrow} ${styles.arrowLeft}`} aria-hidden="true">‹</span>
        <span className={`${styles.arrow} ${styles.arrowRight}`} aria-hidden="true">›</span>
        <span
          className={`${styles.knob}${direction < 0 ? ` ${styles.knobLeft}` : direction > 0 ? ` ${styles.knobRight}` : ""}`}
          aria-hidden="true"
        />
      </button>
      <span id="movement-control-status" className={styles.movementStatus} aria-live="polite">
        {mode === "auto" ? "Auto" : "Manual"} · {directionText}
      </span>
      <span className={styles.keys} aria-hidden="true">A / D · ← / →</span>
    </section>
  );
}

export function GameActionControls({
  player,
  busy = false,
  blocked = false,
  disabled = false,
  onAttack,
  onToggleAuto,
  onOpenBag,
  onUsePotion,
}: GameActionControlsProps) {
  const inputDisabled = disabled || blocked;
  const [attackHeld, setAttackHeld] = useState(false);
  const attackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attackPointerRef = useRef<number | null>(null);
  const onAttackRef = useRef(onAttack);
  const mode = player.control?.mode ?? "auto";
  const auto = mode === "auto";
  const previousModeRef = useRef(mode);
  const potionCount = player.inventory[101] ?? 0;
  const hpMax = maxHp(player);
  const hpFull = (player.combat?.hp ?? hpMax) >= hpMax;

  useEffect(() => {
    onAttackRef.current = onAttack;
  }, [onAttack]);

  const stopAttack = useCallback(() => {
    attackPointerRef.current = null;
    if (attackTimerRef.current !== null) {
      clearInterval(attackTimerRef.current);
      attackTimerRef.current = null;
    }
    setAttackHeld(false);
  }, []);

  const startAttack = useCallback(() => {
    if (inputDisabled || blockingSurfaceOpen() || attackTimerRef.current !== null) return;
    onAttackRef.current();
    setAttackHeld(true);
    attackTimerRef.current = setInterval(() => onAttackRef.current(), 250);
  }, [inputDisabled]);

  useEffect(() => {
    if (!inputDisabled) return;
    const frame = window.requestAnimationFrame(stopAttack);
    return () => window.cancelAnimationFrame(frame);
  }, [inputDisabled, stopAttack]);

  useEffect(() => {
    if (previousModeRef.current === "manual" && mode === "auto") stopAttack();
    previousModeRef.current = mode;
  }, [mode, stopAttack]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.code !== "Space" ||
        event.repeat ||
        inputDisabled ||
        blockingSurfaceOpen() ||
        shouldIgnoreKeyboard(event.target, "attack")
      ) return;
      event.preventDefault();
      startAttack();
    }

    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== "Space" || attackTimerRef.current === null) return;
      event.preventDefault();
      stopAttack();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") stopAttack();
    }

    const blockerObserver = new MutationObserver(() => {
      if (blockingSurfaceOpen()) stopAttack();
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", stopAttack);
    document.addEventListener("visibilitychange", onVisibilityChange);
    blockerObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-expanded", "aria-modal", "role"],
      childList: true,
      subtree: true,
    });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", stopAttack);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      blockerObserver.disconnect();
      stopAttack();
    };
  }, [inputDisabled, startAttack, stopAttack]);

  return (
    <section className={styles.actions} aria-label="Combat controls" aria-busy={busy} data-game-input-controls>
      <button
        type="button"
        className={`${styles.utility} ${styles.auto}${auto ? ` ${styles.autoActive}` : ""}${inputDisabled ? ` ${styles.disabled}` : ""}`}
        onClick={() => {
          stopAttack();
          onToggleAuto();
        }}
        disabled={inputDisabled}
        aria-label={auto ? "Turn Auto battle off" : "Turn Auto battle on"}
        aria-pressed={auto}
        title={auto ? "Auto battle on" : "Auto battle off"}
      >
        <span>Auto<span className={styles.autoDot} aria-hidden="true" /></span>
      </button>

      <button
        type="button"
        className={`${styles.utility} ${styles.potion}${inputDisabled || potionCount <= 0 || hpFull ? ` ${styles.disabled}` : ""}`}
        onClick={onUsePotion}
        disabled={inputDisabled || potionCount <= 0 || hpFull}
        aria-label={`Use herbal tonic (${potionCount.toLocaleString()})`}
        title={
          potionCount <= 0
            ? "No herbal tonic"
            : hpFull
              ? "HP is already full"
              : `Use herbal tonic (${potionCount.toLocaleString()})`
        }
      >
        <svg className={styles.potionGlyph} viewBox="0 0 24 28" fill="none" aria-hidden="true">
          <path d="M8 2h8v5l3 4v11c0 2-1.6 4-4 4H9c-2.4 0-4-2-4-4V11l3-4V2Z" fill="currentColor" stroke="#FFF1BD" strokeWidth="1.5" />
          <path d="M8 2h8M8 7h8M7 15h10" stroke="#5D2D2A" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 18h4M12 16v4" stroke="#FFF8E8" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className={styles.itemCount}>{potionCount.toLocaleString()}</span>
      </button>

      <button
        type="button"
        className={`${styles.utility} ${styles.bag}${inputDisabled ? ` ${styles.disabled}` : ""}`}
        onClick={onOpenBag}
        disabled={inputDisabled}
        aria-label="Open Bag & drops"
        title="Bag & drops"
      >
        <span className={styles.bagGlyph} aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`${styles.attack}${attackHeld ? ` ${styles.attackHeld}` : ""}${inputDisabled ? ` ${styles.disabled}` : ""}`}
        disabled={inputDisabled}
        aria-label="Attack"
        aria-pressed={attackHeld}
        aria-keyshortcuts="Space"
        data-game-attack-control
        title="Attack (Space)"
        onPointerDown={(event) => {
          if (attackPointerRef.current !== null || attackTimerRef.current !== null) return;
          attackPointerRef.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          startAttack();
        }}
        onPointerUp={(event) => {
          if (attackPointerRef.current !== event.pointerId) return;
          stopAttack();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          if (attackPointerRef.current === event.pointerId) stopAttack();
        }}
        onLostPointerCapture={(event) => {
          if (attackPointerRef.current === event.pointerId) stopAttack();
        }}
        onClick={(event) => {
          // Space produces a synthetic click (detail 0) after keyup; the
          // keyboard handler already dispatched the bounded attack intent.
          if (event.detail === 0) event.preventDefault();
        }}
      >
        Attack
      </button>
    </section>
  );
}
