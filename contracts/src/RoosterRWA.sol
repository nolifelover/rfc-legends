// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title RoosterRWA
/// @notice One token = one real rooster at Ninlanee Farm. The RFC Club key
///         (owner) mints and records pedigree; the farm key signs weekly
///         health/weight attestations that anyone may relay onchain.
contract RoosterRWA is ERC721, Ownable {
    /// @param name         Farm-assigned name.
    /// @param ringId       Leg ring identifier at the farm.
    /// @param sireLine     0 kumarnjeen, 1 kingkong, 2 chaokhunthong,
    ///                     3 thepbut, 4 raptor (see GDD §bloodlines).
    /// @param hatchedAt    Unix timestamp of hatch.
    /// @param sireTokenId  Token id of the sire (0 for a foundation rooster).
    /// @param damTokenId   Token id of the dam (0 for a foundation rooster).
    /// @param ensName      ENSv2 name of the rooster's subnode.
    struct Rooster {
        string name;
        string ringId;
        uint8 sireLine;
        uint64 hatchedAt;
        uint256 sireTokenId;
        uint256 damTokenId;
        string ensName;
    }

    /// @param tokenId     Token the record is about.
    /// @param weightGrams Latest weight in grams.
    /// @param healthScore 0-100 subjective farm score.
    /// @param note        Free-text farm note (Thai ok).
    /// @param checkedAt   When the farm weighed the rooster.
    /// @param nonce       Strictly increasing per token; blocks replay.
    struct Attestation {
        uint256 tokenId;
        uint32 weightGrams;
        uint8 healthScore;
        string note;
        uint64 checkedAt;
        uint64 nonce;
    }

    /// @dev Must stay byte-identical to ATTESTATION_TYPE in
    ///      apps/web/src/lib/contracts/eip712.ts.
    bytes32 public constant ATTESTATION_TYPEHASH =
        keccak256(
            "Attestation(uint256 tokenId,uint32 weightGrams,uint8 healthScore,string note,uint64 checkedAt,uint64 nonce)"
        );

    string public constant DOMAIN_NAME = "RFCLegendsRoosterRWA";
    string public constant DOMAIN_VERSION = "1";

    /// @notice Ninlanee Farm key that signs attestations.
    address public immutable farmSigner;

    uint256 private _nextTokenId = 1;

    mapping(uint256 => Rooster) private _roosters;
    mapping(uint256 => Attestation) private _attestations;

    event AttestationRecorded(
        uint256 indexed tokenId, uint32 weightGrams, uint8 healthScore, uint64 checkedAt, uint64 nonce
    );
    event RoosterMinted(uint256 indexed tokenId, address indexed to, uint8 sireLine, uint256 sireTokenId, string ensName);

    error InvalidSigner(address recovered, address expected);
    error NonceNotIncreasing(uint256 provided, uint256 lastUsed);
    error ZeroAddress();

    constructor(address _farmSigner, address initialOwner)
        ERC721("RFC Legends Rooster RWA", "RFCROOSTER")
        Ownable(initialOwner)
    {
        if (_farmSigner == address(0) || initialOwner == address(0)) revert ZeroAddress();
        farmSigner = _farmSigner;
    }

    // ------------------------------------------------------------------ mint

    /// @notice Mints one real rooster. RFC Club only.
    function mintRooster(address to, Rooster calldata r) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _roosters[tokenId] = Rooster({
            name: r.name,
            ringId: r.ringId,
            sireLine: r.sireLine,
            hatchedAt: r.hatchedAt,
            sireTokenId: r.sireTokenId,
            damTokenId: r.damTokenId,
            ensName: r.ensName
        });
        _safeMint(to, tokenId);

        emit RoosterMinted(tokenId, to, r.sireLine, r.sireTokenId, r.ensName);
    }

    /// @notice Updates a rooster's ENSv2 name (set once ENS registers it).
    function setEnsName(uint256 tokenId, string calldata ensName) external onlyOwner {
        _requireOwned(tokenId);
        _roosters[tokenId].ensName = ensName;
    }

    function getRooster(uint256 tokenId) external view returns (Rooster memory) {
        _requireOwned(tokenId);
        return _roosters[tokenId];
    }

    // ---------------------------------------------------------- attestations

    /// @notice Records a farm-signed attestation. Anyone may relay; the
    ///         signature must verify against `farmSigner` and `nonce` must be
    ///         strictly greater than the last recorded nonce for the token.
    function submitAttestation(Attestation calldata a, bytes calldata signature) external {
        _requireOwned(a.tokenId);

        uint256 lastNonce = _attestations[a.tokenId].nonce;
        if (a.nonce <= lastNonce) revert NonceNotIncreasing(a.nonce, lastNonce);

        bytes32 structHash = keccak256(
            abi.encode(
                ATTESTATION_TYPEHASH, a.tokenId, a.weightGrams, a.healthScore, keccak256(bytes(a.note)), a.checkedAt, a.nonce
            )
        );
        address recovered =
            ECDSA.recover(MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash), signature);
        if (recovered != farmSigner) revert InvalidSigner(recovered, farmSigner);

        _attestations[a.tokenId] = a;

        emit AttestationRecorded(a.tokenId, a.weightGrams, a.healthScore, a.checkedAt, a.nonce);
    }

    function latestAttestation(uint256 tokenId) external view returns (Attestation memory) {
        _requireOwned(tokenId);
        return _attestations[tokenId];
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
}
