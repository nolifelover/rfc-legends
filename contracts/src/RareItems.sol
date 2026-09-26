// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {HumanRegistry} from "./HumanRegistry.sol";

/// @title RareItems
/// @notice ERC-1155 rare drops (Legendary equipment, Monster and MVP cards).
///         There is no shop: the contract mints only against a voucher signed
///         by the game server (GAME_SIGNER), and only to a World ID verified
///         human, so premium items can only ever enter the world as drops.
///         The owner can rotate the signer key and pause mints.
contract RareItems is ERC1155, Ownable, Pausable {
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
    address public voucherSigner;

    /// @notice World ID verification registry consulted before every mint.
    HumanRegistry public immutable humanRegistry;

    /// @notice dropId => already minted. Makes every drop claimable exactly once.
    mapping(bytes32 => bool) public dropMinted;

    event RareMinted(address indexed to, uint256 indexed itemId, uint256 amount, bytes32 indexed dropId);
    event VoucherSignerTransferred(address indexed previousSigner, address indexed newSigner);

    error VoucherExpired(uint256 deadline, uint256 blockTimestamp);
    error InvalidSigner(address recovered, address expected);
    error DropAlreadyMinted(bytes32 dropId);
    error NotVerifiedHuman(address account);
    error ZeroAddress();

    constructor(address _voucherSigner, HumanRegistry _humanRegistry, string memory baseURI, address initialOwner)
        ERC1155(baseURI)
        Ownable(initialOwner)
    {
        if (_voucherSigner == address(0) || address(_humanRegistry) == address(0) || initialOwner == address(0)) {
            revert ZeroAddress();
        }
        voucherSigner = _voucherSigner;
        humanRegistry = _humanRegistry;
    }

    /// @notice Mints a rare drop against a server-signed voucher. Anyone may
    ///         relay the transaction; the tokens always land on `v.to`.
    function mintWithVoucher(MintVoucher calldata v, bytes calldata signature) external whenNotPaused {
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

    /// @notice Rotates the game server key. Vouchers signed by the old key
    ///         stop working immediately.
    function setVoucherSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit VoucherSignerTransferred(voucherSigner, newSigner);
        voucherSigner = newSigner;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
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
    ///         the configured base URI (64 lowercase hex chars, no 0x prefix
    ///         per the ERC); otherwise appends the decimal id.
    function uri(uint256 id) public view override returns (string memory) {
        string memory base = super.uri(id);
        bytes memory baseBytes = bytes(base);
        if (baseBytes.length == 0) return "";

        for (uint256 i = 0; i + 4 <= baseBytes.length; ++i) {
            if (baseBytes[i] == "{" && baseBytes[i + 1] == "i" && baseBytes[i + 2] == "d" && baseBytes[i + 3] == "}") {
                bytes memory hexBytes = bytes(_hex64(id));
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

    /// @dev 64 lowercase hex chars of `v`, big-endian, without 0x prefix
    ///      (the exact format ERC-1155 requires for {id} substitution).
    function _hex64(uint256 v) internal pure returns (string memory) {
        bytes16 hexChars = "0123456789abcdef";
        bytes memory out = new bytes(64);
        for (uint256 i = 0; i < 32; ++i) {
            uint256 b = (v >> ((31 - i) * 8)) & 0xff;
            out[i * 2] = hexChars[b >> 4];
            out[i * 2 + 1] = hexChars[b & 0x0f];
        }
        return string(out);
    }
}
