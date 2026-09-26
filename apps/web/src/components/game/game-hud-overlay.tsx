"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useConnection } from "wagmi";
import { getMap } from "@/game/data/maps";
import type { Player } from "@/game/types";
import { expToNext, maxHp, maxSp } from "@/server/game/stats";
import { ConnectButton } from "./connect-button";
import { GameChromeIcon } from "./game-chrome-icon";
import { RoosterMark } from "./rooster-mark";
import { SireLineArt } from "./sire-line-art";
import { sireLineInfo } from "./sire-lines";
import styles from "./game-hud-overlay.module.css";

const PROFILE_COLLAPSE_KEY = "rfcl:game-profile-collapsed";
const PROFILE_COLLAPSE_EVENT = "rfcl:game-profile-collapse-change";
let profileCollapseFallback = false;

function subscribeProfileCollapse(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(PROFILE_COLLAPSE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PROFILE_COLLAPSE_EVENT, onChange);
  };
}

function profileCollapseSnapshot() {
  try {
    return window.localStorage.getItem(PROFILE_COLLAPSE_KEY) === "1";
  } catch {
    return profileCollapseFallback;
  }
}

function setProfileCollapse(collapsed: boolean) {
  profileCollapseFallback = collapsed;
  try {
    window.localStorage.setItem(PROFILE_COLLAPSE_KEY, collapsed ? "1" : "0");
  } catch {
    // The control still works for the session when storage is unavailable.
  }
  window.dispatchEvent(new Event(PROFILE_COLLAPSE_EVENT));
}

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
  /** Optional persisted music / effects controls supplied by the game client. */
  audioSettings?: React.ReactNode;
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
  audioSettings,
  goal,
  movementSlot,
  actionSlot,
  className,
}: GameHudOverlayProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletCopied, setWalletCopied] = useState(false);
  const profileCollapsed = useSyncExternalStore(subscribeProfileCollapse, profileCollapseSnapshot, () => false);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const menuDialogRef = useRef<HTMLElement>(null);
  const { address, isConnected } = useConnection();
  const info = sireLineInfo(player.sireLine);
  const map = getMap(player.mapId);
  const hpMax = maxHp(player);
  const hp = player.combat?.hp ?? hpMax;
  const sp = maxSp(player);
  const expMax = expToNext(player.baseLevel);
  const roosterExpMax = expToNext(player.rooster.level);
  const marketHref = rareDropCount && newestDropId ? `/market?dropId=${newestDropId}` : "/market";

  useEffect(() => {
    if (!menuOpen) return;
    const dialog = menuDialogRef.current;
    const returnFocus = menuToggleRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
    ) ?? []);
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const targets = focusable();
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocus?.focus({ preventScroll: true });
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!walletCopied) return;
    const timeout = window.setTimeout(() => setWalletCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [walletCopied]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function runAndClose(action?: () => void) {
    closeMenu();
    action?.();
  }

  function copyWallet() {
    if (!address) return;
    void navigator.clipboard?.writeText(address).then(
      () => setWalletCopied(true),
      () => setWalletCopied(false),
    );
  }

  return (
    <div className={`${styles.shell}${className ? ` ${className}` : ""}`} data-game-hud-overlay>
      <section className={styles.profileDock} aria-label="Player status" data-collapsed={profileCollapsed}>
        <div className={styles.profile}>
          <button
            type="button"
            className={styles.profileCollapse}
            aria-label={profileCollapsed ? "Expand player status" : "Collapse player status"}
            aria-expanded={!profileCollapsed}
            aria-pressed={profileCollapsed}
            onClick={() => setProfileCollapse(!profileCollapsed)}
            title={profileCollapsed ? "Expand player status" : "Collapse player status"}
          >
            <span aria-hidden="true">{profileCollapsed ? "+" : "−"}</span>
          </button>
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
          <div className={styles.compactStatus}>
            <span>Lv.{player.baseLevel} · {player.control?.mode === "manual" ? "Manual" : "Auto"}</span>
            <span>HP {hp.toLocaleString()}/{hpMax.toLocaleString()}</span>
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
          ref={menuToggleRef}
          type="button"
          className={styles.menuToggle}
          data-game-menu-toggle
          aria-label="Open game menu"
          aria-expanded={menuOpen}
          aria-controls="game-menu-sheet"
          onClick={() => setMenuOpen(true)}
          title="Open game menu"
        >
          <GameChromeIcon name="menu" width={25} height={25} />
        </button>
        <div className={styles.menuLayer} data-game-menu hidden={!menuOpen}>
            <button
              type="button"
              className={styles.menuBackdrop}
              aria-label="Close game menu"
              onClick={closeMenu}
            />
            <section
              ref={menuDialogRef}
              id="game-menu-sheet"
              className={styles.menuPanel}
              role={menuOpen ? "dialog" : undefined}
              aria-modal={menuOpen ? true : undefined}
              aria-labelledby={menuOpen ? "game-menu-title" : undefined}
            >
              <header className={styles.menuHeader}>
                <span className={styles.menuBrand}>
                  <RoosterMark size={38} riverside />
                  <span>
                    <strong id="game-menu-title">RFC Legends</strong>
                    <small><span lang="th">เมนูการเดินทาง</span> · Riverside</small>
                  </span>
                </span>
                <button type="button" className={styles.menuClose} onClick={closeMenu} aria-label="Close game menu">
                  <span aria-hidden="true">×</span>
                </button>
              </header>

              <div className={styles.menuScroll}>
                <section className={styles.menuSection} aria-labelledby="game-actions-title">
                  <h2 id="game-actions-title" className={styles.menuSectionTitle}>Game</h2>
                  <div className={styles.actionGrid}>
                    {onOpenBag ? (
                      <button
                        type="button"
                        className={styles.menuAction}
                        onClick={() => runAndClose(onOpenBag)}
                        aria-label={`Bag & drops (${bagCount ?? 0} items)`}
                        title={`Bag & drops (${bagCount ?? 0} items)`}
                      >
                        <GameChromeIcon name="bag" width={24} height={24} />
                        <span>Bag</span>
                        {(bagCount ?? 0) > 0 ? <span className={styles.badge}>{bagCount}</span> : null}
                      </button>
                    ) : null}
                    {onOpenGuild ? (
                      <button
                        type="button"
                        className={styles.menuAction}
                        onClick={() => runAndClose(onOpenGuild)}
                        aria-label="Guild chat & boss"
                        title="Guild chat & boss"
                      >
                        <GameChromeIcon name="guild" width={24} height={24} />
                        <span>Guild</span>
                      </button>
                    ) : null}
                    {statCta ? (
                      <span className={styles.providedSlot} onClickCapture={closeMenu}>{statCta}</span>
                    ) : null}
                    <a className={styles.menuLink} href={marketHref} aria-label="Open the Rare Market" title="Open the Rare Market">
                      <GameChromeIcon name="market" width={24} height={24} />
                      <span>Market</span>
                      {(rareDropCount ?? 0) > 0 ? <span className={styles.badge}>{rareDropCount}</span> : null}
                    </a>
                  </div>
                </section>

                <section className={styles.menuSection} aria-labelledby="journey-links-title">
                  <h2 id="journey-links-title" className={styles.menuSectionTitle}>Journey</h2>
                  <div className={styles.linkList}>
                    <Link href="/" className={styles.siteLink} onClick={closeMenu}>
                      <RoosterMark size={29} riverside />
                      <span><strong>Home</strong><small>RFC Legends home</small></span>
                      <span aria-hidden="true">›</span>
                    </Link>
                    <Link href="/roosters" className={styles.siteLink} onClick={closeMenu}>
                      <SireLineArt line={player.sireLine} size={29} className="rounded-full" theme="riverside" />
                      <span><strong>My Roosters</strong><small>Collection & pedigree</small></span>
                      <span aria-hidden="true">›</span>
                    </Link>
                  </div>
                </section>

                <section className={styles.menuSection} aria-labelledby="settings-title">
                  <h2 id="settings-title" className={styles.menuSectionTitle}>Settings</h2>
                  {audioSettings ? <div className={styles.audioSettings}>{audioSettings}</div> : null}
                  {syncSlot ? (
                    <div className={styles.utilityRow} onClickCapture={closeMenu}>
                      <span><strong>Sync progress</strong><small>Refresh server data now</small></span>
                      <span className={styles.syncSlot}>{syncSlot}</span>
                    </div>
                  ) : null}
                </section>

                <section className={styles.walletSection} aria-label="Wallet">
                  <div className={styles.walletHeading}>
                    <GameChromeIcon name="wallet" width={22} height={22} />
                    <span><strong>Wallet</strong><small>{isConnected ? "Connected" : "Connect to save progress"}</small></span>
                    {isConnected ? <span className={styles.connectedDot} aria-label="Connected" /> : null}
                  </div>
                  {isConnected && address ? (
                    <button type="button" className={styles.walletCopy} onClick={copyWallet}>
                      <span className={styles.walletAddress}>{address.slice(0, 8)}…{address.slice(-6)}</span>
                      <span>{walletCopied ? "Copied" : "Copy"}</span>
                    </button>
                  ) : null}
                  <div className={styles.connectSlot}><ConnectButton /></div>
                  <span className={styles.copyStatus} aria-live="polite">{walletCopied ? "Wallet address copied" : ""}</span>
                </section>
              </div>
            </section>
        </div>
      </nav>

      {movementSlot ? <div className={styles.bottomLeft}>{movementSlot}</div> : null}
      {actionSlot ? <div className={styles.bottomRight}>{actionSlot}</div> : null}
    </div>
  );
}
