// Nullifier normalization and the one-human-one-wallet binding rule.

import type { Hex } from "../../lib/worldid/types";
import type { WorldIdState } from "./store";

const UINT256_MAX = (BigInt(1) << BigInt(256)) - BigInt(1);

/**
 * World returns nullifiers as 0x-hex field elements. Store them as canonical
 * decimal strings so "0x0A", "0xa" and "10" can never be three different keys,
 * and so the value maps 1:1 onto the uint256 HumanRegistry expects.
 */
export function normalizeNullifier(input: string): string {
  const s = input.trim();
  let value: bigint;
  if (/^0x[0-9a-fA-F]{1,64}$/.test(s)) value = BigInt(s);
  else if (/^[0-9]{1,78}$/.test(s)) value = BigInt(s);
  else throw new Error(`Invalid nullifier: ${input}`);
  if (value > UINT256_MAX) throw new Error("Nullifier exceeds uint256");
  return value.toString(10);
}

export type BindingDecision =
  | { kind: "new" }
  | { kind: "same" }
  | { kind: "other"; boundTo: Hex };

/** Can `nullifier` be bound to `address`? Addresses must already be lowercase. */
export function decideBinding(state: WorldIdState, address: Hex, nullifier: string): BindingDecision {
  const existing = state.bindings[nullifier];
  if (!existing) return { kind: "new" };
  if (existing.address === address) return { kind: "same" };
  return { kind: "other", boundTo: existing.address };
}

/** 0x1234…abcd, so the UI can name the other wallet without leaking it whole. */
export function maskAddress(address: string): string {
  return address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
