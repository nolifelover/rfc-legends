"use client";

import styles from "./game-audio-settings.module.css";

export interface GameAudioSettingsProps {
  backgroundEnabled: boolean;
  effectsEnabled: boolean;
  onBackgroundChange(enabled: boolean): void;
  onEffectsChange(enabled: boolean): void;
  className?: string;
}

function AudioSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange(enabled: boolean): void;
}) {
  return (
    <button
      type="button"
      className={styles.switchRow}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.track} data-checked={checked} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </button>
  );
}

export function GameAudioSettings({
  backgroundEnabled,
  effectsEnabled,
  onBackgroundChange,
  onEffectsChange,
  className,
}: GameAudioSettingsProps) {
  return (
    <section className={`${styles.panel}${className ? ` ${className}` : ""}`} aria-label="Audio settings">
      <div className={styles.heading}>
        <span className={styles.soundMark} aria-hidden="true">♪</span>
        <span>เสียงเกม</span>
      </div>
      <AudioSwitch checked={backgroundEnabled} label="เพลงพื้นหลัง" onChange={onBackgroundChange} />
      <AudioSwitch checked={effectsEnabled} label="เสียงเอฟเฟกต์" onChange={onEffectsChange} />
    </section>
  );
}
