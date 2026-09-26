// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title HumanRegistry
/// @notice Onchain mirror of a server-side World ID verification. The game
///         server (attestor key = GAME_SIGNER) calls {markVerified} only after
///         it has validated the proof with World's API, so downstream
///         contracts can treat `isVerified(account)` as "unique human".
///         The deployer (owner) can rotate the attestor key, revoke a
///         human, and pause new verifications.
contract HumanRegistry is Ownable, Pausable {
    /// @notice Game server key allowed to record verifications.
    address public attestor;

    /// @notice Whether an account has passed World ID verification.
    mapping(address => bool) public isVerified;

    /// @notice World ID nullifier hash => account it is bound to. Enforces
    ///         one human -> one account.
    mapping(uint256 => address) public nullifierOwner;

    event HumanVerified(address indexed account, uint256 indexed nullifierHash);
    event HumanRevoked(address indexed account);
    event AttestorTransferred(address indexed previousAttestor, address indexed newAttestor);

    error NotAttestor();
    error NullifierAlreadyUsed(address boundTo);
    error ZeroAddress();

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert NotAttestor();
        _;
    }

    constructor(address _attestor, address initialOwner) Ownable(initialOwner) {
        if (_attestor == address(0) || initialOwner == address(0)) revert ZeroAddress();
        attestor = _attestor;
    }

    /// @notice Records a successful server-side World ID verification.
    /// @dev Idempotent for the same (account, nullifierHash) pair. Reverts if
    ///      `nullifierHash` is already bound to a different account, so a
    ///      second wallet of the same human cannot also verify.
    function markVerified(address account, uint256 nullifierHash) external onlyAttestor whenNotPaused {
        address boundTo = nullifierOwner[nullifierHash];
        if (boundTo != address(0) && boundTo != account) {
            revert NullifierAlreadyUsed(boundTo);
        }
        nullifierOwner[nullifierHash] = account;
        isVerified[account] = true;

        emit HumanVerified(account, nullifierHash);
    }

    /// @notice Revokes a human's verified status (e.g. detected Sybil). The
    ///         nullifier stays bound, so the same World ID cannot re-verify.
    function revoke(address account) external onlyOwner {
        isVerified[account] = false;
        emit HumanRevoked(account);
    }

    /// @notice Rotates the game server key.
    function setAttestor(address newAttestor) external onlyOwner {
        if (newAttestor == address(0)) revert ZeroAddress();
        emit AttestorTransferred(attestor, newAttestor);
        attestor = newAttestor;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
