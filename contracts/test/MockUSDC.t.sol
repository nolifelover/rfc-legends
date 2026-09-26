// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;

    address internal alice = makeAddr("alice");

    function setUp() public {
        usdc = new MockUSDC();
    }

    function test_Metadata() public view {
        assertEq(usdc.name(), "USD Coin");
        assertEq(usdc.symbol(), "USDC");
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.FAUCET_CAP(), 10_000 * 1e6);
    }

    function test_Mint_CreditsBalance() public {
        usdc.mint(alice, 1_000 * 1e6);
        assertEq(usdc.balanceOf(alice), 1_000 * 1e6);
        assertEq(usdc.totalSupply(), 1_000 * 1e6);
    }

    function test_Mint_AtCap_Succeeds() public {
        usdc.mint(alice, usdc.FAUCET_CAP());
        assertEq(usdc.balanceOf(alice), usdc.FAUCET_CAP());
    }

    function test_Mint_AboveCap_Reverts() public {
        uint256 tooMuch = usdc.FAUCET_CAP() + 1;
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.FaucetCapExceeded.selector, tooMuch, usdc.FAUCET_CAP()));
        usdc.mint(alice, tooMuch);
    }

    function test_Mint_IsRepeatableFaucet() public {
        usdc.mint(alice, 500 * 1e6);
        usdc.mint(alice, 500 * 1e6);
        assertEq(usdc.balanceOf(alice), 1_000 * 1e6);
    }

    function test_TransferAndApprove_WorkLikeERC20() public {
        address bob = makeAddr("bob");
        usdc.mint(alice, 100 * 1e6);

        vm.prank(alice);
        usdc.transfer(bob, 40 * 1e6);
        assertEq(usdc.balanceOf(bob), 40 * 1e6);

        vm.prank(alice);
        usdc.approve(bob, 10 * 1e6);
        vm.prank(bob);
        usdc.transferFrom(alice, bob, 10 * 1e6);
        assertEq(usdc.balanceOf(alice), 50 * 1e6);
    }
}
