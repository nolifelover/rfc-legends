// Persistent state for the World ID lane: nullifier -> wallet bindings, issued
// RP nonces, and per-day mint voucher counts. A JSON file under apps/web/.data
// (gitignored) is enough for the demo; writes are serialized in-process and
// replaced atomically so a crash never leaves a half-written file.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Hex } from "../../lib/worldid/types";

export type OnchainStatus = "marked" | "already_marked" | "skipped";

export type NullifierBinding = {
  address: Hex;
  /** "pending" while the onchain mirror is in flight; reserves the nullifier. */
  status: "pending" | "verified";
  verifiedAt: string;
  txHash: Hex | null;
  onchain?: OnchainStatus;
};

export type HumanRecord = {
  nullifier: string;
  verifiedAt: string;
  txHash: Hex | null;
  onchain: OnchainStatus;
};

export type IssuedNonce = {
  address: Hex;
  expiresAt: number;
  usedAt?: string;
};

export type WorldIdState = {
  version: 1;
  /** Keyed by nullifier as a decimal string. */
  bindings: Record<string, NullifierBinding>;
  /** Keyed by lowercase wallet address. */
  humans: Record<string, HumanRecord>;
  /** Keyed by the RP nonce handed to the widget. */
  nonces: Record<string, IssuedNonce>;
  /** address -> UTC day (YYYY-MM-DD) -> dropIds a voucher was issued for. */
  vouchers: Record<string, Record<string, Hex[]>>;
};

export interface WorldIdStore {
  read(): Promise<WorldIdState>;
  /** Runs `fn` on the latest state under a lock and persists whatever it mutated. */
  update<T>(fn: (state: WorldIdState) => T | Promise<T>): Promise<T>;
}

export function emptyState(): WorldIdState {
  return { version: 1, bindings: {}, humans: {}, nonces: {}, vouchers: {} };
}

const NONCE_RETENTION_SECONDS = 24 * 60 * 60;

function pruneNonces(state: WorldIdState, nowSeconds: number) {
  for (const [nonce, entry] of Object.entries(state.nonces)) {
    if (entry.expiresAt + NONCE_RETENTION_SECONDS < nowSeconds) delete state.nonces[nonce];
  }
}

export class MemoryWorldIdStore implements WorldIdStore {
  private state: WorldIdState;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(initial: WorldIdState = emptyState()) {
    this.state = structuredClone(initial);
  }

  async read() {
    return structuredClone(this.state);
  }

  update<T>(fn: (state: WorldIdState) => T | Promise<T>): Promise<T> {
    const run = this.chain.then(async () => {
      const draft = structuredClone(this.state);
      const out = await fn(draft);
      this.state = draft;
      return out;
    });
    this.chain = run.catch(() => undefined);
    return run;
  }
}

export class FileWorldIdStore implements WorldIdStore {
  constructor(private readonly file: string) {}

  async read(): Promise<WorldIdState> {
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as Partial<WorldIdState>;
      return { ...emptyState(), ...parsed, version: 1 };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
      throw err;
    }
  }

  update<T>(fn: (state: WorldIdState) => T | Promise<T>): Promise<T> {
    // One lock per file, shared across module instances (Next dev can load a
    // route module more than once).
    const locks = lockTable();
    const prev = locks.get(this.file) ?? Promise.resolve();
    const run = prev.then(async () => {
      const draft = await this.read();
      const out = await fn(draft);
      pruneNonces(draft, Math.floor(Date.now() / 1000));
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(draft, null, 2));
      await rename(tmp, this.file);
      return out;
    });
    locks.set(
      this.file,
      run.catch(() => undefined),
    );
    return run;
  }
}

function lockTable(): Map<string, Promise<unknown>> {
  const g = globalThis as { __worldidStoreLocks?: Map<string, Promise<unknown>> };
  g.__worldidStoreLocks ??= new Map();
  return g.__worldidStoreLocks;
}

let defaultStore: WorldIdStore | null = null;

/** The app-wide store at apps/web/.data/worldid.json. */
export function getWorldIdStore(): WorldIdStore {
  defaultStore ??= new FileWorldIdStore(path.join(process.cwd(), ".data", "worldid.json"));
  return defaultStore;
}
