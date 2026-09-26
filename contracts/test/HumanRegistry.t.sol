// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {HumanRegistry} from "../src/HumanRegistry.sol";

contract HumanRegistryTest is Test {
    HumanRegistry internal registry;

    address internal attestor = makeAddr("attestor");
    address internal alice = makeAddr("alice"); // wallet A: the verified human
    address internal aliceWallet2 = makeAddr("aliceWallet2"); // same human, second wallet
    address internal bob = makeAddr("bob");

    uint256 internal constant NULLIFIER_A = 0xdeadbeef;
    uint256 internal constant NULLIFIER_B = 0xcafebabe;

    function setUp() public {
        registry = new HumanRegistry(attestor);
    }

    function test_AttestorIsSet() public view {
        assertEq(registry.attestor(), attestor, "attestor mismatch");
    }

    function test_UnverifiedByDefault() public {
        assertFalse(registry.isVerified(alice));
        assertEq(registry.nullifierOwner(NULLIFIER_A), address(0));
    }

    function test_Constructor_ZeroAttestor_Reverts() public {
        vm.expectRevert(HumanRegistry.ZeroAddress.selector);
        new HumanRegistry(address(0));
    }

    function test_MarkVerified_SetsFlagAndOwner() public {
        vm.prank(attestor);
        registry.markVerified(alice, NULLIFIER_A);

        assertTrue(registry.isVerified(alice));
        assertEq(registry.nullifierOwner(NULLIFIER_A), alice);
    }

    function test_MarkVerified_EmitsEvent() public {
        vm.expectEmit(true, true, true, true);
        emit HumanRegistry.HumanVerified(alice, NULLIFIER_A);

        vm.prank(attestor);
        registry.markVerified(alice, NULLIFIER_A);
    }

    function test_OnlyAttestor_CanMark() public {
        vm.prank(bob);
        vm.expectRevert(HumanRegistry.NotAttestor.selector);
        registry.markVerified(alice, NULLIFIER_A);
    }

    function test_NullifierBoundToAnotherAccount_Reverts() public {
        vm.startPrank(attestor);
        registry.markVerified(alice, NULLIFIER_A);

        // The same human's second wallet must be rejected.
        vm.expectRevert(abi.encodeWithSelector(HumanRegistry.NullifierAlreadyUsed.selector, alice));
        registry.markVerified(aliceWallet2, NULLIFIER_A);
        vm.stopPrank();

        assertFalse(registry.isVerified(aliceWallet2), "second wallet must stay unverified");
    }

    function test_SameAccountSameNullifier_IsIdempotent() public {
        vm.startPrank(attestor);
        registry.markVerified(alice, NULLIFIER_A);
        registry.markVerified(alice, NULLIFIER_A); // replay of the same pair is fine
        vm.stopPrank();

        assertTrue(registry.isVerified(alice));
        assertEq(registry.nullifierOwner(NULLIFIER_A), alice);
    }

    function test_SameAccountSecondNullifier_BindsBoth() public {
        vm.startPrank(attestor);
        registry.markVerified(alice, NULLIFIER_A);
        registry.markVerified(alice, NULLIFIER_B);
        vm.stopPrank();

        assertEq(registry.nullifierOwner(NULLIFIER_B), alice);
        assertTrue(registry.isVerified(alice));
    }

    function test_NullifierBurnedBySecondAccount_StillBoundToFirst() public {
        vm.prank(attestor);
        registry.markVerified(alice, NULLIFIER_A);

        // Even if the failed call bound nothing, a later legit verify of
        // wallet2 with its own nullifier still works.
        vm.prank(attestor);
        registry.markVerified(aliceWallet2, NULLIFIER_B);

        assertEq(registry.nullifierOwner(NULLIFIER_A), alice);
        assertEq(registry.nullifierOwner(NULLIFIER_B), aliceWallet2);
    }
}
