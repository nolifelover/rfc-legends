import { encodeAbiParameters, encodeEventTopics, recoverTypedDataAddress } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";
import { MINT_VOUCHER_TYPE, rareItemsDomain } from "../../lib/contracts/eip712";
import { rareItemsAbi } from "../../lib/contracts/abis";
import { ownershipMessage } from "../../lib/worldid/ownership";
import type { Hex } from "../../lib/worldid/types";
import type { Drop, GameApi, Player } from "./deps";
import { MemoryWorldIdStore } from "./store";
import { confirmMint, issueMintVoucher, utcDay, type ReceiptLike, type VoucherDeps } from "./voucher";

const human = privateKeyToAccount(("0x" + "c1".repeat(32)) as Hex);
const bot = privateKeyToAccount(("0x" + "c3".repeat(32)) as Hex);
const HUMAN = human.address.toLowerCase() as Hex;
const BOT = bot.address.toLowerCase() as Hex;
const SIGNER_KEY = ("0x" + "42".repeat(32)) as Hex;
const RARE_ITEMS = "0x9999999999999999999999999999999999999999" as Hex;
const NOW = new Date("2026-09-26T10:00:00Z");
const DAY = utcDay(NOW);
const dropId = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;

function fakeGame(opts: { player?: Player | null; drops?: Drop[] } = {}) {
  const drops = new Map((opts.drops ?? []).map((d) => [d.dropId, { ...d }]));
  const game: GameApi & { setDropStatus: ReturnType<typeof vi.fn> } = {
    getPlayer: vi.fn(async () => (opts.player === undefined ? { address: HUMAN, baseLevel: 35 } : opts.player)),
    getDrop: vi.fn(async (_a: string, id: Hex) => drops.get(id) ?? null),
    listDrops: vi.fn(async () => [...drops.values()]),
    setDropStatus: vi.fn(async (_a: string, id: Hex, status: Drop["status"]) => {
      const d = drops.get(id);
      if (d) d.status = status;
    }),
  };
  return game;
}

const drop = (n: number, rarity: Drop["rarity"] = "monster_card", itemId = 1001, status: Drop["status"] = "unminted"): Drop => ({
  dropId: dropId(n),
  itemId,
  rarity,
  status,
  droppedAt: NOW.getTime(),
});

const NOW_S = Math.floor(NOW.getTime() / 1000);
let nonceSeq = 0;

/** A signed mint request from `signer` for its own wallet. */
async function req(
  signer: PrivateKeyAccount,
  id: Hex,
  opts: { nonce?: string; expiresAt?: number; signFor?: { address?: Hex; dropId?: Hex }; by?: PrivateKeyAccount } = {},
) {
  const address = signer.address.toLowerCase() as Hex;
  const nonce = opts.nonce ?? `0xnonce${++nonceSeq}`;
  const expiresAt = opts.expiresAt ?? NOW_S + 300;
  const signature = await (opts.by ?? signer).signMessage({
    message: ownershipMessage({
      purpose: "mint-rare-drop",
      address: opts.signFor?.address ?? address,
      dropId: opts.signFor?.dropId ?? id,
      nonce,
      expiresAt,
    }),
  });
  return { address, dropId: id, ownership: { nonce, expiresAt, signature } };
}

async function setup(opts: { verified?: boolean; game?: GameApi; vouchersToday?: Hex[]; dailyLimit?: number; onchainMinted?: boolean } = {}) {
  const store = new MemoryWorldIdStore();
  if (opts.verified ?? true) {
    await store.reserveBinding("1", HUMAN, NOW.toISOString());
    await store.finalizeBinding("1", HUMAN, { verifiedAt: NOW.toISOString(), txHash: null, onchain: "marked" });
  }
  for (const id of opts.vouchersToday ?? []) await store.claimVoucherSlot(HUMAN, DAY, id, 99);
  const game = opts.game ?? fakeGame({ drops: [drop(1)] });
  const deps: VoucherDeps = {
    store,
    game,
    rareItems: { chainId: 11155111, address: RARE_ITEMS },
    signerKey: SIGNER_KEY,
    isDropMintedOnchain: async () => opts.onchainMinted ?? false,
    dailyLimit: opts.dailyLimit ?? 3,
    now: () => NOW,
  };
  return { deps, store, game };
}

describe("issueMintVoucher: accepted", () => {
  it("signs an EIP-712 MintVoucher that recovers to GAME_SIGNER", async () => {
    const { deps, store, game } = await setup();
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);

    expect(out.status).toBe(200);
    if (!out.body.ok) throw new Error(out.body.reason);
    expect(out.body.voucher).toEqual({
      to: HUMAN,
      itemId: "1001",
      amount: "1",
      dropId: dropId(1),
      deadline: String(Math.floor(NOW.getTime() / 1000) + 900),
    });
    const recovered = await recoverTypedDataAddress({
      domain: rareItemsDomain(11155111, RARE_ITEMS),
      types: { MintVoucher: MINT_VOUCHER_TYPE },
      primaryType: "MintVoucher",
      message: {
        to: HUMAN,
        itemId: BigInt(1001),
        amount: BigInt(1),
        dropId: dropId(1),
        deadline: BigInt(out.body.voucher.deadline),
      },
      signature: out.body.signature,
    });
    expect(recovered).toBe(privateKeyToAccount(SIGNER_KEY).address);
    expect(out.body.mintsToday).toBe(1);
    expect(await store.vouchersOn(HUMAN, DAY)).toEqual([dropId(1)]);
    expect(game.setDropStatus).toHaveBeenCalledWith(HUMAN, dropId(1), "minting");
  });

  it("re-issues a voucher for the same drop without using another daily slot", async () => {
    const { deps } = await setup({ vouchersToday: [dropId(1), dropId(7), dropId(8)] });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.status).toBe(200);
    expect(out.body.ok && out.body.mintsToday).toBe(3);
  });
});

describe("issueMintVoucher: each rejection branch, in order", () => {
  it("1. rejects a wallet that never verified with World ID (the bot)", async () => {
    const { deps, game } = await setup({ verified: false });
    const out = await issueMintVoucher(await req(bot, dropId(1)), deps);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ ok: false, code: "not_verified_human" });
    expect(out.body.ok === false && out.body.reason).toContain("World ID");
    expect(game.getPlayer).not.toHaveBeenCalled();
  });

  it("2a. rejects a wallet with no character", async () => {
    const { deps } = await setup({ game: fakeGame({ player: null }) });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.body).toMatchObject({ code: "player_not_found" });
  });

  it("2b. rejects Base Lv below 30 and says the level", async () => {
    const { deps } = await setup({ game: fakeGame({ player: { address: HUMAN, baseLevel: 12 }, drops: [drop(1)] }) });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ code: "base_level_too_low" });
    expect(out.body.ok === false && out.body.reason).toContain("Base Lv 12");
  });

  it("3a. rejects a drop the wallet doesn't own", async () => {
    const { deps } = await setup();
    const out = await issueMintVoucher(await req(human, dropId(99)), deps);
    expect(out.body).toMatchObject({ code: "drop_not_found" });
  });

  it("3b. rejects a drop already minted (game state)", async () => {
    const { deps } = await setup({ game: fakeGame({ drops: [drop(1, "monster_card", 1001, "minted")] }) });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.body).toMatchObject({ code: "drop_already_minted" });
  });

  it("3c. rejects a drop already minted onchain and heals the game state", async () => {
    const game = fakeGame({ drops: [drop(1)] });
    const { deps } = await setup({ game, onchainMinted: true });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.body).toMatchObject({ code: "drop_already_minted" });
    expect(game.setDropStatus).toHaveBeenCalledWith(HUMAN, dropId(1), "minted");
  });

  it("3d. rejects rarities below Legendary", async () => {
    const { deps } = await setup({ game: fakeGame({ drops: [drop(1, "epic", 1500)] }) });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.body).toMatchObject({ code: "drop_not_mintable" });
  });

  it("3e. rejects item ids below 1000 even if the rarity claims otherwise", async () => {
    const { deps } = await setup({ game: fakeGame({ drops: [drop(1, "legendary", 12)] }) });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.body).toMatchObject({ code: "drop_not_mintable" });
  });

  it("4. rejects a new drop once the daily limit is used up", async () => {
    const { deps } = await setup({ vouchersToday: [dropId(7), dropId(8), dropId(9)] });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({ code: "daily_limit_reached" });
    expect(out.body.ok === false && out.body.reason).toContain("3/3");
  });

  it("checks run in order: an unverified wallet hears about World ID, not its level", async () => {
    const { deps } = await setup({
      verified: false,
      game: fakeGame({ player: { address: HUMAN, baseLevel: 1 }, drops: [drop(1, "common", 5)] }),
    });
    const out = await issueMintVoucher(await req(human, dropId(1)), deps);
    expect(out.body).toMatchObject({ code: "not_verified_human" });
  });

  it("returns 503 not_configured after all checks pass if contracts aren't deployed", async () => {
    const { deps } = await setup();
    const out = await issueMintVoucher(await req(human, dropId(1)), { ...deps, rareItems: null });
    expect(out.status).toBe(503);
    expect(out.body).toMatchObject({ code: "not_configured" });
  });

  it("rejects malformed input", async () => {
    const { deps } = await setup();
    expect((await issueMintVoucher({ address: HUMAN, dropId: "0x12" }, deps)).status).toBe(400);
    expect((await issueMintVoucher(null, deps)).status).toBe(400);
  });
});

describe("issueMintVoucher: wallet ownership (G-W3)", () => {
  it("rejects a request without a wallet signature", async () => {
    const { deps, game } = await setup();
    const out = await issueMintVoucher({ address: HUMAN, dropId: dropId(1) }, deps);
    expect(out.status).toBe(400);
    expect(game.getPlayer).not.toHaveBeenCalled();
  });

  it("rejects someone else spending a verified player's mint (signature by another wallet)", async () => {
    const { deps, store } = await setup();
    const out = await issueMintVoucher(await req(human, dropId(1), { by: bot }), deps);
    expect(out.status).toBe(401);
    expect(out.body).toMatchObject({ code: "bad_signature" });
    expect(await store.vouchersOn(HUMAN, DAY)).toEqual([]);
  });

  it("rejects a signature made for a different drop", async () => {
    const { deps } = await setup({ game: fakeGame({ drops: [drop(1), drop(2)] }) });
    const out = await issueMintVoucher(await req(human, dropId(2), { signFor: { dropId: dropId(1) } }), deps);
    expect(out.body).toMatchObject({ code: "bad_signature" });
  });

  it("rejects an expired signature", async () => {
    const { deps } = await setup();
    const out = await issueMintVoucher(await req(human, dropId(1), { expiresAt: NOW_S - 1 }), deps);
    expect(out.body).toMatchObject({ code: "bad_signature" });
  });

  it("refuses to replay the same signed request", async () => {
    const { deps } = await setup();
    const signed = await req(human, dropId(1));
    expect((await issueMintVoucher(signed, deps)).status).toBe(200);
    const replay = await issueMintVoucher(signed, deps);
    expect(replay.status).toBe(401);
    expect(replay.body).toMatchObject({ code: "signature_replayed" });
  });
});

describe("confirmMint", () => {
  const tx = ("0x" + "cd".repeat(32)) as Hex;

  function rareMintedLog(to: Hex, id: Hex, address: Hex = RARE_ITEMS) {
    const topics = encodeEventTopics({
      abi: rareItemsAbi,
      eventName: "RareMinted",
      args: { to, itemId: BigInt(1001), dropId: id },
    }) as Hex[];
    return { address, topics, data: encodeAbiParameters([{ type: "uint256" }], [BigInt(1)]) };
  }

  function confirmDeps(receipt: ReceiptLike | null) {
    const game = fakeGame({ drops: [drop(1, "monster_card", 1001, "minting")] });
    return { game, deps: { game, rareItems: { address: RARE_ITEMS }, getReceipt: async () => receipt } };
  }

  it("marks the drop minted when the tx has our RareMinted event", async () => {
    const { deps, game } = confirmDeps({ status: "success", logs: [rareMintedLog(HUMAN, dropId(1))] });
    const out = await confirmMint({ address: HUMAN, dropId: dropId(1), txHash: tx }, deps);
    expect(out).toEqual({ status: 200, body: { ok: true } });
    expect(game.setDropStatus).toHaveBeenCalledWith(HUMAN, dropId(1), "minted", tx);
  });

  it("refuses events from another contract or for another drop", async () => {
    const other = "0x8888888888888888888888888888888888888888" as Hex;
    for (const log of [rareMintedLog(HUMAN, dropId(1), other), rareMintedLog(HUMAN, dropId(2)), rareMintedLog(BOT, dropId(1))]) {
      const { deps, game } = confirmDeps({ status: "success", logs: [log] });
      const out = await confirmMint({ address: HUMAN, dropId: dropId(1), txHash: tx }, deps);
      expect(out.status).toBe(409);
      expect(game.setDropStatus).not.toHaveBeenCalled();
    }
  });

  it("refuses reverted or unknown transactions", async () => {
    expect((await confirmMint({ address: HUMAN, dropId: dropId(1), txHash: tx }, confirmDeps({ status: "reverted", logs: [] }).deps)).status).toBe(409);
    expect((await confirmMint({ address: HUMAN, dropId: dropId(1), txHash: tx }, confirmDeps(null).deps)).status).toBe(404);
  });
});
