// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Testnet-only USDC stand-in used to pay for Rare Market listings.
/// @dev Anyone may call {mint} as a faucet, capped per call, so a demo wallet
///      cannot mint an unbounded balance in a single transaction.
contract MockUSDC is ERC20 {
    /// @notice Maximum amount the faucet hands out per call (10,000 USDC, 6 decimals).
    uint256 public constant FAUCET_CAP = 10_000 * 1e6;

    /// @dev Reverts when a faucet call exceeds the per-call cap.
    error FaucetCapExceeded(uint256 requested, uint256 cap);

    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Faucet: mints `amount` (6 decimals) to `to`.
    function mint(address to, uint256 amount) external {
        if (amount > FAUCET_CAP) revert FaucetCapExceeded(amount, FAUCET_CAP);
        _mint(to, amount);
    }
}
