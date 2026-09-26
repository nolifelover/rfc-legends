/// <reference path="../pb_data/types.d.ts" />

// World ID lane. The UNIQUE indexes are the sybil guard: one World ID
// nullifier per wallet and one wallet per nullifier are enforced by the
// database, so two concurrent verifications can't both win. All API rules are
// null, so only the superuser (the Next.js server) can read or write.

migrate(
  (app) => {
    const locked = { listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null };
    const timestamps = [
      { name: "created", type: "autodate", onCreate: true, onUpdate: false },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ];

    app.save(
      new Collection({
        type: "base",
        name: "worldid_bindings",
        ...locked,
        fields: [
          // Canonical decimal string of the uint256 nullifier.
          { name: "nullifier", type: "text", required: true, max: 78, pattern: "^[0-9]+$" },
          { name: "address", type: "text", required: true, min: 42, max: 42, pattern: "^0x[0-9a-f]{40}$" },
          { name: "status", type: "select", required: true, maxSelect: 1, values: ["pending", "verified"] },
          { name: "verified_at", type: "date" },
          { name: "tx_hash", type: "text", max: 66 },
          { name: "onchain", type: "select", maxSelect: 1, values: ["marked", "already_marked", "skipped"] },
          ...timestamps,
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_worldid_bindings_nullifier ON worldid_bindings (nullifier)",
          "CREATE UNIQUE INDEX idx_worldid_bindings_address ON worldid_bindings (address)",
        ],
      }),
    );

    app.save(
      new Collection({
        type: "base",
        name: "worldid_nonces",
        ...locked,
        fields: [
          // "rp": RP nonce handed to the IDKit widget, deleted on first use.
          // "wallet": wallet-signature nonce, kept so a replay hits the unique index.
          { name: "kind", type: "select", required: true, maxSelect: 1, values: ["rp", "wallet"] },
          { name: "nonce", type: "text", required: true, max: 130 },
          { name: "address", type: "text", required: true, min: 42, max: 42, pattern: "^0x[0-9a-f]{40}$" },
          { name: "expires_at", type: "number", required: true, onlyInt: true },
          ...timestamps,
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_worldid_nonces_nonce ON worldid_nonces (kind, nonce)",
          "CREATE INDEX idx_worldid_nonces_expires ON worldid_nonces (expires_at)",
        ],
      }),
    );

    app.save(
      new Collection({
        type: "base",
        name: "worldid_vouchers",
        ...locked,
        fields: [
          { name: "address", type: "text", required: true, min: 42, max: 42, pattern: "^0x[0-9a-f]{40}$" },
          { name: "day", type: "text", required: true, min: 10, max: 10 },
          { name: "drop_id", type: "text", required: true, min: 66, max: 66, pattern: "^0x[0-9a-f]{64}$" },
          // 1..MINT_DAILY_LIMIT; the unique (address, day, slot) index makes the daily limit atomic.
          { name: "slot", type: "number", required: true, onlyInt: true, min: 1 },
          ...timestamps,
        ],
        indexes: [
          "CREATE UNIQUE INDEX idx_worldid_vouchers_slot ON worldid_vouchers (address, day, slot)",
          "CREATE UNIQUE INDEX idx_worldid_vouchers_drop ON worldid_vouchers (address, day, drop_id)",
        ],
      }),
    );
  },
  (app) => {
    for (const name of ["worldid_vouchers", "worldid_nonces", "worldid_bindings"]) {
      app.delete(app.findCollectionByNameOrId(name));
    }
  },
);
