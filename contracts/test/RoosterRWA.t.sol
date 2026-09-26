// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {RoosterRWA} from "../src/RoosterRWA.sol";

contract RoosterRWATest is Test {
    RoosterRWA internal rooster;

    uint256 internal constant FARM_KEY = 0xFAB;
    uint256 internal constant WRONG_KEY = 0xBAD;

    address internal farmSigner;
    address internal wrongSigner;
    address internal club = makeAddr("club"); // RFC Club owner key
    address internal buyer = makeAddr("buyer");
    address internal relayer = makeAddr("relayer");

    string internal constant BASE_URI = "https://app.example/api/roosters/";

    function setUp() public {
        farmSigner = vm.addr(FARM_KEY);
        wrongSigner = vm.addr(WRONG_KEY);
        rooster = new RoosterRWA(farmSigner, club, BASE_URI);
    }

    // ---------------------------------------------------------------- helpers

    uint256 internal ringSeq = 1;

    function _rooster(string memory name) internal returns (RoosterRWA.Rooster memory) {
        string memory ring = string.concat("R-", vm.toString(ringSeq++));
        return RoosterRWA.Rooster({
            name: name,
            ringId: ring,
            sireLine: 3, // thepbut
            hatchedAt: 1_750_000_000,
            sireTokenId: 0,
            damTokenId: 0,
            ensName: "chick01"
        });
    }

    function _regHash(RoosterRWA.Rooster memory r, address to, uint64 nonce) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                rooster.REGISTRATION_TYPEHASH(),
                keccak256(bytes(r.ringId)),
                r.sireLine,
                r.hatchedAt,
                r.sireTokenId,
                r.damTokenId,
                to,
                nonce
            )
        );
    }

    function _regSign(RoosterRWA.Rooster memory r, address to, uint64 nonce, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = MessageHashUtils.toTypedDataHash(rooster.DOMAIN_SEPARATOR(), _regHash(r, to, nonce));
        (uint8 sv, bytes32 rr, bytes32 ss) = vm.sign(pk, digest);
        uint256 secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        if (uint256(ss) > secp256k1n / 2) {
            ss = bytes32(secp256k1n - uint256(ss));
            sv = sv == 27 ? 28 : 27;
        }
        return abi.encodePacked(rr, ss, sv);
    }

    uint256 internal regNonce = 1;

    function _mint(string memory name) internal returns (uint256) {
        RoosterRWA.Rooster memory r = _rooster(name);
        uint64 nonce = uint64(regNonce++);
        bytes memory sig = _regSign(r, buyer, nonce, FARM_KEY);
        vm.prank(club);
        return rooster.mintRooster(buyer, r, nonce, sig);
    }

    function _att(uint256 tokenId, uint64 nonce) internal view returns (RoosterRWA.Attestation memory) {
        return RoosterRWA.Attestation({
            tokenId: tokenId,
            weightGrams: 3_250,
            healthScore: 95,
            note: unicode"สุขภาพดี กินอาหารเต็มที่",
            checkedAt: uint64(block.timestamp),
            nonce: nonce
        });
    }

    function _attHash(RoosterRWA.Attestation memory a) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                rooster.ATTESTATION_TYPEHASH(),
                a.tokenId,
                a.weightGrams,
                a.healthScore,
                keccak256(bytes(a.note)),
                a.checkedAt,
                a.nonce
            )
        );
    }

    function _attSign(RoosterRWA.Attestation memory a, uint256 pk) internal view returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toTypedDataHash(rooster.DOMAIN_SEPARATOR(), _attHash(a));
        (uint8 sv, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        uint256 secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        if (uint256(s) > secp256k1n / 2) {
            s = bytes32(secp256k1n - uint256(s));
            sv = sv == 27 ? 28 : 27;
        }
        return abi.encodePacked(r, s, sv);
    }

    // ------------------------------------------------------------------ mint

    function test_MintRooster_OnlyClub() public {
        RoosterRWA.Rooster memory r = _rooster("x");
        bytes memory sig = _regSign(r, buyer, 1, FARM_KEY);
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), buyer));
        rooster.mintRooster(buyer, r, 1, sig);
    }

    function test_MintRooster_StoresPedigreeAndIncrementsIds() public {
        uint256 id1 = _mint(unicode"ไก่ชน 1");
        uint256 id2 = _mint(unicode"ไก่ชน 2");

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(rooster.ownerOf(id1), buyer);

        RoosterRWA.Rooster memory r = rooster.getRooster(id1);
        assertEq(r.ringId, "R-1", "unique ring id");
        assertEq(r.sireLine, 3);
        assertEq(r.hatchedAt, 1_750_000_000);
        assertEq(r.ensName, "chick01");
    }

    function test_MintRooster_BindsRingToToken() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        assertEq(rooster.ringToken(keccak256(bytes("R-1"))), id);
    }

    function test_MintRooster_EmitsRoosterMinted() public {
        RoosterRWA.Rooster memory r = _rooster(unicode"ไก่ชน 1");
        bytes memory sig = _regSign(r, buyer, 7, FARM_KEY);

        vm.expectEmit(true, true, true, true);
        emit RoosterRWA.RoosterMinted(1, buyer, 3, 0, 0, 1_750_000_000, "R-1", "chick01");

        vm.prank(club);
        rooster.mintRooster(buyer, r, 7, sig);
    }

    function test_MintRooster_OffspringReferencesParents() public {
        RoosterRWA.Rooster memory sireR = _rooster(unicode"พ่อพันธุ์");
        sireR.hatchedAt = 1_600_000_000;
        bytes memory sig1 = _regSign(sireR, buyer, 1, FARM_KEY);

        RoosterRWA.Rooster memory damR = _rooster(unicode"แม่พันธุ์");
        damR.hatchedAt = 1_600_000_001;
        bytes memory sig2 = _regSign(damR, buyer, 2, FARM_KEY);

        RoosterRWA.Rooster memory child = _rooster(unicode"ลูก");
        child.sireTokenId = 1;
        child.damTokenId = 2;
        bytes memory sig3 = _regSign(child, buyer, 3, FARM_KEY);

        vm.startPrank(club);
        uint256 sire = rooster.mintRooster(buyer, sireR, 1, sig1);
        uint256 dam = rooster.mintRooster(buyer, damR, 2, sig2);
        uint256 childId = rooster.mintRooster(buyer, child, 3, sig3);
        vm.stopPrank();

        RoosterRWA.Rooster memory stored = rooster.getRooster(childId);
        assertEq(stored.sireTokenId, sire);
        assertEq(stored.damTokenId, dam);
    }

    function test_MintRooster_DuplicateRing_Reverts() public {
        RoosterRWA.Rooster memory r = _rooster(unicode"ไก่ชน 1"); // ring R-1
        bytes memory sig1 = _regSign(r, buyer, 1, FARM_KEY);
        bytes memory sig2 = _regSign(r, buyer, 2, FARM_KEY); // fresh nonce, still duplicate

        vm.startPrank(club);
        rooster.mintRooster(buyer, r, 1, sig1);

        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.DuplicateRing.selector, "R-1"));
        rooster.mintRooster(buyer, r, 2, sig2);
        vm.stopPrank();
    }

    function test_MintRooster_InvalidSireLine_Reverts() public {
        RoosterRWA.Rooster memory r = _rooster("x");
        r.sireLine = 5;
        bytes memory sig = _regSign(r, buyer, 1, FARM_KEY);

        vm.prank(club);
        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.InvalidSireLine.selector, 5));
        rooster.mintRooster(buyer, r, 1, sig);
    }

    function test_MintRooster_SameParentForSireAndDam_Reverts() public {
        RoosterRWA.Rooster memory parent = _rooster(unicode"พ่อพันธุ์");
        parent.hatchedAt = 1_600_000_000;
        bytes memory sig1 = _regSign(parent, buyer, 1, FARM_KEY);
        vm.prank(club);
        uint256 p = rooster.mintRooster(buyer, parent, 1, sig1);

        RoosterRWA.Rooster memory child = _rooster(unicode"ลูก");
        child.sireTokenId = p;
        child.damTokenId = p;
        bytes memory sig = _regSign(child, buyer, 2, FARM_KEY);

        vm.prank(club);
        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.SameParent.selector, p));
        rooster.mintRooster(buyer, child, 2, sig);
    }

    function test_MintRooster_ParentHatchedAfterChild_Reverts() public {
        RoosterRWA.Rooster memory parent = _rooster(unicode"พ่อพันธุ์");
        parent.hatchedAt = 1_800_000_000; // after the child's default 1.75e9
        bytes memory sig1 = _regSign(parent, buyer, 1, FARM_KEY);
        vm.prank(club);
        uint256 p = rooster.mintRooster(buyer, parent, 1, sig1);

        RoosterRWA.Rooster memory child = _rooster(unicode"ลูก");
        child.sireTokenId = p; // sire path
        bytes memory sig = _regSign(child, buyer, 2, FARM_KEY);

        RoosterRWA.Rooster memory child2 = _rooster(unicode"ลูก 2");
        child2.ringId = "R-OTHER";
        child2.damTokenId = p; // dam path
        bytes memory sig2 = _regSign(child2, buyer, 3, FARM_KEY);

        vm.startPrank(club);
        vm.expectRevert(
            abi.encodeWithSelector(RoosterRWA.ParentHatchedAfterChild.selector, p, 1_800_000_000, 1_750_000_000)
        );
        rooster.mintRooster(buyer, child, 2, sig);

        vm.expectRevert(
            abi.encodeWithSelector(RoosterRWA.ParentHatchedAfterChild.selector, p, 1_800_000_000, 1_750_000_000)
        );
        rooster.mintRooster(buyer, child2, 3, sig2);
        vm.stopPrank();
    }

    function test_MintRooster_NonexistentParent_Reverts() public {
        RoosterRWA.Rooster memory child = _rooster(unicode"ลูก");
        child.sireTokenId = 42; // no such token
        bytes memory sig = _regSign(child, buyer, 1, FARM_KEY);

        vm.prank(club);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), 42));
        rooster.mintRooster(buyer, child, 1, sig);
    }

    function test_MintRooster_RegistrationNonceReplay_Reverts() public {
        RoosterRWA.Rooster memory r1 = _rooster(unicode"ไก่ชน 1");
        bytes memory sig1 = _regSign(r1, buyer, 5, FARM_KEY);
        RoosterRWA.Rooster memory r2 = _rooster(unicode"ไก่ชน 2");
        bytes memory sig2 = _regSign(r2, buyer, 5, FARM_KEY); // reuses nonce 5

        vm.startPrank(club);
        rooster.mintRooster(buyer, r1, 5, sig1);

        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.RegistrationNonceUsed.selector, 5));
        rooster.mintRooster(buyer, r2, 5, sig2);
        vm.stopPrank();
    }

    function test_MintRooster_WrongSigner_Reverts() public {
        RoosterRWA.Rooster memory r = _rooster("x");
        bytes memory sig = _regSign(r, buyer, 1, WRONG_KEY);

        vm.prank(club);
        vm.expectRevert(
            abi.encodeWithSelector(RoosterRWA.InvalidSigner.selector, wrongSigner, farmSigner)
        );
        rooster.mintRooster(buyer, r, 1, sig);
    }

    function test_MintRooster_SignatureBindsRecipient() public {
        // Signed for buyer, submitted for a different recipient: must fail.
        RoosterRWA.Rooster memory r = _rooster("x");
        bytes memory sig = _regSign(r, buyer, 1, FARM_KEY);

        address other = makeAddr("other");
        vm.prank(club);
        try rooster.mintRooster(other, r, 1, sig) {
            revert("recipient swap must not mint");
        } catch (bytes memory err) {
            assertEq(bytes4(err), RoosterRWA.InvalidSigner.selector);
        }
    }

    function test_SetEnsName_OnlyClub_UpdatesAndEmits() public {
        uint256 id = _mint(unicode"ไก่ชน 1");

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), buyer));
        rooster.setEnsName(id, "evil");

        vm.expectEmit(true, true, true, true);
        emit RoosterRWA.EnsNameSet(id, "chick01.thepbut.rfc.eth");
        vm.prank(club);
        rooster.setEnsName(id, "chick01.thepbut.rfc.eth");

        assertEq(rooster.getRooster(id).ensName, "chick01.thepbut.rfc.eth");
    }

    function test_GetRooster_Nonexistent_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), 99));
        rooster.getRooster(99);
    }

    function test_Constructor_ZeroArgs_Revert() public {
        vm.expectRevert(RoosterRWA.ZeroAddress.selector);
        new RoosterRWA(address(0), club, BASE_URI);

        vm.expectRevert(RoosterRWA.ZeroAddress.selector);
        new RoosterRWA(farmSigner, address(0), BASE_URI);
    }

    // ---------------------------------------------------------- attestations

    function test_SubmitAttestation_HappyPath() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _attSign(a, FARM_KEY);

        vm.prank(relayer); // anyone may relay
        rooster.submitAttestation(a, sig);

        RoosterRWA.Attestation memory latest = rooster.latestAttestation(id);
        assertEq(latest.tokenId, id);
        assertEq(latest.weightGrams, 3_250);
        assertEq(latest.healthScore, 95);
        assertEq(latest.nonce, 1);
        assertEq(latest.checkedAt, uint64(block.timestamp));
    }

    function test_SubmitAttestation_EmitsEventWithNoteAndDigest() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _attSign(a, FARM_KEY);
        bytes32 digest = MessageHashUtils.toTypedDataHash(rooster.DOMAIN_SEPARATOR(), _attHash(a));

        vm.expectEmit(true, true, true, true);
        emit RoosterRWA.AttestationRecorded(
            id, 3_250, 95, uint64(block.timestamp), 1, unicode"สุขภาพดี กินอาหารเต็มที่", digest
        );

        vm.prank(relayer);
        rooster.submitAttestation(a, sig);
    }

    function test_SubmitAttestation_WrongSigner_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _attSign(a, WRONG_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(RoosterRWA.InvalidSigner.selector, wrongSigner, farmSigner)
        );
        rooster.submitAttestation(a, sig);
    }

    function test_SubmitAttestation_TamperedNote_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _attSign(a, FARM_KEY);

        a.note = unicode"แก้เนื้อความหลังเซ็น"; // signed note no longer matches
        try rooster.submitAttestation(a, sig) {
            revert("tampered attestation must not record");
        } catch (bytes memory err) {
            assertEq(bytes4(err), RoosterRWA.InvalidSigner.selector);
        }
    }

    function test_SubmitAttestation_NonceReplay_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _attSign(a, FARM_KEY);

        rooster.submitAttestation(a, sig);

        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.NonceNotIncreasing.selector, 1, 1));
        rooster.submitAttestation(a, sig); // exact replay
    }

    function test_SubmitAttestation_LowerNonce_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a2 = _att(id, 2);
        rooster.submitAttestation(a2, _attSign(a2, FARM_KEY));

        RoosterRWA.Attestation memory a1 = _att(id, 1);
        bytes memory sig1 = _attSign(a1, FARM_KEY);
        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.NonceNotIncreasing.selector, 1, 2));
        rooster.submitAttestation(a1, sig1);
    }

    function test_SubmitAttestation_ZeroNonce_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 0);
        bytes memory sig = _attSign(a, FARM_KEY);

        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.NonceNotIncreasing.selector, 0, 0));
        rooster.submitAttestation(a, sig);
    }

    function test_SubmitAttestation_NonexistentToken_Reverts() public {
        RoosterRWA.Attestation memory a = _att(99, 1);
        bytes memory sig = _attSign(a, FARM_KEY);

        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), 99));
        rooster.submitAttestation(a, sig);
    }

    function test_SubmitAttestation_ChainIdReplay_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _attSign(a, FARM_KEY);

        vm.chainId(31338); // domain separator changes with the chain

        try rooster.submitAttestation(a, sig) {
            revert("cross-chain attestation replay must not record");
        } catch (bytes memory err) {
            assertEq(bytes4(err), RoosterRWA.InvalidSigner.selector);
        }
    }

    function test_NoncesArePerToken() public {
        uint256 id1 = _mint(unicode"ไก่ชน 1");
        uint256 id2 = _mint(unicode"ไก่ชน 2");

        RoosterRWA.Attestation memory a1 = _att(id1, 1);
        rooster.submitAttestation(a1, _attSign(a1, FARM_KEY));

        // Token 2 can start its own nonce sequence at 1.
        RoosterRWA.Attestation memory a2 = _att(id2, 1);
        rooster.submitAttestation(a2, _attSign(a2, FARM_KEY));

        assertEq(rooster.latestAttestation(id2).nonce, 1);
    }

    function test_SubmitAttestation_SequentialUpdatesLatest() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a1 = _att(id, 1);
        a1.weightGrams = 3_000;
        rooster.submitAttestation(a1, _attSign(a1, FARM_KEY));

        vm.warp(block.timestamp + 7 days);
        RoosterRWA.Attestation memory a2 = _att(id, 2);
        a2.weightGrams = 3_400;
        rooster.submitAttestation(a2, _attSign(a2, FARM_KEY));

        assertEq(rooster.latestAttestation(id).weightGrams, 3_400, "latest wins");
        assertEq(rooster.latestAttestation(id).nonce, 2);
    }

    // ------------------------------------------------------------- lifecycle

    function test_SetFarmSigner_RotatesAndKillsOldSignatures() public {
        address newFarm = makeAddr("newFarmSigner");

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), buyer));
        rooster.setFarmSigner(newFarm);

        vm.expectEmit(true, true, true, true);
        emit RoosterRWA.FarmSignerRotated(farmSigner, newFarm);
        vm.prank(club);
        rooster.setFarmSigner(newFarm);

        assertEq(rooster.farmSigner(), newFarm);

        // Old-key registration no longer verifies.
        RoosterRWA.Rooster memory r = _rooster("x");
        bytes memory sig = _regSign(r, buyer, 9, FARM_KEY);
        vm.prank(club);
        vm.expectRevert(
            abi.encodeWithSelector(RoosterRWA.InvalidSigner.selector, farmSigner, newFarm)
        );
        rooster.mintRooster(buyer, r, 9, sig);
    }

    function test_SetFarmSigner_Zero_Reverts() public {
        vm.prank(club);
        vm.expectRevert(RoosterRWA.ZeroAddress.selector);
        rooster.setFarmSigner(address(0));
    }

    function test_DomainSeparator_MatchesExpected() public view {
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("RFCLegendsRoosterRWA")),
                keccak256(bytes("1")),
                block.chainid,
                address(rooster)
            )
        );
        assertEq(rooster.DOMAIN_SEPARATOR(), expected);
    }

    function test_TokenMetadata() public view {
        assertEq(rooster.name(), "RFC Legends Rooster RWA");
        assertEq(rooster.symbol(), "RFCROOSTER");
    }

    // ---------------------------------------------- cross-language signature

    /// @dev Fixed signature generated by viem (Node) against
    ///      apps/web/src/lib/contracts/eip712.ts constants:
    ///        domain  : RFCLegendsRoosterRWA v1, chainId 31337,
    ///                  verifyingContract 0x00000000000000000000000000000000C0FFEE01
    ///        message : ringId "R-FIXED-001", sireLine 3, hatchedAt 1750000000,
    ///                  sire 0, dam 0, to 0x1111...1111, nonce 1
    ///        signer  : farm key 0x00..FAB (= 0xc11862b9E476aeDC610bBd3020E12C03EE940fCA)
    ///      The contract instance is copied to that exact address via
    ///      vm.etch so the domain separator the Solidity side computes is
    ///      the one viem signed over. This is the real cross-language check.
    function test_ViemFixedSignature_Verifies() public {
        RoosterRWA live = new RoosterRWA(farmSigner, club, BASE_URI);
        address fixedAt = 0x00000000000000000000000000000000C0FFEE01;
        vm.etch(fixedAt, address(live).code);
        RoosterRWA roosterAt = RoosterRWA(payable(fixedAt));

        // vm.etch copies code but not storage. The layout (forge inspect
        // RoosterRWA storageLayout): Ownable's _owner at slot 6, farmSigner
        // at slot 7 — both after the ERC-721 base storage. Restore them,
        // then set the base URI through the owner-gated setter.
        vm.store(fixedAt, bytes32(uint256(6)), bytes32(uint256(uint160(club))));
        vm.store(fixedAt, bytes32(uint256(7)), bytes32(uint256(uint160(farmSigner))));
        vm.prank(club);
        roosterAt.setBaseURI(BASE_URI);

        RoosterRWA.Rooster memory r = RoosterRWA.Rooster({
            name: unicode"ไก่ตัวทดสอบข้ามภาษา",
            ringId: "R-FIXED-001",
            sireLine: 3,
            hatchedAt: 1_750_000_000,
            sireTokenId: 0,
            damTokenId: 0,
            ensName: ""
        });
        bytes memory sig =
            hex"607a0a4829141d7d5dfd994b52a71c416b015ed7647a38679fb147d3f6da9c356e29878be03f74d54cf382f34f7824aacd1f9d1933325f087ed55621985d18911c";

        vm.prank(club);
        uint256 id = roosterAt.mintRooster(0x1111111111111111111111111111111111111111, r, 1, sig);

        // Fresh storage means the first id here is 0, not 1.
        assertEq(id, 0);
        assertEq(roosterAt.ownerOf(0), 0x1111111111111111111111111111111111111111);
        assertEq(roosterAt.ringToken(keccak256(bytes("R-FIXED-001"))), 0);
        // tokenURI follows the base URI + decimal id convention.
        assertEq(roosterAt.tokenURI(0), string.concat(BASE_URI, "0"));
    }

    function test_SetBaseURI_RotatesTokenUri() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        assertEq(rooster.tokenURI(id), string.concat(BASE_URI, "1"));

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), buyer));
        rooster.setBaseURI("https://live.example/api/roosters/");

        vm.expectEmit(true, true, true, true);
        emit RoosterRWA.BaseURIChanged("https://live.example/api/roosters/");
        vm.prank(club);
        rooster.setBaseURI("https://live.example/api/roosters/");

        assertEq(rooster.tokenURI(id), "https://live.example/api/roosters/1");
    }
}
