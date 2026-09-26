// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title RoosterRWA
/// @notice One token = one real rooster at Ninlanee Farm. Minting needs two
///         parties: the RFC Club key (owner) submits, and the farm key
///         (custodian) co-signs a Registration voucher vouching for the
///         bird's ring id, bloodline and hatch date. The farm also signs
///         weekly health/weight attestations that anyone may relay onchain.
contract RoosterRWA is ERC721, Ownable {
    /// @param name         Farm-assigned name.
    /// @param ringId       Leg ring identifier at the farm; globally unique.
    /// @param sireLine     0 kumarnjeen, 1 kingkong, 2 chaokhunthong,
    ///                     3 thepbut, 4 raptor (see GDD §bloodlines).
    /// @param hatchedAt    Unix timestamp of hatch.
    /// @param sireTokenId  Token id of the sire (0 = unknown / off-chain).
    /// @param damTokenId   Token id of the dam (0 = unknown / off-chain).
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

    /// @dev Custodian voucher for a new bird. Must stay byte-identical to
    ///      REGISTRATION_TYPE in apps/web/src/lib/contracts/eip712.ts.
    bytes32 public constant REGISTRATION_TYPEHASH =
        keccak256(
            "Registration(string ringId,uint8 sireLine,uint64 hatchedAt,uint256 sireTokenId,uint256 damTokenId,address to,uint64 nonce)"
        );

    /// @dev Must stay byte-identical to ATTESTATION_TYPE in
    ///      apps/web/src/lib/contracts/eip712.ts.
    bytes32 public constant ATTESTATION_TYPEHASH =
        keccak256(
            "Attestation(uint256 tokenId,uint32 weightGrams,uint8 healthScore,string note,uint64 checkedAt,uint64 nonce)"
        );

    string public constant DOMAIN_NAME = "RFCLegendsRoosterRWA";
    string public constant DOMAIN_VERSION = "1";

    /// @notice Ninlanee Farm key: co-signs registrations, signs attestations.
    address public farmSigner;

    string private _roosterBaseURI;

    uint256 private _nextTokenId = 1;

    mapping(uint256 => Rooster) private _roosters;
    mapping(uint256 => Attestation) private _attestations;

    /// @notice keccak256(ringId) => token id. One bird = one token.
    mapping(bytes32 => uint256) public ringToken;
    /// @notice Registration nonces already consumed by the farm.
    mapping(uint64 => bool) public usedRegistrationNonce;

    event RoosterMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint8 sireLine,
        uint256 sireTokenId,
        uint256 damTokenId,
        uint64 hatchedAt,
        string ringId,
        string ensName
    );
    event AttestationRecorded(
        uint256 indexed tokenId,
        uint32 weightGrams,
        uint8 healthScore,
        uint64 checkedAt,
        uint64 nonce,
        string note,
        bytes32 digest
    );
    event EnsNameSet(uint256 indexed tokenId, string ensName);
    event FarmSignerRotated(address indexed previousSigner, address indexed newSigner);
    event BaseURIChanged(string newBaseURI);

    error InvalidSigner(address recovered, address expected);
    error NonceNotIncreasing(uint256 provided, uint256 lastUsed);
    error DuplicateRing(string ringId);
    error InvalidSireLine(uint8 sireLine);
    error SameParent(uint256 tokenId);
    error ParentHatchedAfterChild(uint256 parentTokenId, uint64 parentHatchedAt, uint64 childHatchedAt);
    error RegistrationNonceUsed(uint64 nonce);
    error ZeroAddress();

    constructor(address _farmSigner, address initialOwner, string memory baseURI_)
        ERC721("RFC Legends Rooster RWA", "RFCROOSTER")
        Ownable(initialOwner)
    {
        if (_farmSigner == address(0) || initialOwner == address(0)) revert ZeroAddress();
        farmSigner = _farmSigner;
        _roosterBaseURI = baseURI_;
    }

    // ------------------------------------------------------------------ mint

    /// @notice Registers one real rooster. RFC Club submits; the farm key
    ///         must have co-signed the Registration voucher covering ringId,
    ///         sireLine, hatchedAt, sire/dam ids, recipient and nonce.
    function mintRooster(address to, Rooster calldata r, uint64 nonce, bytes calldata farmSig)
        external
        onlyOwner
        returns (uint256 tokenId)
    {
        if (ringToken[keccak256(bytes(r.ringId))] != 0) revert DuplicateRing(r.ringId);
        if (r.sireLine > 4) revert InvalidSireLine(r.sireLine);
        if (r.sireTokenId != 0 && r.sireTokenId == r.damTokenId) revert SameParent(r.sireTokenId);
        if (usedRegistrationNonce[nonce]) revert RegistrationNonceUsed(nonce);

        // Pedigree: referenced parents must exist and hatch strictly before
        // their offspring.
        if (r.sireTokenId != 0) {
            uint64 sireHatchedAt = _roosters[r.sireTokenId].hatchedAt;
            _requireOwned(r.sireTokenId);
            if (sireHatchedAt >= r.hatchedAt) {
                revert ParentHatchedAfterChild(r.sireTokenId, sireHatchedAt, r.hatchedAt);
            }
        }
        if (r.damTokenId != 0) {
            uint64 damHatchedAt = _roosters[r.damTokenId].hatchedAt;
            _requireOwned(r.damTokenId);
            if (damHatchedAt >= r.hatchedAt) {
                revert ParentHatchedAfterChild(r.damTokenId, damHatchedAt, r.hatchedAt);
            }
        }

        bytes32 digest = MessageHashUtils.toTypedDataHash(
            DOMAIN_SEPARATOR(),
            keccak256(
                abi.encode(
                    REGISTRATION_TYPEHASH,
                    keccak256(bytes(r.ringId)),
                    r.sireLine,
                    r.hatchedAt,
                    r.sireTokenId,
                    r.damTokenId,
                    to,
                    nonce
                )
            )
        );
        address recovered = ECDSA.recover(digest, farmSig);
        if (recovered != farmSigner) revert InvalidSigner(recovered, farmSigner);

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
        ringToken[keccak256(bytes(r.ringId))] = tokenId;
        usedRegistrationNonce[nonce] = true;
        _safeMint(to, tokenId);

        emit RoosterMinted(tokenId, to, r.sireLine, r.sireTokenId, r.damTokenId, r.hatchedAt, r.ringId, r.ensName);
    }

    /// @notice Updates a rooster's ENSv2 name (set once ENS registers it).
    function setEnsName(uint256 tokenId, string calldata ensName) external onlyOwner {
        _requireOwned(tokenId);
        _roosters[tokenId].ensName = ensName;
        emit EnsNameSet(tokenId, ensName);
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
        bytes32 digest = MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != farmSigner) revert InvalidSigner(recovered, farmSigner);

        _attestations[a.tokenId] = a;

        emit AttestationRecorded(a.tokenId, a.weightGrams, a.healthScore, a.checkedAt, a.nonce, a.note, digest);
    }

    function latestAttestation(uint256 tokenId) external view returns (Attestation memory) {
        _requireOwned(tokenId);
        return _attestations[tokenId];
    }

    // ------------------------------------------------------------- lifecycle

    /// @notice Rotates the farm key. Registrations and attestations signed
    ///         by the old key stop verifying immediately.
    function setFarmSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert ZeroAddress();
        emit FarmSignerRotated(farmSigner, newSigner);
        farmSigner = newSigner;
    }

    /// @notice Rotates the metadata base URI (e.g. localhost -> live host).
    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _roosterBaseURI = newBaseURI;
        emit BaseURIChanged(newBaseURI);
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

    /// @dev Served by the web app at /api/roosters/{id}.
    function _baseURI() internal view override returns (string memory) {
        return _roosterBaseURI;
    }
}
