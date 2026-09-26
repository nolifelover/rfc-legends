// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {ERC1155Holder} from "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {HumanRegistry} from "./HumanRegistry.sol";

/// @title RareMarket
/// @notice Escrowed peer-to-peer market for RareItems, settled in MockUSDC.
///         Every sale splits in-contract: 90% to the seller, 10% to the RFC
///         Club treasury (FEE_BPS = 1000). Only World ID verified humans may
///         list; anyone may buy. The owner can rotate the treasury address.
contract RareMarket is ERC1155Holder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Treasury share of each sale, in basis points (1000 = 10%).
    uint16 public constant FEE_BPS = 1000;

    /// @notice Minimum price per unit (0.01 USDC) so the 10% fee can never
    ///         round to zero; keeps every sale an exact 90/10 split.
    uint256 public constant MIN_UNIT_PRICE = 10_000;

    /// @notice The ERC-1155 rare items traded on this market.
    IERC1155 public immutable itemToken;

    /// @notice Settlement currency (MockUSDC on Sepolia).
    IERC20 public immutable paymentToken;

    /// @notice World ID registry; sellers must be verified humans.
    HumanRegistry public immutable humanRegistry;

    /// @notice RFC Club treasury, receives the fee on every sale.
    address public treasury;

    struct Listing {
        address seller;
        uint256 itemId;
        uint256 amount; // remaining units in escrow
        uint256 unitPrice; // payment tokens per unit
        bool active;
    }

    uint256 private _nextListingId = 1;
    mapping(uint256 => Listing) private _listings;

    event Listed(
        uint256 indexed listingId, address indexed seller, uint256 indexed itemId, uint256 amount, uint256 unitPrice
    );
    event Sold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 total,
        uint256 sellerProceeds,
        uint256 fee
    );
    event Cancelled(uint256 indexed listingId);
    event TreasuryTransferred(address indexed previousTreasury, address indexed newTreasury);

    error NotVerifiedHuman(address account);
    error InvalidListing(uint256 amount, uint256 unitPrice);
    error ListingNotActive(uint256 listingId);
    error InvalidPurchase(uint256 requested, uint256 available);
    error NotSeller(address seller);
    error ZeroAddress();

    constructor(
        IERC1155 _itemToken,
        IERC20 _paymentToken,
        HumanRegistry _humanRegistry,
        address _treasury,
        address initialOwner
    ) Ownable(initialOwner) {
        if (
            address(_itemToken) == address(0) || address(_paymentToken) == address(0)
                || address(_humanRegistry) == address(0) || _treasury == address(0) || initialOwner == address(0)
        ) {
            revert ZeroAddress();
        }
        itemToken = _itemToken;
        paymentToken = _paymentToken;
        humanRegistry = _humanRegistry;
        treasury = _treasury;
    }

    /// @notice Escrows `amount` units of `itemId` for sale at `unitPrice`
    ///         each. Caller must have called setApprovalForAll on the item
    ///         token and be a verified human. `unitPrice` must be at least
    ///         MIN_UNIT_PRICE.
    function list(uint256 itemId, uint256 amount, uint256 unitPrice) external returns (uint256 listingId) {
        if (!humanRegistry.isVerified(msg.sender)) revert NotVerifiedHuman(msg.sender);
        if (amount == 0 || unitPrice < MIN_UNIT_PRICE) revert InvalidListing(amount, unitPrice);

        listingId = _nextListingId++;
        _listings[listingId] = Listing({
            seller: msg.sender, itemId: itemId, amount: amount, unitPrice: unitPrice, active: true
        });

        itemToken.safeTransferFrom(msg.sender, address(this), itemId, amount, "");

        emit Listed(listingId, msg.sender, itemId, amount, unitPrice);
    }

    /// @notice Buys `amount` units of a listing. The contract pulls the full
    ///         price from the buyer and routes it 90/10 in the same call:
    ///         `fee = total * FEE_BPS / 10000`, seller gets the remainder.
    function buy(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage l = _listings[listingId];
        if (!l.active) revert ListingNotActive(listingId);
        if (amount == 0 || amount > l.amount) revert InvalidPurchase(amount, l.amount);

        uint256 total = l.unitPrice * amount;
        uint256 fee = (total * FEE_BPS) / 10_000;
        uint256 sellerProceeds = total - fee; // rounding dust goes to the seller

        l.amount -= amount;
        if (l.amount == 0) {
            l.active = false;
        }

        paymentToken.safeTransferFrom(msg.sender, l.seller, sellerProceeds);
        paymentToken.safeTransferFrom(msg.sender, treasury, fee);
        itemToken.safeTransferFrom(address(this), msg.sender, l.itemId, amount, "");

        emit Sold(listingId, msg.sender, l.seller, amount, total, sellerProceeds, fee);
    }

    /// @notice Cancels a listing and returns the remaining escrow to the seller.
    function cancel(uint256 listingId) external nonReentrant {
        Listing storage l = _listings[listingId];
        if (msg.sender != l.seller) revert NotSeller(l.seller);
        if (!l.active) revert ListingNotActive(listingId);

        uint256 refundAmount = l.amount;
        l.amount = 0;
        l.active = false;

        itemToken.safeTransferFrom(address(this), l.seller, l.itemId, refundAmount, "");

        emit Cancelled(listingId);
    }

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return _listings[listingId];
    }

    /// @notice Rotates the treasury address (e.g. if the payment token ever
    ///         blacklists the current one).
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryTransferred(treasury, newTreasury);
        treasury = newTreasury;
    }
}
