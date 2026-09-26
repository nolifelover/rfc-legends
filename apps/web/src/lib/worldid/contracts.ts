// TEMPORARY SHIM: minimal ABIs for the drop-economy contracts, written from
// docs/interfaces.md §4.1–4.4. Swap these for the `as const` ABIs in
// apps/web/src/lib/contracts/abis.ts once eth-dev1 exports them.

import type { Hex } from "./types";

export type Deployment = {
  chainId: number;
  HumanRegistry: Hex;
  RareItems: Hex;
  RareMarket: Hex;
  MockUSDC: Hex;
  treasury?: Hex;
  gameSigner?: Hex;
  startBlock?: number;
};

export const humanRegistryAbi = [
  {
    type: "function",
    name: "markVerified",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "nullifierHash", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isVerified",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "nullifierOwner",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  { type: "error", name: "NotAttestor", inputs: [] },
  { type: "error", name: "NullifierAlreadyUsed", inputs: [{ name: "boundTo", type: "address" }] },
] as const;

export const mintVoucherComponents = [
  { name: "to", type: "address" },
  { name: "itemId", type: "uint256" },
  { name: "amount", type: "uint256" },
  { name: "dropId", type: "bytes32" },
  { name: "deadline", type: "uint256" },
] as const;

export const rareItemsAbi = [
  {
    type: "function",
    name: "mintWithVoucher",
    stateMutability: "nonpayable",
    inputs: [
      { name: "v", type: "tuple", components: mintVoucherComponents },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "dropMinted",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isApprovedForAll",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "setApprovalForAll",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "RareMinted",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "itemId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "dropId", type: "bytes32", indexed: true },
    ],
  },
  { type: "error", name: "VoucherExpired", inputs: [{ name: "deadline", type: "uint256" }, { name: "blockTimestamp", type: "uint256" }] },
  { type: "error", name: "InvalidSigner", inputs: [{ name: "recovered", type: "address" }, { name: "expected", type: "address" }] },
  { type: "error", name: "DropAlreadyMinted", inputs: [{ name: "dropId", type: "bytes32" }] },
  { type: "error", name: "NotVerifiedHuman", inputs: [{ name: "account", type: "address" }] },
] as const;

export const listingComponents = [
  { name: "seller", type: "address" },
  { name: "itemId", type: "uint256" },
  { name: "amount", type: "uint256" },
  { name: "unitPrice", type: "uint256" },
  { name: "active", type: "bool" },
] as const;

export const rareMarketAbi = [
  {
    type: "function",
    name: "list",
    stateMutability: "nonpayable",
    inputs: [
      { name: "itemId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "unitPrice", type: "uint256" },
    ],
    outputs: [{ name: "listingId", type: "uint256" }],
  },
  {
    type: "function",
    name: "buy",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancel",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: listingComponents }],
  },
  {
    type: "function",
    name: "FEE_BPS",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "Listed",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "itemId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "unitPrice", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sold",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "total", type: "uint256", indexed: false },
      { name: "sellerProceeds", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [{ name: "listingId", type: "uint256", indexed: true }],
  },
  { type: "error", name: "NotVerifiedHuman", inputs: [{ name: "account", type: "address" }] },
] as const;

export const mockUsdcAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
