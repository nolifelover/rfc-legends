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
import { CreateCharacter, type CreateOutcome } from "./create-character";
import { DropToasts } from "./drop-toasts";
import { GuildDock } from "./guild-dock";
import { HudStrip } from "./hud-strip";
import { NextGoalRibbon } from "./next-goal";
import { WelcomeBack, type WelcomeBackSummary } from "./welcome-back";
import { IdleScene } from "./idle-scene";
import { InventoryDrawer } from "./inventory-drawer";
import { SceneFrame } from "./scene-frame";
import { StatPanel, type AllocateResult } from "./stat-panel";

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

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center sm:px-6">
      {children}
    </section>
  );
}

export function GameClient() {
  const { address, isConnected } = useConnection();
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

  const stateQuery = useQuery({
    queryKey: stateKey,
    enabled: !!address,
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
      const prev = stateQuery.data?.player;
      applyPlayer(result.player);
      const live = result.live;
      const offline = result.offline;
      const awaySec = (live?.ticks ?? 0) + (offline?.seconds ?? 0);
      const exp = (live?.expGained ?? 0) + (offline?.expGained ?? 0);
      const kills = (live?.kills ?? 0) + (offline?.kills ?? 0);
      if (awaySec >= 60 && (exp > 0 || kills > 0 || (offline?.drops?.length ?? 0) > 0) && prev) {
        // "While you were away" — real server numbers only (research #10)
        setWelcomeBack({
          seconds: awaySec,
          expGained: exp,
          roosterExpGained: (live?.roosterExpGained ?? 0) + (offline?.roosterExpGained ?? 0),
          baseLevelsGained: Math.max(0, result.player.baseLevel - (prev?.baseLevel ?? result.player.baseLevel)),
          roosterLevelsGained: Math.max(
            0,
            result.player.rooster.level - (prev?.rooster.level ?? result.player.rooster.level),
          ),
          kills,
          drops: (offline?.drops?.length ?? 0),
        });
      } else {
        setNotice(
          exp > 0 || kills > 0
            ? { kind: "info", text: `Synced — +${exp.toLocaleString()} EXP, ${kills} defeated.` }
            : { kind: "info", text: "Synced — everything already up to date." },
        );
      }
    },
    onError: (err) => setNotice({ kind: "error", text: reasonText(err.message) }),
  });

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
        <ConnectButton className="text-base" />
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
    return <CreateCharacter onCreate={handleCreate} />;
  }

  // 4. Player exists → the game screen. The canvas claims the viewport;
  // stat allocation and sync collapse into a single slim control row.
  const player = state.player;
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-[1700px] flex-1 flex-col gap-3 px-4 py-3 sm:px-6">
        <div className="relative flex min-h-0 flex-1 justify-center">
          {/* height = whatever the nav/banner/HUD leave free; the aspect-video
              box derives width from that height, clamped by the viewport */}
          <SceneFrame className="h-full w-auto max-w-full">
            <IdleScene player={player} drops={state.drops} demoMode={state.demoMode} />
          </SceneFrame>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatPanel player={player} onAllocate={handleAllocate} />
          <div className="flex items-center gap-2">
            <span className="hidden text-[11px] font-semibold text-bark-soft sm:inline">
              auto-syncs
            </span>
            <button
              type="button"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              aria-label="Sync now"
              title={syncMutation.isPending ? "Syncing…" : "Sync now"}
              className="grid h-9 w-9 place-items-center rounded-full border-2 border-clay/40 bg-cream text-base font-black text-clay-deep transition hover:border-clay hover:bg-sun-soft/50 disabled:cursor-wait disabled:opacity-60"
            >
              {syncMutation.isPending ? "…" : "⟳"}
            </button>
          </div>
        </div>
      </div>

      <NextGoalRibbon player={player} demoMode={state.demoMode} />

      <HudStrip
        player={player}
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

      <DropToasts drops={state.drops} />

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
