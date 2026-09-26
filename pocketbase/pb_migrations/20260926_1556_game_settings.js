/// <reference path="../pb_data/types.d.ts" />
// Game lane — codify the batch API setting (interfaces.md §5b). Settings live in the instance
// data, not in migrations, so a fresh instance (or one restored from a settings backup) can come
// up with batch DISABLED — which 403s the game engine's saveDrops batch transaction and breaks
// every /api/game sync that rolls drops. This migration enforces it on every boot. Idempotent:
// setting the same values again is a no-op. (PbGameStore keeps a sequential-create fallback for
// instances that still refuse batch.)

migrate(
  (db) => {
    const s = db.settings()
    s.batch.enabled = true
    s.batch.maxRequests = 200 // >= MAX_DROPS_PER_SYNC (100) in apps/web/src/server/game/index.ts
    db.save(s)
  },
  (db) => {
    const s = db.settings()
    s.batch.enabled = false // revert to the state this migration was written to fix
    s.batch.maxRequests = 50
    db.save(s)
  },
)
