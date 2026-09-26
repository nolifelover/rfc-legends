"use client";

// Client helpers for the World ID lane: status query, API calls, display text.

import { useQuery } from "@tanstack/react-query";
import type { HumanStatusResponse, RpContextResponse, VerifyRejectCode, VoucherRejectCode } from "./types";

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

/** Short Thai line shown under the server's English reason. */
export const verifyRejectThai: Partial<Record<VerifyRejectCode | "max_verifications_reached", string>> = {
  nullifier_bound_to_other_wallet: "World ID นี้ผูกกับกระเป๋าอื่นแล้ว: 1 คน = 1 กระเป๋า",
  max_verifications_reached: "World ID นี้ยืนยันครบจำนวนแล้ว: 1 คน = 1 กระเป๋า",
  signal_mismatch: "หลักฐานนี้ไม่ได้ผูกกับกระเป๋าที่เชื่อมต่ออยู่",
  proof_rejected: "World ID ปฏิเสธหลักฐานนี้",
  nonce_expired: "คำขอหมดเวลา ลองใหม่อีกครั้ง",
  nonce_used: "หลักฐานนี้ถูกใช้ไปแล้ว",
  legacy_proof_not_allowed: "ต้องใช้ World ID 4.0",
  onchain_failed: "บันทึกบนเชนไม่สำเร็จ ลองใหม่อีกครั้ง",
  not_configured: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า World ID",
};

export const voucherRejectThai: Partial<Record<VoucherRejectCode, string>> = {
  not_verified_human: "ต้องยืนยันตัวตนด้วย World ID ก่อน (กันบอท)",
  base_level_too_low: "ต้องมี Base Lv 30 ขึ้นไป",
  player_not_found: "ยังไม่มีตัวละครในเกม",
  drop_not_found: "ไม่พบของดรอปนี้ในกระเป๋าของคุณ",
  drop_already_minted: "ของชิ้นนี้ mint ไปแล้ว",
  drop_not_mintable: "ของระดับนี้ mint ไม่ได้ (เฉพาะ Legendary / Monster Card / MVP Card)",
  daily_limit_reached: "mint ครบโควตาวันนี้แล้ว",
};
