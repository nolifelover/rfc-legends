// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title HumanRegistry
/// @notice Onchain mirror of a server-side World ID verification. The game
///         server (attestor key = GAME_SIGNER) calls {markVerified} only after
///         it has validated the proof with World's API, so downstream
///         contracts can treat `isVerified(account)` as "unique human".
contract HumanRegistry {
    /// @notice Game server key allowed to record verifications.
    address public attestor;

    /// @notice Whether an account has passed World ID verification.
    mapping(address => bool) public isVerified;

    /// @notice World ID nullifier hash => account it is bound to. Enforces
    ///         one human -> one account.
    mapping(uint256 => address) public nullifierOwner;

    event HumanVerified(address indexed account, uint256 indexed nullifierHash);

    error NotAttestor();
    error NullifierAlreadyUsed(address boundTo);
    error ZeroAddress();

    modifier onlyAttestor() {
        if (msg.sender != attestor) revert NotAttestor();
        _;
    }

    constructor(address _attestor) {
        if (_attestor == address(0)) revert ZeroAddress();
        attestor = _attestor;
    }

    /// @notice Records a successful server-side World ID verification.
    /// @dev Idempotent for the same (account, nullifierHash) pair. Reverts if
    ///      `nullifierHash` is already bound to a different account, so a
    ///      second wallet of the same human cannot also verify.
    function markVerified(address account, uint256 nullifierHash) external onlyAttestor {
        address boundTo = nullifierOwner[nullifierHash];
        if (boundTo != address(0) && boundTo != account) {
            revert NullifierAlreadyUsed(boundTo);
        }
        nullifierOwner[nullifierHash] = account;
        isVerified[account] = true;

        emit HumanVerified(account, nullifierHash);
    }
}
