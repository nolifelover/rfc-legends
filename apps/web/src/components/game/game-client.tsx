"use client";

// Owns the /game flow: connect wallet → create trainer → play screen.
// The scene frame hosts the live Phaser idle-combat canvas (G4); the HUD strip
// (sticky to the viewport bottom) and stat panel run on live engine numbers.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { Drop, Player, SireLine, StatKey } from "@/game/types";
import { MINTABLE_RARITIES } from "@/game/data/items";
import type { SyncResult } from "@/server/game";
import { reasonText } from "./api-messages";
import { ConnectButton } from "./connect-button";
import { WrongChainBanner } from "@/components/market/WrongChainBanner";
import { CreateCharacter, type CreateOutcome } from "./create-character";
import { DropToasts } from "./drop-toasts";
import { GuildDock } from "./guild-dock";
import { HudStrip } from "./hud-strip";
import { nextGoalLine } from "./next-goal";
import { WelcomeBack, type WelcomeBackSummary } from "./welcome-back";
import { IdleScene } from "./idle-scene";
import { InventoryDrawer } from "./inventory-drawer";
import { SceneFrame } from "./scene-frame";
import { StatPanel, type AllocateResult } from "./stat-panel";
import { GameChromeIcon } from "./game-chrome-icon";

interface GameState {
  player: Player | null;
  drops: Drop[];
  demoMode: boolean;
}

async function postGame(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: { reason?: string } & Record<string, unknown> }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON body — treat as empty
  }
  return { ok: res.ok, status: res.status, data };
}

const riversideBackdrop = `
  radial-gradient(120% 90% at 50% 108%, rgba(28,78,94,0.50) 0%, rgba(28,78,94,0) 46%),
  radial-gradient(140% 110% at 50% -30%, rgba(242,180,91,0.12) 0%, rgba(242,180,91,0) 40%),
  repeating-linear-gradient(135deg, rgba(255,253,246,0.018) 0 2px, rgba(0,0,0,0) 2px 26px),
  linear-gradient(180deg, #102b43 0%, #183946 58%, #102b43 100%)`;

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div data-riverside-ui className="flex min-h-0 flex-1 flex-col" style={{ background: riversideBackdrop }}>
      <style>{`
        [data-riverside-ui] h1 { color: #fffdf6; }
        [data-riverside-ui] p { color: rgba(255,253,246,.78); }
      `}</style>
      <section className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
        {children}
      </section>
    </div>
  );
}

export function GameClient() {
  const { address, chainId, isConnected } = useConnection();
  const wrongChain = Boolean(address && chainId && chainId !== 11155111);
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [bagOpen, setBagOpen] = useState(false);
  const [guildOpen, setGuildOpen] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState<WelcomeBackSummary | null>(null);
  const stateKey = ["game-state", address] as const;

  // Auto-dismiss notices.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  // Boot sequence (QA fix): POST /api/game/sync FIRST — otherwise the state
  // GET settles the away window server-side before the client ever sees it,
  // and the welcome-back modal can never fire on reload.
  const [booted, setBooted] = useState(false);
  // celebrations pause at boot until the welcome-back decision lands; if no
  // card opens, they arm 1.5s later. A card holds them until Collect (N2).
  const [celebrationsArmed, setCelebrationsArmed] = useState(false);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    // P3: a wallet that has never created a player would 400 here, so only
    // wallets with a known player boot via sync (the welcome-back path).
    // PLAYER_NOT_FOUND clears the flag and falls through silently.
    const playerFlag = `rfcl:player:${address.toLowerCase()}`;
    if (typeof window !== "undefined" && !window.localStorage.getItem(playerFlag)) {
      setBooted(true);
      return;
    }
    (async () => {
      try {
        const { ok, data } = await postGame("/api/game/sync", { address });
        if (!cancelled && ok === false && data.reason === "PLAYER_NOT_FOUND") {
          window.localStorage.removeItem(playerFlag);
        }
        if (!cancelled && ok && data.player) {
          window.localStorage.setItem(playerFlag, "1");
          const prev = stateQuery.data?.player;
          applyPlayer(data.player as Player);
          considerWelcomeBack(
            {
              live: (data.live ?? null) as SyncResult["live"],
              offline: (data.offline ?? null) as SyncResult["offline"],
              player: data.player as Player,
            },
            prev ?? undefined,
          );
        }
      } catch {
        /* PLAYER_NOT_FOUND and transient errors: the state query takes over */
      } finally {
        if (!cancelled) {
          setBooted(true);
          window.setTimeout(() => !cancelled && setCelebrationsArmed(true), 1500);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const stateQuery = useQuery({
    queryKey: stateKey,
    enabled: !!address && booted,
    // Interval polling pauses while the tab is hidden (refetchIntervalInBackground
    // defaults to false), so the server only advances the game while watched.
    refetchInterval: 4000,
    queryFn: async (): Promise<GameState> => {
      const res = await fetch(`/api/game/state?address=${address}`);
      const data = (await res.json()) as GameState & { reason?: string };
      if (!res.ok) throw new Error(data.reason ?? "INTERNAL");
      return data;
    },
  });

  function applyPlayer(player: Player) {
    queryClient.setQueryData<GameState>(stateKey, (old) =>
      old ? { ...old, player } : { player, drops: [], demoMode: false },
    );
  }

  /** ≥60s away → the welcome-back card; otherwise the quiet sync notice. */
  function considerWelcomeBack(
    result: { player: Player; live: SyncResult["live"]; offline: SyncResult["offline"] },
    prev?: Player,
  ): void {
    const live = result.live;
    const offline = result.offline;
    const awaySec = (live?.ticks ?? 0) + (offline?.seconds ?? 0);
    const exp = (live?.expGained ?? 0) + (offline?.expGained ?? 0);
    const kills = (live?.kills ?? 0) + (offline?.kills ?? 0);
    if (awaySec >= 60 && (exp > 0 || kills > 0 || (offline?.drops?.length ?? 0) > 0)) {
      setWelcomeBack({
        seconds: awaySec,
        expGained: exp,
        roosterExpGained: (live?.roosterExpGained ?? 0) + (offline?.roosterExpGained ?? 0),
        baseLevelsGained: prev ? Math.max(0, result.player.baseLevel - prev.baseLevel) : 0,
        roosterLevelsGained: prev ? Math.max(0, result.player.rooster.level - prev.rooster.level) : 0,
        kills,
        drops: offline?.drops?.length ?? 0,
      });
    } else {
      setNotice(
        exp > 0 || kills > 0
          ? { kind: "info", text: `Synced — +${exp.toLocaleString()} EXP, ${kills} defeated.` }
          : { kind: "info", text: "Synced — everything already up to date." },
      );
    }
  }

  async function handleCreate(name: string, sireLine: SireLine): Promise<CreateOutcome> {
    if (!address) return { ok: false, reason: "INVALID_ADDRESS" };
    const { ok, data } = await postGame("/api/game/create", { address, name, sireLine });
    if (ok) {
      applyPlayer(data.player as Player);
      await queryClient.invalidateQueries({ queryKey: stateKey });
      setNotice({ kind: "info", text: `Welcome, ${name}! Your journey begins at Home Fields.` });
      return { ok: true };
    }
    if (data.reason === "PLAYER_EXISTS") {
      await queryClient.invalidateQueries({ queryKey: stateKey });
      return { ok: false, reason: "PLAYER_EXISTS" };
    }
    return { ok: false, reason: data.reason };
  }

  async function handleAllocate(stat: StatKey): Promise<AllocateResult> {
    if (!address) return { ok: false, reason: "INVALID_ADDRESS" };
    const { ok, data } = await postGame("/api/game/allocate", {
      address,
      allocations: { [stat]: 1 },
    });
    if (ok) {
      applyPlayer(data.player as Player); // optimistic from the response
      return { ok: true };
    }
    setNotice({ kind: "error", text: reasonText(data.reason) });
    return { ok: false, reason: data.reason };
  }

  const syncMutation = useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      if (!address) throw new Error("INVALID_ADDRESS");
      const { ok, data } = await postGame("/api/game/sync", { address });
      if (!ok) throw new Error((data.reason as string) ?? "INTERNAL");
      return data as unknown as SyncResult;
    },
    onSuccess: (result) => {
      const prev = stateQuery.data?.player ?? undefined;
      applyPlayer(result.player);
      // F2: drops the server just persisted must surface immediately (the
      // runbook allows <=3s; the 4s poll alone could add up to ~4.5s)
      void queryClient.invalidateQueries({ queryKey: stateKey });
      considerWelcomeBack(result, prev);
    },
    onError: (err) => setNotice({ kind: "error", text: reasonText(err.message) }),
  });

  // no boot sync (first visit): celebrations can arm right away
  useEffect(() => {
    if (booted && !celebrationsArmed) {
      const t = window.setTimeout(() => setCelebrationsArmed(true), 1500);
      return () => window.clearTimeout(t);
    }
  }, [booted, celebrationsArmed]);

  // Any successful state load with a player arms the sync-first boot for
  // this wallet's next visit (P3 companion to the localStorage gate).
  useEffect(() => {
    if (address && stateQuery.data?.player) {
      window.localStorage.setItem(`rfcl:player:${address.toLowerCase()}`, "1");
    }
  }, [address, stateQuery.data?.player]);

  // Unminted mintable drops → the HUD pill count (fresh ones also toast).
  const unminted = (stateQuery.data?.drops ?? []).filter(
    (d) => d.status === "unminted" && (MINTABLE_RARITIES as readonly string[]).includes(d.rarity),
  )
  const rareDropCount = unminted.length
  const newestDropId =
    unminted.length > 0
      ? [...unminted].sort((a, b) => b.droppedAt - a.droppedAt)[0].dropId
      : undefined

  // 1. No wallet connected → invite to connect.
  if (!isConnected || !address) {
    return (
      <CenterCard>
        <h1 className="text-2xl font-black tracking-tight text-bark sm:text-3xl">
          Connect your wallet to begin your journey
        </h1>
        <p className="max-w-sm text-sm leading-relaxed text-bark-soft">
          Your wallet <strong className="text-bark">is</strong> your player identity — your
          trainer, rooster and rare drops all live under its address.
        </p>
        {/* The primary action, front and center: a cold visitor (or the
            presenter) should never have to hunt for the ☰ menu to start. */}
        <ConnectButton className="!px-8 !py-4 !text-xl" />
      </CenterCard>
    );
  }

  // 2. Loading first state for a connected wallet.
  if (stateQuery.isLoading) {
    return (
      <CenterCard>
        <span
          className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-clay/30 border-t-clay"
          aria-hidden
        />
        <p className="text-sm font-semibold text-bark-soft">Waking the fields…</p>
      </CenterCard>
    );
  }

  if (stateQuery.isError) {
    return (
      <CenterCard>
        <h1 className="text-xl font-black text-bark">The fields are resting</h1>
        <p role="alert" className="text-sm text-clay-deep">
          {reasonText((stateQuery.error as Error).message)}
        </p>
        <button
          type="button"
          onClick={() => stateQuery.refetch()}
          className="rounded-xl bg-field px-5 py-2.5 font-bold text-cream hover:bg-field-deep"
        >
          Try again
        </button>
      </CenterCard>
    );
  }

  const state = stateQuery.data;

  // 3. Wallet, no player yet → character creation.
  if (!state?.player) {
    return (
      <div data-riverside-ui data-riverside-create className="flex flex-1 flex-col gap-2" style={{ background: riversideBackdrop }}>
        <style>{`
          [data-riverside-ui] h1 { color: #fffdf6; }
          [data-riverside-ui] p { color: rgba(255,253,246,.78); }
          [data-riverside-create] > section { background-color: rgba(40,59,99,.96); border-color: #c69a5b; }
          [data-riverside-create] label, [data-riverside-create] legend { color: #f2d59d; }
          [data-riverside-create] input { background-color: #fffdf6; }
          [data-riverside-create] button.group { background-color: #fffdf6; }
        `}</style>
        {wrongChain ? <WrongChainBanner chainId={chainId ?? 0} /> : null}
        <CreateCharacter onCreate={handleCreate} />
      </div>
    );
  }

  // 4. Player exists → the game screen. The canvas claims the viewport;
  // stat allocation and sync collapse into a single slim control row.
  const player = state.player;
  // Riverside-night backdrop: the letterbox around the 16:9 stage reads as
  // part of the game, not a web page.
  return (
    <div
      data-riverside-ui
      className="flex min-h-0 flex-1 flex-col"
      style={{
        background: riversideBackdrop,
      }}
    >
      <style>{`
        [data-riverside-ui] { background: #102b43 !important; }
        [data-riverside-ui] .aspect-video { background-color: #102b43 !important; border-color: #c69a5b !important; }
        [data-riverside-ui] .rounded-2xl.border-4 { border-color: #c69a5b !important; }
        [data-riverside-ui] [class*="bg-[#2b1b12]"] { background-color: rgba(40,59,99,.96) !important; }
        [data-riverside-ui] [class*="border-sun"] { border-color: #c69a5b !important; }
        [data-riverside-ui] [class*="bg-sun"] { background-color: #f2b45b !important; }
      `}</style>
      <div className="mx-auto flex w-full max-w-none flex-1 flex-col gap-1 px-1.5 py-1 sm:px-2 sm:py-1.5">
        {wrongChain ? <WrongChainBanner chainId={chainId ?? 0} /> : null}
        <div className="relative flex min-h-0 flex-1 justify-center">
          {/* height = whatever the nav/banner/HUD leave free; the aspect-video
              box derives width from that height, clamped by the viewport */}
          {/* --game-top-inset tells the scene how much chrome sits above it
              (mobile top bar) so in-canvas chips stay clear; 0 on desktop */}
          <SceneFrame className="h-full w-auto max-w-full [--game-top-inset:0px]">
            <IdleScene player={player} drops={state.drops} demoMode={state.demoMode} />
          </SceneFrame>
        </div>

      </div>

      <HudStrip
        player={player}
        statCta={<StatPanel player={player} onAllocate={handleAllocate} />}
        goal={nextGoalLine(player)}
        syncSlot={
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            aria-label="Sync now"
            title={syncMutation.isPending ? "Syncing…" : "Sync now"}
            className="grid h-10 w-10 place-items-center rounded-full border-2 border-clay/40 bg-cream text-xl font-black text-clay-deep transition hover:border-clay hover:bg-sun-soft/50 disabled:cursor-wait disabled:opacity-60"
          >
            {syncMutation.isPending ? "…" : <GameChromeIcon name="sync" className="h-5 w-5" />}
          </button>
        }
        rareDropCount={rareDropCount}
        newestDropId={newestDropId}
        bagCount={Object.values(player.inventory).reduce((a, b) => a + b, 0)}
        onOpenBag={() => setBagOpen(true)}
        onOpenGuild={() => setGuildOpen(true)}
      />

      <InventoryDrawer
        open={bagOpen}
        onClose={() => setBagOpen(false)}
        player={player}
        drops={state.drops}
      />
      <GuildDock
        open={guildOpen}
        onClose={() => setGuildOpen(false)}
        address={player.address as `0x${string}`}
        name={player.name}
      />

      {welcomeBack ? (
        <WelcomeBack
          summary={welcomeBack}
          onCollect={() => {
            setWelcomeBack(null);
            void queryClient.invalidateQueries({ queryKey: stateKey });
          }}
        />
      ) : null}

      <DropToasts drops={state.drops} hold={welcomeBack != null || !celebrationsArmed} />

      {notice ? (
        <div
          role="status"
          className={`fixed bottom-32 right-4 z-50 max-w-xs rounded-xl px-4 py-3 text-sm font-bold shadow-lg ${
            notice.kind === "error"
              ? "bg-clay-deep text-cream"
              : "bg-field-deep text-cream"
          }`}
        >
          {notice.text}
        </div>
      ) : null}
    </div>
  );
}
