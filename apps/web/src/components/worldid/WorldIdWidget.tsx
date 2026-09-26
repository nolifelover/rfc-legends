"use client";

// Thin wrapper so the IDKit bundle (WASM bridge) only loads in the browser,
// via next/dynamic({ ssr: false }) in VerifyHuman.

import { IDKitRequestWidget, proofOfHuman, type IDKitErrorCodes, type IDKitResult } from "@worldcoin/idkit";
import type { RpContextResponse } from "@/lib/worldid/types";

export type WorldIdWidgetProps = {
  ctx: RpContextResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handleVerify: (result: IDKitResult) => Promise<void>;
  onSuccess: () => void;
  onError: (code: IDKitErrorCodes) => void;
};

export default function WorldIdWidget({ ctx, open, onOpenChange, handleVerify, onSuccess, onError }: WorldIdWidgetProps) {
  return (
    <IDKitRequestWidget
      open={open}
      onOpenChange={onOpenChange}
      app_id={ctx.app_id}
      action={ctx.action}
      rp_context={ctx.rp_context}
      environment={ctx.environment}
      allow_legacy_proofs={ctx.allow_legacy_proofs}
      // The signal is the wallet address, so the proof can't be replayed for another wallet.
      preset={proofOfHuman({ signal: ctx.signal })}
      handleVerify={handleVerify}
      onSuccess={onSuccess}
      onError={onError}
      autoClose
    />
  );
}
