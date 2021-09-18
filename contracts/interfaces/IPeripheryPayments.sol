// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;

/// @title Periphery Payments
/// @notice Functions to ease deposits and withdrawals of native token
interface IPeripheryPayments {
    /// @notice Unwraps the contract's WNATIVE balance and sends it to recipient as native token.
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing WNATIVE from users.
    /// @param amountMinimum The minimum amount of WNATIVE to unwrap
    /// @param recipient The address receiving native token
    function unwrapWNATIVE(uint256 amountMinimum, address recipient) external payable;

    /// @notice Refunds any native token balance held by this contract to the `msg.sender`
    /// @dev Useful for bundling with mint or increase liquidity that uses native token, or exact output swaps
    /// that use native token for the input amount
    function refundNative() external payable;

    /// @notice Transfers the full amount of a token held by this contract to recipient
    /// @dev The amountMinimum parameter prevents malicious contracts from stealing the token from users
    /// @param token The contract address of the token which will be transferred to `recipient`
    /// @param amountMinimum The minimum amount of token required for a transfer
    /// @param recipient The destination address of the token
    function sweepToken(
        address token,
        uint256 amountMinimum,
        address recipient
    ) external payable;
}
