// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {HumanRegistry} from "./HumanRegistry.sol";

/// @title RareItems
/// @notice ERC-1155 rare drops (Legendary equipment, Monster and MVP cards).
///         There is no shop: the contract mints only against a voucher signed
///         by the game server (GAME_SIGNER), and only to a World ID verified
///         human, so premium items can only ever enter the world as drops.
contract RareItems is ERC1155 {
    /// @param to          Mint recipient; must be verified in the HumanRegistry.
    /// @param itemId      Item id (1xxx Monster Card, 2xxx Legendary, 3xxx MVP Card).
    /// @param amount      Units to mint.
    /// @param dropId      Server-side drop identifier; single use.
    /// @param deadline    Unix timestamp after which the voucher is stale.
    struct MintVoucher {
        address to;
        uint256 itemId;
        uint256 amount;
        bytes32 dropId;
        uint256 deadline;
    }

    /// @dev Must stay byte-identical to MINT_VOUCHER_TYPE in
    ///      apps/web/src/lib/contracts/eip712.ts.
    bytes32 public constant MINT_VOUCHER_TYPEHASH =
        keccak256("MintVoucher(address to,uint256 itemId,uint256 amount,bytes32 dropId,uint256 deadline)");

    string public constant DOMAIN_NAME = "RFCLegendsRareItems";
    string public constant DOMAIN_VERSION = "1";

    /// @notice Game server key that signs mint vouchers.
    address public immutable voucherSigner;

    /// @notice World ID verification registry consulted before every mint.
    HumanRegistry public immutable humanRegistry;

    /// @notice dropId => already minted. Makes every drop claimable exactly once.
    mapping(bytes32 => bool) public dropMinted;

    event RareMinted(address indexed to, uint256 indexed itemId, uint256 amount, bytes32 indexed dropId);

    error VoucherExpired(uint256 deadline, uint256 blockTimestamp);
    error InvalidSigner(address recovered, address expected);
    error DropAlreadyMinted(bytes32 dropId);
    error NotVerifiedHuman(address account);
    error ZeroAddress();

    constructor(address _voucherSigner, HumanRegistry _humanRegistry, string memory baseURI)
        ERC1155(baseURI)
    {
        if (_voucherSigner == address(0) || address(_humanRegistry) == address(0)) revert ZeroAddress();
        voucherSigner = _voucherSigner;
        humanRegistry = _humanRegistry;
    }

    /// @notice Mints a rare drop against a server-signed voucher. Anyone may
    ///         relay the transaction; the tokens always land on `v.to`.
    function mintWithVoucher(MintVoucher calldata v, bytes calldata signature) external {
        if (block.timestamp > v.deadline) revert VoucherExpired(v.deadline, block.timestamp);
        if (dropMinted[v.dropId]) revert DropAlreadyMinted(v.dropId);
        if (!humanRegistry.isVerified(v.to)) revert NotVerifiedHuman(v.to);

        address recovered = ECDSA.recover(
            MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), _hashVoucher(v)), signature
        );
        if (recovered != voucherSigner) revert InvalidSigner(recovered, voucherSigner);

        dropMinted[v.dropId] = true;
        _mint(v.to, v.itemId, v.amount, "");

        emit RareMinted(v.to, v.itemId, v.amount, v.dropId);
    }

    /// @notice EIP-712 domain separator for offchain signature tooling.
    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice Metadata URI for `id`. Supports ERC-1155 `{id}` substitution in
    ///         the configured base URI; otherwise appends the decimal id.
    function uri(uint256 id) public view override returns (string memory) {
        string memory base = super.uri(id);
        bytes memory baseBytes = bytes(base);
        if (baseBytes.length == 0) return "";

        for (uint256 i = 0; i + 4 <= baseBytes.length; ++i) {
            if (baseBytes[i] == "{" && baseBytes[i + 1] == "i" && baseBytes[i + 2] == "d" && baseBytes[i + 3] == "}") {
                bytes memory hexBytes = bytes(Strings.toHexString(id, 32));
                bytes memory out = new bytes(baseBytes.length - 4 + hexBytes.length);
                for (uint256 j = 0; j < i; ++j) {
                    out[j] = baseBytes[j];
                }
                for (uint256 j = 0; j < hexBytes.length; ++j) {
                    out[i + j] = hexBytes[j];
                }
                for (uint256 j = i + 4; j < baseBytes.length; ++j) {
                    out[j - 4 + hexBytes.length] = baseBytes[j];
                }
                return string(out);
            }
        }
        return string.concat(base, Strings.toString(id));
    }

    function _hashVoucher(MintVoucher calldata v) internal pure returns (bytes32) {
        return keccak256(abi.encode(MINT_VOUCHER_TYPEHASH, v.to, v.itemId, v.amount, v.dropId, v.deadline));
    }
}
