// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {HumanRegistry} from "../src/HumanRegistry.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {RareItems} from "../src/RareItems.sol";
import {RareMarket} from "../src/RareMarket.sol";

/// @dev Buyer contract that tries to reenter RareMarket.buy from the
///      onERC1155Received callback while its buy is still in flight.
contract ReentrantBuyer {
    RareMarket internal market;
    bool internal struck;

    constructor(RareMarket _market) {
        market = _market;
    }

    function attack(uint256 listingId, uint256 amount) external {
        market.buy(listingId, amount);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        if (!struck) {
            struck = true;
            market.buy(0, 1); // reentry attempt
        }
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return ReentrantBuyer.onERC1155BatchReceived.selector;
    }
}

contract RareMarketTest is Test {
    MockUSDC internal usdc;
    HumanRegistry internal registry;
    RareItems internal rare;
    RareMarket internal market;

    uint256 internal constant GAME_KEY = 0xA11CE;
    address internal gameSigner;
    address internal attestor = makeAddr("attestor");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice"); // verified human, seller (wallet A)
    address internal bob = makeAddr("bob"); // buyer (wallet B)
    address internal bot = makeAddr("bot"); // unverified (wallet C)

    uint256 internal constant ITEM_ID = 3001;

    function setUp() public {
        gameSigner = vm.addr(GAME_KEY);
        usdc = new MockUSDC();
        registry = new HumanRegistry(attestor);
        rare = new RareItems(gameSigner, registry, "https://app.example/api/items/");
        market = new RareMarket(rare, usdc, registry, treasury);

        vm.prank(attestor);
        registry.markVerified(alice, uint256(keccak256("alice:nullifier")));

        _mintRare(alice, 100);
        vm.startPrank(alice);
        rare.setApprovalForAll(address(market), true);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- helpers

    uint256 internal mintSeq = 1;

    function _mintRare(address to, uint256 amount) internal {
        bytes32 dropId = keccak256(abi.encodePacked("drop", mintSeq++));
        RareItems.MintVoucher memory v =
            RareItems.MintVoucher({to: to, itemId: ITEM_ID, amount: amount, dropId: dropId, deadline: block.timestamp + 1 hours});
        bytes32 structHash =
            keccak256(abi.encode(rare.MINT_VOUCHER_TYPEHASH(), v.to, v.itemId, v.amount, v.dropId, v.deadline));
        bytes32 digest = MessageHashUtils.toTypedDataHash(rare.DOMAIN_SEPARATOR(), structHash);
        (uint8 sv, bytes32 r, bytes32 s) = vm.sign(GAME_KEY, digest);
        rare.mintWithVoucher(v, abi.encodePacked(r, s, sv));
    }

    function _fund(address who, uint256 amount) internal {
        uint256 cap = usdc.FAUCET_CAP();
        while (amount > 0) {
            uint256 chunk = amount > cap ? cap : amount;
            usdc.mint(who, chunk);
            amount -= chunk;
        }
    }

    function _listAlice(uint256 amount, uint256 unitPrice) internal returns (uint256) {
        vm.prank(alice);
        return market.list(ITEM_ID, amount, unitPrice);
    }

    function _buyBob(uint256 listingId, uint256 amount) internal {
        vm.prank(bob);
        market.buy(listingId, amount);
    }

    // ------------------------------------------------------------- list gates

    function test_List_RequiresVerifiedHuman() public {
        vm.prank(bot);
        vm.expectRevert(abi.encodeWithSelector(RareMarket.NotVerifiedHuman.selector, bot));
        market.list(ITEM_ID, 1, 1e6);
    }

    function test_List_ZeroAmountOrPrice_Reverts() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(RareMarket.InvalidListing.selector, 0, 1e6));
        market.list(ITEM_ID, 0, 1e6);

        vm.expectRevert(abi.encodeWithSelector(RareMarket.InvalidListing.selector, 1, 0));
        market.list(ITEM_ID, 1, 0);
        vm.stopPrank();
    }

    function test_List_EscrowsItemsAndIncrementsIds() public {
        uint256 id1 = _listAlice(10, 2e6);
        uint256 id2 = _listAlice(5, 3e6);

        assertEq(id1, 1, "first listing id");
        assertEq(id2, 2, "second listing id");
        assertEq(rare.balanceOf(alice, ITEM_ID), 100 - 15, "escrowed items left sender");
        assertEq(rare.balanceOf(address(market), ITEM_ID), 15, "escrow holds items");
    }

    function test_List_EmitsListed() public {
        vm.expectEmit(true, true, true, true);
        emit RareMarket.Listed(1, alice, ITEM_ID, 10, 2e6);
        _listAlice(10, 2e6);
    }

    function test_GetListing_ReturnsFields() public {
        _listAlice(7, 4e6);
        RareMarket.Listing memory l = market.getListing(1);
        assertEq(l.seller, alice);
        assertEq(l.itemId, ITEM_ID);
        assertEq(l.amount, 7);
        assertEq(l.unitPrice, 4e6);
        assertTrue(l.active);
    }

    function test_Constructor_ZeroArgs_Revert() public {
        vm.expectRevert(RareMarket.ZeroAddress.selector);
        new RareMarket(rare, MockUSDC(address(0)), registry, treasury);
    }

    // ----------------------------------------------------------- exact 90/10

    function test_Buy_ExactSplit90_10() public {
        uint256 listingId = _listAlice(10, 2_000_000); // $2/unit
        _fund(bob, 20_000_000);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);

        uint256 bobBefore = usdc.balanceOf(bob);
        _buyBob(listingId, 10);

        uint256 total = 20_000_000;
        uint256 expectedFee = (total * 1000) / 10_000; // 2_000_000
        uint256 expectedProceeds = total - expectedFee; // 18_000_000
        assertEq(usdc.balanceOf(treasury), expectedFee, "treasury fee");
        assertEq(usdc.balanceOf(alice), expectedProceeds, "seller proceeds");
        assertEq(bobBefore - usdc.balanceOf(bob), total, "buyer paid exactly total");
        assertEq(rare.balanceOf(bob, ITEM_ID), 10, "buyer received items");
    }

    function test_Buy_RoundingDustGoesToSeller(uint96 unitPrice, uint32 amount) public {
        unitPrice = uint96(bound(unitPrice, 1, 1_000_000e6));
        amount = uint32(bound(amount, 1, 100)); // alice holds 100 items in setUp
        vm.assume(uint256(unitPrice) * uint256(amount) <= 50_000_000e6); // keep within faucet loop comfort

        uint256 listingId = _listAlice(amount, unitPrice);
        uint256 total = uint256(unitPrice) * uint256(amount);
        _fund(bob, total);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);

        _buyBob(listingId, amount);

        uint256 expectedFee = (total * 1000) / 10_000;
        assertEq(usdc.balanceOf(treasury), expectedFee, "fee = total*1000/10000");
        assertEq(usdc.balanceOf(alice), total - expectedFee, "seller gets remainder incl. dust");
    }

    function test_Buy_EmitsSold() public {
        uint256 listingId = _listAlice(1, 3_333_333); // odd price => rounding
        _fund(bob, 3_333_333);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);

        uint256 total = 3_333_333;
        uint256 fee = (total * 1000) / 10_000;
        vm.expectEmit(true, true, true, true);
        emit RareMarket.Sold(listingId, bob, alice, 1, total, total - fee, fee);

        _buyBob(listingId, 1);
    }

    // ------------------------------------------------------------ partial buy

    function test_Buy_PartialThenRest() public {
        uint256 listingId = _listAlice(10, 1e6);
        _fund(bob, 10e6);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);

        _buyBob(listingId, 3);

        RareMarket.Listing memory l = market.getListing(listingId);
        assertTrue(l.active);
        assertEq(l.amount, 7, "remaining after partial buy");
        assertEq(rare.balanceOf(bob, ITEM_ID), 3);
        assertEq(usdc.balanceOf(alice), 3e6 - (3e6 * 1000) / 10_000);

        _buyBob(listingId, 7);

        l = market.getListing(listingId);
        assertFalse(l.active, "exhausted listing deactivates");
        assertEq(l.amount, 0);
        assertEq(rare.balanceOf(bob, ITEM_ID), 10);
    }

    function test_Buy_ZeroAmount_Reverts() public {
        uint256 listingId = _listAlice(10, 1e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(RareMarket.InvalidPurchase.selector, 0, 10));
        market.buy(listingId, 0);
    }

    function test_Buy_MoreThanRemaining_Reverts() public {
        uint256 listingId = _listAlice(10, 1e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(RareMarket.InvalidPurchase.selector, 11, 10));
        market.buy(listingId, 11);
    }

    function test_Buy_InactiveListing_Reverts() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(RareMarket.ListingNotActive.selector, 42));
        market.buy(42, 1);
    }

    // ----------------------------------------------------------------- cancel

    function test_Cancel_ReturnsEscrowToSeller() public {
        uint256 listingId = _listAlice(10, 1e6);

        vm.prank(alice);
        market.cancel(listingId);

        assertEq(rare.balanceOf(alice, ITEM_ID), 100, "escrow returned");
        RareMarket.Listing memory l = market.getListing(listingId);
        assertFalse(l.active);
        assertEq(l.amount, 0);
    }

    function test_Cancel_OnlySeller() public {
        uint256 listingId = _listAlice(10, 1e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(RareMarket.NotSeller.selector, alice));
        market.cancel(listingId);
    }

    function test_Cancel_Inactive_Reverts() public {
        uint256 listingId = _listAlice(10, 1e6);
        vm.startPrank(alice);
        market.cancel(listingId);

        vm.expectRevert(abi.encodeWithSelector(RareMarket.ListingNotActive.selector, listingId));
        market.cancel(listingId);
        vm.stopPrank();
    }

    function test_Cancel_AfterFullBuy_Reverts() public {
        uint256 listingId = _listAlice(1, 1e6);
        _fund(bob, 1e6);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
        _buyBob(listingId, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(RareMarket.ListingNotActive.selector, listingId));
        market.cancel(listingId);
    }

    function test_Cancel_EmitsCancelled() public {
        uint256 listingId = _listAlice(10, 1e6);
        vm.expectEmit(true, true, true, true);
        emit RareMarket.Cancelled(listingId);
        vm.prank(alice);
        market.cancel(listingId);
    }

    // ------------------------------------------------------------ reentrancy

    function test_Buy_ReentrancyBlocked() public {
        uint256 listingId = _listAlice(10, 1e6);
        ReentrantBuyer attacker = new ReentrantBuyer(market);
        _fund(address(attacker), 10e6);
        vm.prank(address(attacker));
        usdc.approve(address(market), type(uint256).max);

        vm.prank(address(attacker));
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        attacker.attack(listingId, 5);

        // State is untouched: the reentered buy never completed, the outer buy
        // reverted atomically.
        RareMarket.Listing memory l = market.getListing(listingId);
        assertEq(l.amount, 10, "listing untouched after blocked reentrancy");
        assertEq(usdc.balanceOf(address(attacker)), 10e6, "attacker kept its funds");
    }
}
