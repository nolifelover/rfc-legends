import { BaseError, ContractFunctionRevertedError, encodeErrorResult, UserRejectedRequestError } from "viem";
import { describe, expect, it, vi } from "vitest";
import { rareItemsAbi, rareMarketAbi } from "../../lib/contracts/abis";
import { createInFlight, describeError, TxRejected } from "./errors";

const drop = `0x${"ab".repeat(32)}` as const;

function revert(abi: typeof rareItemsAbi | typeof rareMarketAbi, errorName: string, args: unknown[], functionName: string) {
  const data = encodeErrorResult({ abi, errorName, args } as never);
  const cause = new ContractFunctionRevertedError({ abi, data, functionName } as never);
  return new BaseError("Execution reverted", { cause });
}

describe("describeError", () => {
  it("explains an already-minted drop in plain words and keeps the error name", () => {
    const out = describeError(revert(rareItemsAbi, "DropAlreadyMinted", [drop], "mintWithVoucher"));
    expect(out.errorName).toBe("DropAlreadyMinted");
    expect(out.message).toMatch(/already been minted/);
  });

  it("explains an expired voucher", () => {
    const out = describeError(revert(rareItemsAbi, "VoucherExpired", [BigInt(1), BigInt(2)], "mintWithVoucher"));
    expect(out.errorName).toBe("VoucherExpired");
    expect(out.message).toMatch(/expired/);
  });

  it("explains an inactive listing (sold out or cancelled)", () => {
    const out = describeError(revert(rareMarketAbi, "ListingNotActive", [BigInt(7)], "buy"));
    expect(out.message).toMatch(/no longer active/);
  });

  it("recognises a wallet rejection, wrapped or bare", () => {
    const wrapped = new BaseError("Request failed", { cause: new UserRejectedRequestError(new Error("denied")) });
    expect(describeError(wrapped)).toMatchObject({ userRejected: true });
    expect(describeError({ code: 4001, message: "User rejected" })).toMatchObject({ userRejected: true });
  });

  it("passes TxRejected messages through", () => {
    expect(describeError(new TxRejected("The transaction reverted onchain", "Reverted"))).toEqual({
      message: "The transaction reverted onchain",
      errorName: "Reverted",
    });
  });
});

describe("createInFlight", () => {
  it("drops a second call while the first is running (double click)", async () => {
    const guard = createInFlight();
    let release!: () => void;
    const fn = vi.fn(() => new Promise<string>((r) => (release = () => r("done"))));
    const first = guard.run(fn);
    const second = guard.run(fn);
    expect(guard.running).toBe(true);
    release();
    expect(await first).toBe("done");
    expect(await second).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(guard.running).toBe(false);
  });

  it("frees the guard after a failure, so the user can retry", async () => {
    const guard = createInFlight();
    await expect(guard.run(async () => Promise.reject(new Error("wallet closed")))).rejects.toThrow("wallet closed");
    expect(guard.running).toBe(false);
    expect(await guard.run(async () => "retried")).toBe("retried");
  });
});
