'use client'

/**
 * Self-contained guild panel: chat + boss HP (GDD §11.3 vertical slice).
 * eth-dev2 mounts it in the game HUD:
 *
 *   <GuildPanel address={address} name={player.name} guild="tower" />
 *
 * Props:
 *   address  the connected wallet (required; used as chat identity)
 *   name     display name (optional; falls back to a short address)
 *   guild    guild slug (optional; default "tower")
 *
 * Reads are realtime via the PocketBase SDK (through the /pb/ proxy); writes
 * go through /api/game/guild/* so the server attaches and rate limits.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import PocketBase from 'pocketbase'

interface ChatMessage {
  id: string
  address: string
  name: string
  text: string
  created: string
}

interface Contributor {
  address: string
  name: string
  damage: number
}

interface BossState {
  floor: number
  name: string
  hp: number
  max_hp: number
  contributors: Contributor[]
  defeated_at: number
}

export default function GuildPanel({
  address,
  name,
  guild = 'tower',
}: {
  address: `0x${string}`
  name?: string
  guild?: string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [boss, setBoss] = useState<BossState | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const displayName = name?.trim() || `${address.slice(0, 6)}…${address.slice(-4)}`

  const flashNotice = useCallback((msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 3500)
  }, [])

  // Initial fetch + realtime subscriptions (poll fallback if SSE fails).
  useEffect(() => {
    let pb: PocketBase | null = null
    let poll: number | undefined
    let alive = true

    async function refresh() {
      try {
        const [chatRes, bossRes] = await Promise.all([
          fetch(`/api/game/guild/chat?guild=${encodeURIComponent(guild)}&limit=50`),
          fetch(`/api/game/guild/boss?guild=${encodeURIComponent(guild)}`),
        ])
        if (!alive) return
        if (chatRes.ok) setMessages((await chatRes.json()).messages ?? [])
        if (bossRes.ok) setBoss((await bossRes.json()).boss ?? null)
      } catch {
        /* offline; realtime or next poll retries */
      }
    }
    refresh()

    // The 5s poll ALWAYS runs (F1: realtime through some proxies — Cloudflare
    // in front of SSE — silently never delivers, so polling is the safety
    // net, not a fallback). Realtime, when it connects, upgrades the dot to
    // "live" and makes updates instant; its first failure is logged.
    poll = window.setInterval(refresh, 5000)

    try {
      const base = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? '/pb/'
      pb = new PocketBase(base)
    } catch (err) {
      console.warn('[guild] PocketBase client unavailable, polling only', err)
    }
    if (pb) {
      pb.autoCancellation(false)
      const msgFilter = pb.filter('guild = {:guild}', { guild })
      let loggedFirstFailure = false
      const firstFailure = (what: string) => (err: unknown) => {
        if (!loggedFirstFailure) {
          loggedFirstFailure = true
          console.warn('[guild] realtime subscribe failed, 5s polling carries it', what, err)
        }
        setLive(false)
      }
      pb.collection('guild_messages')
        .subscribe('*', (e) => {
          if (e.action !== 'create') return
          const r = e.record as unknown as ChatMessage
          setLive(true)
          setMessages((prev) => (prev.some((m) => m.id === r.id) ? prev : [...prev, { ...r, created: String(r.created) }]))
        }, { filter: msgFilter })
        .catch(firstFailure('guild_messages'))
      pb.collection('guild_boss')
        .subscribe('*', (e) => {
          const r = e.record as unknown as { guild: string; floor: number; name: string; hp: number; max_hp: number; contributors: Record<string, { name: string; damage: number }> }
          if (r.guild !== guild) return
          setLive(true)
          const contributors = Object.entries(r.contributors ?? {})
            .map(([a, c]) => ({ address: a, name: c.name, damage: c.damage }))
            .sort((x, y) => y.damage - x.damage)
          setBoss({
            floor: r.floor,
            name: r.name,
            hp: r.hp,
            max_hp: r.max_hp,
            contributors,
            defeated_at: 0,
          })
        }, { filter: msgFilter })
        .catch(firstFailure('guild_boss'))
    }

    return () => {
      alive = false
      if (poll) window.clearInterval(poll)
      pb?.collection('guild_messages').unsubscribe()
      pb?.collection('guild_boss').unsubscribe()
    }
  }, [guild])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  async function send() {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/game/guild/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guild, address, name: displayName, text }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'failed' }))
        flashNotice(err.error ?? 'could not send')
      } else {
        const { message } = await res.json()
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]))
        setDraft('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function strike() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/game/guild/boss/hit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guild,
          address,
          name: displayName,
          damage: 5 + Math.floor(Math.random() * 21), // idle damage, vertical slice
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'failed' }))
        flashNotice(err.error ?? 'strike failed')
        return
      }
      const data = await res.json()
      setBoss({ ...data.boss, contributors: data.boss.contributors })
      if (data.defeated && data.reward?.tier) {
        flashNotice(`Boss down! You earned a ${data.reward.tier} reward 🎉`)
      }
    } finally {
      setBusy(false)
    }
  }

  const hpPct = boss ? Math.max(0, Math.round((boss.hp / boss.max_hp) * 100)) : 0

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-amber-900/40 bg-stone-950/80 p-3 text-stone-100">
      {/* Boss */}
      <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-2">
        {boss ? (
          <>
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-semibold">
                🐓 {boss.name} <span className="text-stone-400">· Floor {boss.floor}</span>
              </span>
              <span className="tabular-nums text-stone-400">
                {boss.hp.toLocaleString()} / {boss.max_hp.toLocaleString()} HP
              </span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-stone-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-red-600 to-amber-500 transition-all duration-500"
                style={{ width: `${hpPct}%` }}
                role="progressbar"
                aria-valuenow={hpPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="guild boss HP"
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-stone-400">
                {boss.contributors.length > 0
                  ? `Top: ${boss.contributors[0].name} (${boss.contributors[0].damage.toLocaleString()} dmg)`
                  : 'No damage yet — strike first!'}
              </span>
              <button
                onClick={strike}
                disabled={busy}
                className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-stone-950 hover:bg-amber-500 disabled:opacity-50"
              >
                ⚔️ Strike
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-stone-400">Loading guild boss…</div>
        )}
      </div>

      {/* Chat */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between text-xs font-semibold text-stone-300">
          <span>
            💬 Guild chat <span className="text-stone-500">#{guild}</span>
          </span>
          <span
            title={live ? ' realtime' : ' polling every 5s'}
            className="flex items-center gap-1 text-stone-500"
          >
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-amber-400'}`}
            />
            {live ? 'live' : 'polling'}
          </span>
        </div>
        <div ref={listRef} className="h-44 overflow-y-auto rounded-lg bg-stone-900/60 p-2 text-sm">
          {messages.length === 0 && <div className="text-xs text-stone-500">No messages yet. Say hi!</div>}
          {messages.map((m) => (
            <div key={m.id} className="leading-snug">
              <span
                className={`font-semibold ${m.address.toLowerCase() === address.toLowerCase() ? 'text-amber-400' : 'text-emerald-400'}`}
              >
                {m.name}
              </span>
              <span className="text-stone-300">: {m.text}</span>
            </div>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            send()
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={280}
            placeholder="Message your camp…"
            className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-900 px-2 py-1 text-sm outline-none focus:border-amber-600"
          />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-stone-950 hover:bg-emerald-500 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      {notice && (
        <div className="rounded-md border border-amber-700/50 bg-amber-900/30 px-2 py-1 text-center text-xs text-amber-300">
          {notice}
        </div>
      )}
    </div>
  )
}
