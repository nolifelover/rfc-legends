// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
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

    function setUp() public {
        farmSigner = vm.addr(FARM_KEY);
        wrongSigner = vm.addr(WRONG_KEY);
        rooster = new RoosterRWA(farmSigner, club);
    }

    // ---------------------------------------------------------------- helpers

    function _rooster(string memory name) internal pure returns (RoosterRWA.Rooster memory) {
        return RoosterRWA.Rooster({
            name: name,
            ringId: "R-001",
            sireLine: 3, // thepbut
            hatchedAt: 1_750_000_000,
            sireTokenId: 0,
            damTokenId: 0,
            ensName: "chick01"
        });
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

    function _sign(RoosterRWA.Attestation memory a, uint256 pk) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
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
        bytes32 digest = MessageHashUtils.toTypedDataHash(rooster.DOMAIN_SEPARATOR(), structHash);
        (uint8 sv, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        // low-s canonicalization (EIP-2), same as real wallets
        uint256 secp256k1n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        if (uint256(s) > secp256k1n / 2) {
            s = bytes32(secp256k1n - uint256(s));
            sv = sv == 27 ? 28 : 27;
        }
        return abi.encodePacked(r, s, sv);
    }

    function _mint(string memory name) internal returns (uint256) {
        vm.prank(club);
        return rooster.mintRooster(buyer, _rooster(name));
    }

    // ------------------------------------------------------------------ mint

    function test_MintRooster_OnlyClub() public {
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), buyer));
        rooster.mintRooster(buyer, _rooster("x"));
    }

    function test_MintRooster_StoresPedigreeAndIncrementsIds() public {
        uint256 id1 = _mint(unicode"ไก่ชน 1");
        uint256 id2 = _mint(unicode"ไก่ชน 2");

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(rooster.ownerOf(id1), buyer);

        RoosterRWA.Rooster memory r = rooster.getRooster(id1);
        assertEq(r.name, unicode"ไก่ชน 1");
        assertEq(r.ringId, "R-001");
        assertEq(r.sireLine, 3);
        assertEq(r.hatchedAt, 1_750_000_000);
        assertEq(r.sireTokenId, 0);
        assertEq(r.damTokenId, 0);
        assertEq(r.ensName, "chick01");
    }

    function test_MintRooster_EmitsRoosterMinted() public {
        vm.expectEmit(true, true, true, true);
        emit RoosterRWA.RoosterMinted(1, buyer, 3, 0, "chick01");
        _mint(unicode"ไก่ชน 1");
    }

    function test_MintRooster_OffspringReferencesParents() public {
        uint256 sire = _mint(unicode"พ่อพันธุ์");
        uint256 dam = _mint(unicode"แม่พันธุ์");

        RoosterRWA.Rooster memory childData = _rooster(unicode"ลูก");
        childData.sireTokenId = sire;
        childData.damTokenId = dam;
        vm.prank(club);
        uint256 child = rooster.mintRooster(buyer, childData);

        RoosterRWA.Rooster memory r = rooster.getRooster(child);
        assertEq(r.sireTokenId, sire);
        assertEq(r.damTokenId, dam);
    }

    function test_SetEnsName_OnlyClub_Updates() public {
        uint256 id = _mint(unicode"ไก่ชน 1");

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("OwnableUnauthorizedAccount(address)")), buyer));
        rooster.setEnsName(id, "evil");

        vm.prank(club);
        rooster.setEnsName(id, "chick01.thepbut.rfc.eth");
        assertEq(rooster.getRooster(id).ensName, "chick01.thepbut.rfc.eth");
    }

    function test_GetRooster_Nonexistent_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), 99));
        rooster.getRooster(99);
    }

    function test_Constructor_ZeroFarmSigner_Reverts() public {
        vm.expectRevert(RoosterRWA.ZeroAddress.selector);
        new RoosterRWA(address(0), club);
    }

    // ---------------------------------------------------------- attestations

    function test_SubmitAttestation_HappyPath() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _sign(a, FARM_KEY);

        vm.prank(relayer); // anyone may relay
        rooster.submitAttestation(a, sig);

        RoosterRWA.Attestation memory latest = rooster.latestAttestation(id);
        assertEq(latest.tokenId, id);
        assertEq(latest.weightGrams, 3_250);
        assertEq(latest.healthScore, 95);
        assertEq(latest.nonce, 1);
        assertEq(latest.checkedAt, uint64(block.timestamp));
    }

    function test_SubmitAttestation_EmitsEvent() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _sign(a, FARM_KEY);

        vm.expectEmit(true, true, true, true);
        emit RoosterRWA.AttestationRecorded(id, 3_250, 95, uint64(block.timestamp), 1);

        vm.prank(relayer);
        rooster.submitAttestation(a, sig);
    }

    function test_SubmitAttestation_WrongSigner_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _sign(a, WRONG_KEY);

        vm.expectRevert(
            abi.encodeWithSelector(RoosterRWA.InvalidSigner.selector, wrongSigner, farmSigner)
        );
        rooster.submitAttestation(a, sig);
    }

    function test_SubmitAttestation_TamperedNote_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 1);
        bytes memory sig = _sign(a, FARM_KEY);

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
        bytes memory sig = _sign(a, FARM_KEY);

        rooster.submitAttestation(a, sig);

        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.NonceNotIncreasing.selector, 1, 1));
        rooster.submitAttestation(a, sig); // exact replay
    }

    function test_SubmitAttestation_LowerNonce_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a2 = _att(id, 2);
        rooster.submitAttestation(a2, _sign(a2, FARM_KEY));

        RoosterRWA.Attestation memory a1 = _att(id, 1);
        bytes memory sig1 = _sign(a1, FARM_KEY);
        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.NonceNotIncreasing.selector, 1, 2));
        rooster.submitAttestation(a1, sig1);
    }

    function test_SubmitAttestation_ZeroNonce_Reverts() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a = _att(id, 0);
        bytes memory sig = _sign(a, FARM_KEY);

        vm.expectRevert(abi.encodeWithSelector(RoosterRWA.NonceNotIncreasing.selector, 0, 0));
        rooster.submitAttestation(a, sig);
    }

    function test_SubmitAttestation_NonexistentToken_Reverts() public {
        RoosterRWA.Attestation memory a = _att(99, 1);
        bytes memory sig = _sign(a, FARM_KEY);

        vm.expectRevert(abi.encodeWithSelector(bytes4(keccak256("ERC721NonexistentToken(uint256)")), 99));
        rooster.submitAttestation(a, sig);
    }

    function test_NoncesArePerToken() public {
        uint256 id1 = _mint(unicode"ไก่ชน 1");
        uint256 id2 = _mint(unicode"ไก่ชน 2");

        RoosterRWA.Attestation memory a1 = _att(id1, 1);
        rooster.submitAttestation(a1, _sign(a1, FARM_KEY));

        // Token 2 can start its own nonce sequence at 1.
        RoosterRWA.Attestation memory a2 = _att(id2, 1);
        rooster.submitAttestation(a2, _sign(a2, FARM_KEY));

        assertEq(rooster.latestAttestation(id2).nonce, 1);
    }

    function test_SubmitAttestation_SequentialUpdatesLatest() public {
        uint256 id = _mint(unicode"ไก่ชน 1");
        RoosterRWA.Attestation memory a1 = _att(id, 1);
        a1.weightGrams = 3_000;
        rooster.submitAttestation(a1, _sign(a1, FARM_KEY));

        vm.warp(block.timestamp + 7 days);
        RoosterRWA.Attestation memory a2 = _att(id, 2);
        a2.weightGrams = 3_400;
        rooster.submitAttestation(a2, _sign(a2, FARM_KEY));

        assertEq(rooster.latestAttestation(id).weightGrams, 3_400, "latest wins");
        assertEq(rooster.latestAttestation(id).nonce, 2);
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
}
