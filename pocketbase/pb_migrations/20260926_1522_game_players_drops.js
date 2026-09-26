/// <reference path="../pb_data/types.d.ts" />
// Game lane — players & drops collections (interfaces.md §5b).
// Both are superuser-locked (all API rules null): only server routes touch them, through the
// shared superuser client in apps/web/src/server/pb.ts. Player/Drop state lives in a `data`
// JSON blob so the engine stays decoupled from Player shape churn during the hackathon.

migrate(
  (db) => {
    const players = new Collection({
      name: "players",
      type: "base",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "address", type: "text", required: true, min: 42, max: 42 }, // 0x + 40 hex
        { name: "data", type: "json", required: true }, // whole Player object
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    players.addIndex("idx_players_address_unique", true, "address", "")
    db.save(players)

    const drops = new Collection({
      name: "drops",
      type: "base",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: "address", type: "text", required: true, min: 42, max: 42 },
        { name: "dropId", type: "text", required: true, min: 66, max: 66 }, // bytes32 hex
        { name: "data", type: "json", required: true }, // whole Drop incl. status/txHash
        { name: "created", type: "autodate", onCreate: true },
        { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
    })
    drops.addIndex("idx_drops_address", false, "address", "")
    drops.addIndex("idx_drops_drop_id_unique", true, "dropId", "")
    db.save(drops)
  },
  (db) => {
    db.delete(db.findCollectionByNameOrId("drops"))
    db.delete(db.findCollectionByNameOrId("players"))
  },
)
