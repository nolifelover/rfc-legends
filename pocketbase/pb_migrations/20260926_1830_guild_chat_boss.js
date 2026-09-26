/// <reference path="../pb_data/types.d.ts" />
// Guild lane (GDD §11.3, vertical slice) — guild chat + guild boss.
//
// guild_messages: publicly listable/subscribable (listRule ""), so the
// browser SDK can subscribe through the /pb/ proxy. All writes go through
// POST /api/game/guild/chat, which attaches the wallet address and rate
// limits. Everything else (create/update/delete) is superuser-only (null).
//
// guild_boss: one row per guild. Public read/subscribe; only server routes
// mutate it (idle damage chips it down; defeat records contributors and
// spawns the next floor).

migrate(
  (db) => {
    const messages = new Collection({
      name: "guild_messages",
      type: "base",
      listRule: "", // public read + realtime subscribe
      viewRule: "",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "guild", type: "text", required: true, min: 2, max: 32 }, // slug, e.g. "tower"
        { name: "address", type: "text", required: true, min: 42, max: 42 }, // set by the server route
        { name: "name", type: "text", required: true, max: 32 }, // display name
        { name: "text", type: "text", required: true, min: 1, max: 280 },
        { name: "created", type: "autodate", onCreate: true },
      ],
    })
    messages.addIndex("idx_guild_messages_guild_created", false, "guild, created", "")
    db.save(messages)

    const boss = new Collection({
      name: "guild_boss",
      type: "base",
      listRule: "", // public read + realtime subscribe
      viewRule: "",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "guild", type: "text", required: true, min: 2, max: 32 },
        { name: "floor", type: "number", required: true, min: 1, max: 999 }, // tower floor number
        { name: "name", type: "text", required: true, max: 64 },
        // required is false on these because PocketBase treats 0 and {} as
        // "blank": hp hits 0 on a kill and contributors starts empty.
        { name: "hp", type: "number", required: false, min: 0 },
        { name: "max_hp", type: "number", required: true, min: 1 },
        { name: "contributors", type: "json", required: false }, // { address: { name, damage } }
        { name: "defeated_at", type: "number", required: false }, // epoch ms, absent/0 while alive
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    boss.addIndex("idx_guild_boss_guild_unique", true, "guild", "")
    db.save(boss)
  },
  (db) => {
    db.delete(db.findCollectionByNameOrId("guild_boss"))
    db.delete(db.findCollectionByNameOrId("guild_messages"))
  },
)
