/**
 * Shared EIP-712 typed-data constants for RFC Legends signatures.
 *
 * These mirror the Solidity typehashes in contracts/src/RareItems.sol
 * (MintVoucher) and contracts/src/RoosterRWA.sol (Attestation). The strings
 * and field order MUST stay byte-identical to the contracts, or signatures
 * made with them will fail onchain verification.
 */

export type Hex = `0x${string}`;

/** EIP-712 domain fields shared by both contracts (no salt). */
export const EIP712_DOMAIN_TYPE = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
] as const;

export const RARE_ITEMS_DOMAIN_NAME = 'RFCLegendsRareItems';
export const ROOSTER_RWA_DOMAIN_NAME = 'RFCLegendsRoosterRWA';
export const EIP712_VERSION = '1';

/**
 * RareItems.MintVoucher — server-signed permission to mint one drop.
 * keccak256("MintVoucher(address to,uint256 itemId,uint256 amount,bytes32 dropId,uint256 deadline)")
 */
export const MINT_VOUCHER_TYPE = [
  { name: 'to', type: 'address' },
  { name: 'itemId', type: 'uint256' },
  { name: 'amount', type: 'uint256' },
  { name: 'dropId', type: 'bytes32' },
  { name: 'deadline', type: 'uint256' },
] as const;

export interface MintVoucher {
  to: Hex;
  itemId: bigint;
  amount: bigint;
  dropId: Hex;
  deadline: bigint;
}

/**
 * RoosterRWA.Attestation — farm-signed weekly health/weight record.
 * keccak256("Attestation(uint256 tokenId,uint32 weightGrams,uint8 healthScore,string note,uint64 checkedAt,uint64 nonce)")
 */
export const ATTESTATION_TYPE = [
  { name: 'tokenId', type: 'uint256' },
  { name: 'weightGrams', type: 'uint32' },
  { name: 'healthScore', type: 'uint8' },
  { name: 'note', type: 'string' },
  { name: 'checkedAt', type: 'uint64' },
  { name: 'nonce', type: 'uint64' },
] as const;

export interface Attestation {
  tokenId: bigint;
  weightGrams: number;
  healthScore: number;
  note: string;
  checkedAt: bigint;
  nonce: bigint;
}

export function rareItemsDomain(chainId: number, verifyingContract: Hex) {
  return {
    name: RARE_ITEMS_DOMAIN_NAME,
    version: EIP712_VERSION,
    chainId: BigInt(chainId),
    verifyingContract,
  };
}

export function roosterRwaDomain(chainId: number, verifyingContract: Hex) {
  return {
    name: ROOSTER_RWA_DOMAIN_NAME,
    version: EIP712_VERSION,
    chainId: BigInt(chainId),
    verifyingContract,
  };
}

/** Typed-data payload ready for viem's `signTypedData` / `verifyTypedData`. */
export function mintVoucherTypedData(
  chainId: number,
  verifyingContract: Hex,
  voucher: MintVoucher,
) {
  return {
    domain: rareItemsDomain(chainId, verifyingContract),
    types: { EIP712Domain: EIP712_DOMAIN_TYPE, MintVoucher: MINT_VOUCHER_TYPE },
    primaryType: 'MintVoucher',
    message: voucher,
  };
}

/** Typed-data payload ready for viem's `signTypedData` / `verifyTypedData`. */
export function attestationTypedData(
  chainId: number,
  verifyingContract: Hex,
  attestation: Attestation,
) {
  return {
    domain: roosterRwaDomain(chainId, verifyingContract),
    types: { EIP712Domain: EIP712_DOMAIN_TYPE, Attestation: ATTESTATION_TYPE },
    primaryType: 'Attestation',
    message: attestation,
  };
}
