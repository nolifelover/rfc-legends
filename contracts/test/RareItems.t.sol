// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {HumanRegistry} from "../src/HumanRegistry.sol";
import {RareItems} from "../src/RareItems.sol";

contract RareItemsTest is Test {
    HumanRegistry internal registry;
    RareItems internal rare;

    uint256 internal constant GAME_KEY = 0xA11CE;
    uint256 internal constant WRONG_KEY = 0xB0B;

    address internal gameSigner;
    address internal wrongSigner;
    address internal attestor = makeAddr("attestor");
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice"); // verified human (wallet A)
    address internal bot = makeAddr("bot"); // never verified (wallet C)

    uint256 internal constant ITEM_ID = 3001; // MVP card
    uint256 internal constant AMOUNT = 1;

    function setUp() public {
        gameSigner = vm.addr(GAME_KEY);
        wrongSigner = vm.addr(WRONG_KEY);
        registry = new HumanRegistry(attestor, owner);
        rare = new RareItems(gameSigner, registry, "https://app.example/api/items/", owner);
    }

    // ---------------------------------------------------------------- helpers

    function _voucher(address to, bytes32 dropId, uint256 deadline)
        internal
        pure
        returns (RareItems.MintVoucher memory)
    {
        return RareItems.MintVoucher({to: to, itemId: ITEM_ID, amount: AMOUNT, dropId: dropId, deadline: deadline});
    }

    function _sign(RareItems.MintVoucher memory v, uint256 pk) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(rare.MINT_VOUCHER_TYPEHASH(), v.to, v.itemId, v.amount, v.dropId, v.deadline)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(_expectedDomainSeparator(), structHash);
        (uint8 sv, bytes32 r, bytes32 s) = vm.sign(pk, digest);

        // Canonicalize to low-s like real wallets do; OZ's recover enforces EIP-2.
        uint256 secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        if (uint256(s) > secp256k1n / 2) {
            s = bytes32(secp256k1n - uint256(s));
            sv = sv == 27 ? 28 : 27;
        }
        // 65-byte signature layout is (r, s, v).
        return abi.encodePacked(r, s, sv);
    }

    function _expectedDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("RFCLegendsRareItems")),
                keccak256(bytes("1")),
                block.chainid,
                address(rare)
            )
        );
    }

    function _verify(address account) internal {
        vm.prank(attestor);
        registry.markVerified(account, uint256(keccak256(abi.encodePacked(account, ":nullifier"))));
    }

    function _validVoucher(address to) internal returns (RareItems.MintVoucher memory, bytes memory) {
        RareItems.MintVoucher memory v = _voucher(to, keccak256("drop-1"), block.timestamp + 1 hours);
        return (v, _sign(v, GAME_KEY));
    }

    // ----------------------------------------------------------------- happy

    function test_MintWithVoucher_HappyPath() public {
        _verify(alice);
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);

        rare.mintWithVoucher(v, sig);

        assertEq(rare.balanceOf(alice, ITEM_ID), AMOUNT);
        assertTrue(rare.dropMinted(v.dropId));
    }

    function test_MintWithVoucher_EmitsRareMinted() public {
        _verify(alice);
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);

        vm.expectEmit(true, true, true, true);
        emit RareItems.RareMinted(alice, ITEM_ID, AMOUNT, v.dropId);

        rare.mintWithVoucher(v, sig);
    }

    function test_MintWithVoucher_RelayerCanSubmit() public {
        _verify(alice);
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);

        vm.prank(makeAddr("relayer"));
        rare.mintWithVoucher(v, sig); // tokens still land on v.to

        assertEq(rare.balanceOf(alice, ITEM_ID), AMOUNT);
    }

    function test_MintWithVoucher_AtDeadline_Succeeds() public {
        _verify(alice);
        RareItems.MintVoucher memory v = _voucher(alice, keccak256("drop-edge"), block.timestamp);
        bytes memory sig = _sign(v, GAME_KEY);

        rare.mintWithVoucher(v, sig); // block.timestamp > deadline is strict
    }

    function test_DomainSeparator_MatchesExpected() public view {
        assertEq(rare.DOMAIN_SEPARATOR(), _expectedDomainSeparator());
    }

    // ---------------------------------------------------------- failure paths

    function test_ExpiredVoucher_Reverts() public {
        _verify(alice);
        RareItems.MintVoucher memory v = _voucher(alice, keccak256("drop-2"), block.timestamp - 1);
        bytes memory sig = _sign(v, GAME_KEY);

        vm.expectRevert(abi.encodeWithSelector(RareItems.VoucherExpired.selector, v.deadline, block.timestamp));
        rare.mintWithVoucher(v, sig);
    }

    function test_WrongSigner_Reverts() public {
        _verify(alice);
        RareItems.MintVoucher memory v = _voucher(alice, keccak256("drop-3"), block.timestamp + 1 hours);
        bytes memory sig = _sign(v, WRONG_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(RareItems.InvalidSigner.selector, wrongSigner, gameSigner)
        );
        rare.mintWithVoucher(v, sig);

        assertEq(rare.balanceOf(alice, ITEM_ID), 0, "nothing minted on wrong signer");
    }

    function test_TamperedVoucher_Reverts() public {
        _verify(alice);
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);

        // Raise the amount after signing; the recovered signer becomes
        // unpredictable, so assert only on the selector.
        v.amount = 100;
        try rare.mintWithVoucher(v, sig) {
            revert("tampered voucher must not mint");
        } catch (bytes memory err) {
            assertEq(bytes4(err), RareItems.InvalidSigner.selector);
        }
    }

    function test_DropIdReplay_Reverts() public {
        _verify(alice);
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);

        rare.mintWithVoucher(v, sig);

        vm.expectRevert(abi.encodeWithSelector(RareItems.DropAlreadyMinted.selector, v.dropId));
        rare.mintWithVoucher(v, sig);
    }

    function test_DifferentVoucherSameDropId_Reverts() public {
        _verify(alice);
        bytes32 dropId = keccak256("drop-reuse");
        RareItems.MintVoucher memory v1 = _voucher(alice, dropId, block.timestamp + 1 hours);
        rare.mintWithVoucher(v1, _sign(v1, GAME_KEY));

        // A second, correctly signed voucher spending the same dropId is still a replay.
        // (Sign before expectRevert: _sign makes external view calls to `rare`
        // that would otherwise consume the "next call" the cheatcode watches.)
        RareItems.MintVoucher memory v2 = _voucher(alice, dropId, block.timestamp + 2 hours);
        bytes memory sig2 = _sign(v2, GAME_KEY);
        vm.expectRevert(abi.encodeWithSelector(RareItems.DropAlreadyMinted.selector, dropId));
        rare.mintWithVoucher(v2, sig2);
    }

    function test_UnverifiedRecipient_Reverts() public {
        // bot (wallet C) has never been verified
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(bot);

        vm.expectRevert(abi.encodeWithSelector(RareItems.NotVerifiedHuman.selector, bot));
        rare.mintWithVoucher(v, sig);
    }

    function test_MalformedSignature_Reverts() public {
        _verify(alice);
        (RareItems.MintVoucher memory v,) = _validVoucher(alice);

        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureLength.selector, 2));
        rare.mintWithVoucher(v, hex"1234");
    }

    function test_HighS_Signature_Rejected() public {
        _verify(alice);
        RareItems.MintVoucher memory v = _voucher(alice, keccak256("drop-highs"), block.timestamp + 1 hours);
        bytes32 structHash = keccak256(
            abi.encode(rare.MINT_VOUCHER_TYPEHASH(), v.to, v.itemId, v.amount, v.dropId, v.deadline)
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(rare.DOMAIN_SEPARATOR(), structHash);
        (uint8 sv, bytes32 r, bytes32 s) = vm.sign(GAME_KEY, digest);

        // Forged malleable twin: same recovered key if the precompile accepted
        // it, but OZ rejects any s above the half-order (EIP-2).
        uint256 secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 highS = bytes32(secp256k1n - uint256(s));
        if (uint256(s) > secp256k1n / 2) {
            highS = s; // vm.sign already gave high-s; use it as-is
            sv = sv == 27 ? 28 : 27; // keep validity of the twin irrelevant; must still be rejected
        }
        vm.expectRevert(abi.encodeWithSelector(ECDSA.ECDSAInvalidSignatureS.selector, highS));
        rare.mintWithVoucher(v, abi.encodePacked(r, highS, sv));
    }

    function test_ChainIdReplay_Reverts() public {
        _verify(alice);
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);

        // A signature valid on this chain must not verify on another chain:
        // the domain separator includes chainId.
        vm.chainId(31338);

        try rare.mintWithVoucher(v, sig) {
            revert("cross-chain replay must not mint");
        } catch (bytes memory err) {
            assertEq(bytes4(err), RareItems.InvalidSigner.selector);
        }
        assertEq(rare.balanceOf(alice, ITEM_ID), 0, "no mint on replayed chain");
    }

    function test_Constructor_ZeroArgs_Revert() public {
        vm.expectRevert(RareItems.ZeroAddress.selector);
        new RareItems(address(0), registry, "", owner);

        vm.expectRevert(RareItems.ZeroAddress.selector);
        new RareItems(gameSigner, HumanRegistry(address(0)), "", owner);

        vm.expectRevert(RareItems.ZeroAddress.selector);
        new RareItems(gameSigner, registry, "", address(0));
    }

    // ------------------------------------------------------ owner controls

    function test_SetVoucherSigner_RotatesAndKillsOldVouchers() public {
        _verify(alice);
        address newSigner = makeAddr("newGameSigner");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), alice));
        rare.setVoucherSigner(newSigner);

        vm.expectEmit(true, true, true, true);
        emit RareItems.VoucherSignerTransferred(gameSigner, newSigner);
        vm.prank(owner);
        rare.setVoucherSigner(newSigner);

        assertEq(rare.voucherSigner(), newSigner);

        // A voucher signed by the OLD key no longer verifies.
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);
        try rare.mintWithVoucher(v, sig) {
            revert("old-key voucher must fail after rotation");
        } catch (bytes memory err) {
            assertEq(bytes4(err), RareItems.InvalidSigner.selector);
        }
    }

    function test_SetVoucherSigner_Zero_Reverts() public {
        vm.prank(owner);
        vm.expectRevert(RareItems.ZeroAddress.selector);
        rare.setVoucherSigner(address(0));
    }

    function test_Pause_BlocksMint_ThenUnpause() public {
        _verify(alice);
        (RareItems.MintVoucher memory v, bytes memory sig) = _validVoucher(alice);

        vm.prank(owner);
        rare.pause();

        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        rare.mintWithVoucher(v, sig);

        vm.prank(owner);
        rare.unpause();

        rare.mintWithVoucher(v, sig);
        assertEq(rare.balanceOf(alice, ITEM_ID), AMOUNT);
    }

    function test_Pause_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), alice));
        rare.pause();
    }

    function test_SetBaseURI_RotatesUri() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), alice));
        rare.setBaseURI("https://evil.example/");

        vm.expectEmit(true, true, true, true);
        emit RareItems.BaseURIChanged("https://live.example/api/items/");
        vm.prank(owner);
        rare.setBaseURI("https://live.example/api/items/");

        assertEq(rare.uri(3001), "https://live.example/api/items/3001");
    }

    // -------------------------------------------------------------------- uri

    function test_Uri_DecimalAppend() public view {
        assertEq(rare.uri(3001), "https://app.example/api/items/3001");
    }

    function test_Uri_IdSubstitution() public {
        RareItems templated = new RareItems(gameSigner, registry, "https://app.example/api/items/{id}/meta.json", owner);
        // ERC-1155: {id} => 64 lowercase hex chars, no 0x prefix.
        // 3001 = 0xbb9.
        assertEq(
            templated.uri(3001),
            "https://app.example/api/items/0000000000000000000000000000000000000000000000000000000000000bb9/meta.json"
        );
    }

    function test_Uri_IdSubstitution_UpperHexItem() public {
        RareItems templated = new RareItems(gameSigner, registry, "https://app.example/api/items/{id}/meta.json", owner);
        // 0xffff...fedc style big id still renders lowercase, padded to 64.
        assertEq(
            templated.uri(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF),
            "https://app.example/api/items/ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff/meta.json"
        );
    }

    function test_Uri_EmptyBase_ReturnsEmpty() public {
        RareItems bare = new RareItems(gameSigner, registry, "", owner);
        assertEq(bare.uri(3001), "");
    }
}
