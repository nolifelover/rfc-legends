# PocketBase

The single backend store for RFC Legends. It holds player state and drops (the game engine's `GameStore`), World ID nullifier bindings (with a unique index), and guild chat and the guild boss (realtime subscriptions).

```sh
./fetch.sh        # download the pinned binary (v0.40.4)
./pocketbase superuser upsert <email> <password> --dir pb_data
./run.sh          # serves http://127.0.0.1:8090, applies pb_migrations/
```

Schema lives in `pb_migrations/` as JS migrations, prefixed by lane: `*_game_*.js` and `*_guild_*.js` belong to the game lane, and `*_worldid_*.js` belongs to the World ID lane. The Next.js server connects with the superuser credentials from `apps/web/.env.local`. Browsers only read the collections whose API rules allow it (guild chat).
