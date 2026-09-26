"use client";

import { useState } from "react";
import { getMap } from "@/game/data/maps";
import type { Player } from "@/game/types";
import { expToNext, maxHp, maxSp } from "@/server/game/stats";
import { GameChromeIcon } from "./game-chrome-icon";
import { SireLineArt } from "./sire-line-art";
import { sireLineInfo } from "./sire-lines";
import styles from "./game-hud-overlay.module.css";

function jobTag(level: number): string {
  if (level >= 60) return "Master Trainer";
  if (level >= 30) return "Veteran";
  if (level >= 10) return "Adventurer";
  return "Novice";
}

function Meter({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "hp" | "sp" | "exp";
}) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.max(0, Math.min(safeMax, value));
  const percent = (safeValue / safeMax) * 100;
  const readable = `${value.toLocaleString()}/${max.toLocaleString()}`;

  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div
        className={styles.track}
        role="meter"
        aria-label={`${label}: ${readable}`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.barValue}>{readable}</span>
    </div>
  );
}

export interface GameHudOverlayProps {
  player: Player;
  rareDropCount?: number;
  bagCount?: number;
  newestDropId?: string;
  onOpenBag?: () => void;
  onOpenGuild?: () => void;
  statCta?: React.ReactNode;
  syncSlot?: React.ReactNode;
  goal?: React.ReactNode;
  /** Reserved for real input controls supplied by the game controller. */
  movementSlot?: React.ReactNode;
  /** Reserved for real attack, skill, or item controls supplied by the game controller. */
  actionSlot?: React.ReactNode;
  className?: string;
}

export function GameHudOverlay({
  player,
  rareDropCount,
  bagCount,
  newestDropId,
  onOpenBag,
  onOpenGuild,
  statCta,
  syncSlot,
  goal,
  movementSlot,
  actionSlot,
  className,
}: GameHudOverlayProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const info = sireLineInfo(player.sireLine);
  const map = getMap(player.mapId);
  const hpMax = maxHp(player);
  const hp = player.combat?.hp ?? hpMax;
  const sp = maxSp(player);
  const expMax = expToNext(player.baseLevel);
  const roosterExpMax = expToNext(player.rooster.level);
  const marketHref = rareDropCount && newestDropId ? `/market?dropId=${newestDropId}` : "/market";

  return (
    <div className={`${styles.shell}${className ? ` ${className}` : ""}`} data-game-hud-overlay>
      <section className={styles.profileDock} aria-label="Player status">
        <div className={styles.profile}>
          <div className={styles.identity}>
            <span className={styles.portrait} aria-hidden="true">
              <svg className={styles.portraitFallback} viewBox="0 0 48 48" fill="none">
                <path d="M15 19c1-8 5-12 10-12 6 0 10 5 9 13l-3 8H18l-3-9Z" fill="#D39B68" stroke="#5B3827" strokeWidth="1.5" />
                <path d="M13 18c4-2 7-5 9-9 5 4 9 5 14 5-1-7-5-11-12-11-6 0-10 5-11 15Z" fill="#172A4C" stroke="#0C1830" strokeWidth="1.5" />
                <path d="M18 28h13c6 3 9 8 10 17H8c1-9 4-14 10-17Z" fill="#314B86" stroke="#172A4C" strokeWidth="1.5" />
                <path d="m18 29 6 7 7-7" stroke="#F2C66D" strokeWidth="2" />
                <circle cx="20" cy="19" r="1" fill="#2B1B12" />
                <circle cx="29" cy="19" r="1" fill="#2B1B12" />
              </svg>
            </span>
            <span className={styles.identityText}>
              <span className={styles.name}>{player.name}</span>
              <span className={styles.place}>{jobTag(player.baseLevel)} · <span lang="th">{map.name}</span></span>
            </span>
            <span className={styles.level}>Lv.{player.baseLevel}</span>
          </div>
          <div className={styles.bars}>
            <Meter label="HP" value={hp} max={hpMax} tone="hp" />
            <Meter label="SP" value={sp} max={sp} tone="sp" />
            <Meter label="EXP" value={player.exp} max={expMax} tone="exp" />
          </div>
        </div>

        <div className={styles.companion}>
          <SireLineArt line={player.sireLine} size={34} className="rounded-full" theme="riverside" />
          <span className={styles.companionText}>
            <span className={styles.companionName}>{player.rooster.name} · <span lang="th">{info.thai}</span></span>
            <span className={styles.companionMeta}>Rooster Lv.{player.rooster.level} · {info.roman}</span>
          </span>
          <span
            className={styles.companionExp}
            role="meter"
            aria-label={`Rooster EXP: ${player.rooster.exp.toLocaleString()}/${roosterExpMax.toLocaleString()}`}
            aria-valuemin={0}
            aria-valuemax={roosterExpMax}
            aria-valuenow={player.rooster.exp}
            title={`${player.rooster.exp.toLocaleString()}/${roosterExpMax.toLocaleString()}`}
          >
            {Math.min(100, (player.rooster.exp / Math.max(1, roosterExpMax)) * 100).toFixed(1)}%
          </span>
        </div>

        {goal ? <div className={styles.goal}>{goal}</div> : null}
      </section>

      <nav className={styles.menuDock} aria-label="Game menu">
        <button
          type="button"
          className={styles.menuToggle}
          aria-label={menuOpen ? "Close game menu" : "Open game menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          title={menuOpen ? "Close game menu" : "Open game menu"}
        >
          <GameChromeIcon name="menu" width={25} height={25} />
        </button>
        <div className={styles.menuPanel} data-open={menuOpen}>
          {onOpenBag ? (
            <button
              type="button"
              className={styles.menuAction}
              onClick={onOpenBag}
              aria-label={`Bag & drops (${bagCount ?? 0} items)`}
              title={`Bag & drops (${bagCount ?? 0} items)`}
            >
              <GameChromeIcon name="bag" width={23} height={23} />
              <span>Bag</span>
              {(bagCount ?? 0) > 0 ? <span className={styles.badge}>{bagCount}</span> : null}
            </button>
          ) : null}
          {onOpenGuild ? (
            <button
              type="button"
              className={styles.menuAction}
              onClick={onOpenGuild}
              aria-label="Guild chat & boss"
              title="Guild chat & boss"
            >
              <GameChromeIcon name="guild" width={23} height={23} />
              <span>Guild</span>
            </button>
          ) : null}
          <a className={styles.menuLink} href={marketHref} aria-label="Open the Rare Market" title="Open the Rare Market">
            <GameChromeIcon name="market" width={23} height={23} />
            <span>Market</span>
            {(rareDropCount ?? 0) > 0 ? <span className={styles.badge}>{rareDropCount}</span> : null}
          </a>
          {statCta ? <span className={styles.providedSlot}>{statCta}</span> : null}
          {syncSlot ? <span className={styles.providedSlot}>{syncSlot}</span> : null}
        </div>
      </nav>

      {movementSlot ? <div className={styles.bottomLeft}>{movementSlot}</div> : null}
      {actionSlot ? <div className={styles.bottomRight}>{actionSlot}</div> : null}
    </div>
  );
}
