// Production wiring for the World ID store: PocketBase through the shared
// superuser client (server/pb.ts). Kept apart from store-pb.ts so tests can
// use that class without importing a server-only module.

import { getPb, pbConfigured } from "../pb";
import { WorldIdConfigError } from "./config";
import { PocketBaseWorldIdStore } from "./store-pb";
import type { WorldIdStore } from "./store";

let store: WorldIdStore | null = null;

/** The app-wide store. Throws (-> 503) rather than silently dropping the sybil guard when PocketBase isn't configured. */
export function getWorldIdStore(): WorldIdStore {
  if (!pbConfigured()) {
    throw new WorldIdConfigError(
      "World ID storage is not configured: set POCKETBASE_SUPERUSER_EMAIL and POCKETBASE_SUPERUSER_PASSWORD",
    );
  }
  store ??= new PocketBaseWorldIdStore(getPb);
  return store;
}
