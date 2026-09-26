"use client";

// Owns the /game flow: connect wallet → create trainer → play screen.
// The scene frame hosts the live Phaser idle-combat canvas (G4); the HUD strip
// (sticky to the viewport bottom) and stat panel run on live engine numbers.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { Drop, Player, SireLine, StatKey } from "@/game/types";
import type { SyncResult } from "@/server/game";
import { reasonText } from "./api-messages";
import { ConnectButton } from "./connect-button";
import { CreateCharacter, type CreateOutcome } from "./create-character";
import { HudStrip } from "./hud-strip";
import { IdleScene } from "./idle-scene";
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
      applyPlayer(result.player);
      const exp = (result.live?.expGained ?? 0) + (result.offline?.expGained ?? 0);
      const kills = (result.live?.kills ?? 0) + (result.offline?.kills ?? 0);
      setNotice(
        exp > 0 || kills > 0
          ? { kind: "info", text: `Synced — +${exp.toLocaleString()} EXP, ${kills} defeated.` }
          : { kind: "info", text: "Synced — everything already up to date." },
      );
    },
    onError: (err) => setNotice({ kind: "error", text: reasonText(err.message) }),
  });

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

  // 4. Player exists → the game screen (pre-Phaser).
  const player = state.player;
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-bark-soft">
              auto-syncs every few seconds
            </span>
          </div>
          <button
            type="button"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="rounded-full border-2 border-clay/40 bg-cream px-4 py-1.5 text-sm font-bold text-clay-deep transition hover:border-clay hover:bg-sun-soft/50 disabled:cursor-wait disabled:opacity-60"
          >
            {syncMutation.isPending ? "Syncing…" : "Sync now"}
          </button>
        </div>

        <SceneFrame>
          <IdleScene player={player} drops={state.drops} demoMode={state.demoMode} />
        </SceneFrame>

        <StatPanel player={player} onAllocate={handleAllocate} />
      </div>

      <HudStrip player={player} />

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
