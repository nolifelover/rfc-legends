/// <reference path="../pb_data/types.d.ts" />
// Guild lane — follow-up to 20260926_1830_guild_chat_boss.js.
// PocketBase's required validation treats 0 and {} as blank, which rejected
// guild_boss rows at rest (hp: 0 on a kill, contributors: {} on spawn,
// defeated_at: 0 while alive). These fields are server-written anyway, so
// they drop required here. Runs after the base migration on fresh setups and
// fixes databases that already applied it.

migrate(
  (db) => {
    const boss = db.findCollectionByNameOrId("guild_boss")
    for (const name of ["hp", "contributors", "defeated_at"]) {
      boss.fields.find((f) => f.name === name).required = false
    }
    db.save(boss)
  },
  (db) => {
    const boss = db.findCollectionByNameOrId("guild_boss")
    for (const name of ["hp", "contributors", "defeated_at"]) {
      boss.fields.find((f) => f.name === name).required = true
    }
    db.save(boss)
  },
)
