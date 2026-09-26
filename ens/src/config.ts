import 'dotenv/config';

/**
 * ENSv2 beta on Sepolia — live deployment set.
 *
 * Two deployment sets exist on Sepolia: the canonical one fronted by the
 * entry Universal Resolver proxy at 0xeEeE...eEeE (what viem/wagmi and the
 * ENS app resolve through — verified onchain via ROOT_REGISTRY() through the
 * proxy chain), and a newer set in the ensdomains/contracts-v2 repo that the
 * entry proxy does NOT front yet. We register through the canonical set so
 * names resolve for every standard client.
 *
 * Implementation contracts (UserRegistryImpl, PermissionedResolverImpl) are
 * stateless and verified compatible with the contracts-v2 source at HEAD
 * (setText(bytes32,...), authorizeTextRoles, initialize(address,uint256,bytes[])).
 * Proxies for them deploy fine through the canonical VerifiableFactory
 * (verified by eth_call simulation) — resolution only follows registry
 * pointers, so the proxies' factory provenance does not matter.
 */
export const CHAIN_ID = 11155111;

export const ENSV2 = {
  rootRegistry: '0x9703dbd26dab89504490994138cf2c575251a9ce',
  ethRegistry: '0x657ea849311d3d5823348dded7c2aaafb3ede09e',
  ethRegistrar: '0xabe76f6c8dfced81aa5a2bb8034202a7136b94ca',
  universalResolverEntry: '0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe', // viem default on Sepolia
  verifiableFactory: '0x9e726eb570beb6bceb495ab8cda7df517d4e841c',
  mockUsdc: '0x16f95d91dba7da3aca778ec053df0ff6c6a8aa8e', // ENSv2 beta registration payment token (6dp)
  // implementations (stateless; from contracts-v2 @ HEAD, Sepolia-live)
  userRegistryImpl: '0x840fa461059862ea466a711e8c98c8de732061c0',
  permissionedResolverImpl: '0x7e4b2d59938930168024201752ee5503df402303',
} as const;

export const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';
export const ENS_OWNER_PRIVATE_KEY = required('ENS_OWNER_PRIVATE_KEY');
export const FARM_SIGNER_PRIVATE_KEY = process.env.FARM_SIGNER_PRIVATE_KEY;
export const PARENT_LABEL = process.env.ENS_PARENT_LABEL ?? 'rfclegends';
export const PARENT_NAME = `${PARENT_LABEL}.eth`;
export const YEAR = 365n * 86400n;
export const DAY = 86400n;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env ${name} (see ens/.env.example)`);
  return v;
}

/** Registry roles (RegistryRolesLib) */
export const REG_ROLES = {
  ROLE_REGISTRAR: 1n << 0n,
  ROLE_REGISTER_RESERVED: 1n << 4n,
  ROLE_SET_PARENT: 1n << 8n,
  ROLE_UNREGISTER: 1n << 12n,
  ROLE_RENEW: 1n << 16n,
  ROLE_SET_SUBREGISTRY: 1n << 20n,
  ROLE_SET_RESOLVER: 1n << 24n,
  ROLE_CAN_TRANSFER_ADMIN: (1n << 28n) << 128n,
  ROLE_WAS_RESERVED: 1n << 32n,
  ROLE_SET_URI: 1n << 36n,
  ROLE_CAN_NAME: 1n << 120n,
  ROLE_UPGRADE: 1n << 124n,
} as const;
export const admin = (role: bigint) => role << 128n;

/** Resolver roles (PermissionedResolverLib) */
export const RES_ROLES = {
  ROLE_SET_ADDR: 1n << 0n,
  ROLE_SET_TEXT: 1n << 4n,
  ROLE_SET_CONTENTHASH: 1n << 8n,
  ROLE_SET_PUBKEY: 1n << 12n,
  ROLE_SET_ABI: 1n << 16n,
  ROLE_SET_INTERFACE: 1n << 20n,
  ROLE_SET_NAME: 1n << 24n,
  ROLE_SET_ALIAS: 1n << 28n,
  ROLE_CLEAR: 1n << 32n,
  ROLE_SET_DATA: 1n << 36n,
  ROLE_UPGRADE: 1n << 124n,
} as const;
