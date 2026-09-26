import { parseAbi } from 'viem';

export const erc20Abi = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
]);

export const registrarAbi = parseAbi([
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256 tokenId)',
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commitmentAt(bytes32 commitment) view returns (uint64)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function isAvailable(string label) view returns (bool)',
  'function MIN_COMMITMENT_AGE() view returns (uint64)',
  'event NameRegistered(uint256 indexed tokenId, string label, address owner, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 indexed referrer, uint256 base, uint256 premium)',
]);

export const registryAbi = parseAbi([
  'function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256 tokenId)',
  'function setSubregistry(uint256 anyId, address registry)',
  'function setResolver(uint256 anyId, address resolver)',
  'function grantRootRoles(uint256 roleBitmap, address account) returns (bool)',
  'function grantRoles(uint256 resource, uint256 roleBitmap, address account) returns (bool)',
  'function getSubregistry(string label) view returns (address)',
  'function getResolver(string label) view returns (address)',
  'function getState(uint256 anyId) view returns ((uint8 status, uint64 expiry, address latestOwner, uint256 tokenId, uint256 resource) state)',
  'function getExpiry(uint256 anyId) view returns (uint64 expiry)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'event LabelRegistered(string label, address indexed owner, uint256 indexed tokenId)',
]);

export const resolverAbi = parseAbi([
  'function setText(bytes32 node, string key, string value)',
  'function text(bytes32 node, string key) view returns (string)',
  'function setAddr(bytes32 node, uint64 coinType, bytes a)',
  'function authorizeTextRoles(bytes toName, string key, address account, bool grant) returns (bool)',
  'function authorizeNameRoles(bytes toName, uint256 roleBitmap, address account, bool grant) returns (bool)',
  'function roles(uint256 resource, address account) view returns (uint256)',
  'function hasRoles(uint256 resource, uint256 roleBitmap, address account) view returns (bool)',
]);

export const factoryAbi = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data) returns (address proxy)',
  'function predictProxyAddress(address deployer, uint256 salt) view returns (address proxy)',
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
]);
