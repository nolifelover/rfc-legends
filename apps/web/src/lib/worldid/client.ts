"use client";

// Client helpers for the World ID lane: status query, API calls, display text.

import { useQuery } from "@tanstack/react-query";
import type { HumanStatusResponse, RpContextResponse } from "./types";

export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";
export const txUrl = (hash: string) => `${SEPOLIA_EXPLORER}/tx/${hash}`;
export const addressUrl = (address: string) => `${SEPOLIA_EXPLORER}/address/${address}`;
export const shortAddress = (a: string) => (a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export const humanStatusKey = (address?: string) => ["worldid-status", address?.toLowerCase()] as const;

export function useHumanStatus(address?: string) {
  return useQuery({
    queryKey: humanStatusKey(address),
    enabled: Boolean(address),
    queryFn: async (): Promise<HumanStatusResponse> => {
      const res = await fetch(`/api/worldid/status?address=${address}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Couldn't load World ID status");
      return res.json();
    },
  });
}

export async function fetchRpContext(address: string): Promise<RpContextResponse> {
  const res = await fetch("/api/worldid/rp-context", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Couldn't start World ID verification");
  return body as RpContextResponse;
}
