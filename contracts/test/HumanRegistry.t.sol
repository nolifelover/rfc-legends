// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {HumanRegistry} from "../src/HumanRegistry.sol";

contract HumanRegistryTest is Test {
    HumanRegistry internal registry;

    address internal attestor = makeAddr("attestor");
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice"); // wallet A: the verified human
    address internal aliceWallet2 = makeAddr("aliceWallet2"); // same human, second wallet
    address internal bob = makeAddr("bob");

    uint256 internal constant NULLIFIER_A = 0xdeadbeef;
    uint256 internal constant NULLIFIER_B = 0xcafebabe;

    function setUp() public {
        registry = new HumanRegistry(attestor, owner);
    }

    function test_AttestorIsSet() public view {
        assertEq(registry.attestor(), attestor, "attestor mismatch");
    }

    function test_UnverifiedByDefault() public {
        assertFalse(registry.isVerified(alice));
        assertEq(registry.nullifierOwner(NULLIFIER_A), address(0));
    }

    function test_Constructor_ZeroArgs_Revert() public {
        vm.expectRevert(HumanRegistry.ZeroAddress.selector);
        new HumanRegistry(address(0), owner);

        vm.expectRevert(HumanRegistry.ZeroAddress.selector);
        new HumanRegistry(attestor, address(0));
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
        vm.startPrank(attestor);
        registry.markVerified(alice, NULLIFIER_A);

        // The burn attempt: wallet2 submits the SAME nullifier and is rejected.
        vm.expectRevert(abi.encodeWithSelector(HumanRegistry.NullifierAlreadyUsed.selector, alice));
        registry.markVerified(aliceWallet2, NULLIFIER_A);

        // A later legit verify of wallet2 with its own nullifier still works.
        registry.markVerified(aliceWallet2, NULLIFIER_B);
        vm.stopPrank();

        assertEq(registry.nullifierOwner(NULLIFIER_A), alice);
        assertEq(registry.nullifierOwner(NULLIFIER_B), aliceWallet2);
        assertTrue(registry.isVerified(aliceWallet2));
    }

    // ------------------------------------------------------- owner controls

    function test_SetAttestor_RotatesKey() public {
        address newAttestor = makeAddr("newAttestor");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), bob));
        registry.setAttestor(newAttestor);

        vm.expectEmit(true, true, true, true);
        emit HumanRegistry.AttestorTransferred(attestor, newAttestor);
        vm.prank(owner);
        registry.setAttestor(newAttestor);

        assertEq(registry.attestor(), newAttestor);

        // Old key no longer works; new key does.
        vm.prank(attestor);
        vm.expectRevert(HumanRegistry.NotAttestor.selector);
        registry.markVerified(alice, NULLIFIER_A);

        vm.prank(newAttestor);
        registry.markVerified(alice, NULLIFIER_A);
        assertTrue(registry.isVerified(alice));
    }

    function test_SetAttestor_Zero_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(HumanRegistry.ZeroAddress.selector);
        registry.setAttestor(address(0));
    }

    function test_Revoke_ClearsVerified() public {
        vm.prank(attestor);
        registry.markVerified(alice, NULLIFIER_A);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), bob));
        registry.revoke(alice);

        vm.expectEmit(true, true, true, true);
        emit HumanRegistry.HumanRevoked(alice);
        vm.prank(owner);
        registry.revoke(alice);

        assertFalse(registry.isVerified(alice));
        assertEq(registry.nullifierOwner(NULLIFIER_A), alice, "nullifier stays bound after revoke");
    }

    function test_Revoke_ThenSameNullifierCannotReverify() public {
        vm.prank(attestor);
        registry.markVerified(alice, NULLIFIER_A);
        vm.prank(owner);
        registry.revoke(alice);

        // A second wallet cannot claim the revoked human's nullifier.
        vm.prank(attestor);
        vm.expectRevert(abi.encodeWithSelector(HumanRegistry.NullifierAlreadyUsed.selector, alice));
        registry.markVerified(aliceWallet2, NULLIFIER_A);
    }

    function test_Pause_BlocksMarkVerified_ThenUnpause() public {
        vm.prank(owner);
        registry.pause();

        vm.prank(attestor);
        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        registry.markVerified(alice, NULLIFIER_A);

        vm.prank(owner);
        registry.unpause();

        vm.prank(attestor);
        registry.markVerified(alice, NULLIFIER_A);
        assertTrue(registry.isVerified(alice));
    }

    function test_Pause_OnlyOwner() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), bob));
        registry.pause();
    }
}
