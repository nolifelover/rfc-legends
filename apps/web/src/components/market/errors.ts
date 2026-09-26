// Pure helpers for the market's tx flows: readable errors and a single-flight
// guard. No wagmi imports, so they're unit-testable in node.

import { BaseError, ContractFunctionRevertedError } from "viem";

export class TxRejected extends Error {
  constructor(
    message: string,
    readonly errorName?: string,
  ) {
    super(message);
  }
}

/** Plain-language reasons for the contract errors a player can hit. */
export const CONTRACT_REASONS: Record<string, string> = {
  NotVerifiedHuman: "Only World ID verified humans can do this. Verify with World ID first.",
  VoucherExpired: "The mint voucher expired before the transaction went through. Press Mint again for a fresh one.",
  DropAlreadyMinted: "This drop has already been minted (maybe from another tab). Nothing was charged.",
  InvalidSigner: "The mint voucher wasn't signed by the game server. Press Mint again.",
  ListingNotActive: "This listing is no longer active: it sold out or the seller cancelled it.",
  InvalidPurchase: "That's more than is left in this listing.",
  NotSeller: "Only the seller can cancel this listing.",
  EnforcedPause: "The contract is paused right now. Try again later.",
  ERC20InsufficientBalance: "Not enough test USDC. Use +100 test USDC first.",
  ERC20InsufficientAllowance: "The market isn't approved to spend enough USDC. Approve and try again.",
  ERC1155MissingApprovalForAll: "The market isn't approved to hold your items yet. Approve and try again.",
  InvalidListing: "Amount and price must both be more than zero.",
};

export type ReadableError = { message: string; errorName?: string; userRejected?: boolean };

/** Turns a viem/wagmi error into one readable line, naming the custom error when there is one. */
export function describeError(err: unknown): ReadableError {
  if (err instanceof TxRejected) return { message: err.message, errorName: err.errorName };
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName) {
      const name = revert.data.errorName;
      const args = (revert.data.args ?? []).map((a) => String(a)).join(", ");
      const friendly = CONTRACT_REASONS[name];
      return { message: friendly ? `${friendly} (${name})` : `${name}(${args})`, errorName: name };
    }
    const rejected = err.walk((e) => {
      const x = e as { name?: string; code?: number };
      return x.name === "UserRejectedRequestError" || x.code === 4001;
    });
    if (rejected) return { message: "You rejected the request in your wallet. Nothing was sent.", userRejected: true };
    if (err.walk((e) => (e as { name?: string }).name === "WaitForTransactionReceiptTimeoutError")) {
      return { message: "The transaction wasn't confirmed in time. Check it on Etherscan before retrying." };
    }
    return { message: err.shortMessage };
  }
  const code = (err as { code?: number } | null)?.code;
  if (code === 4001) return { message: "You rejected the request in your wallet. Nothing was sent.", userRejected: true };
  return { message: err instanceof Error ? err.message : String(err) };
}

/**
 * Single-flight guard: a second call while the first is still running is
 * dropped. Protects mint / list / buy from double clicks that land before
 * React re-renders the disabled button.
 */
export function createInFlight() {
  let running = false;
  return {
    get running() {
      return running;
    },
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (running) return undefined;
      running = true;
      try {
        return await fn();
      } finally {
        running = false;
      }
    },
  };
}
