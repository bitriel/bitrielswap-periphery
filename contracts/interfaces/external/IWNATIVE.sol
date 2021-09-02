// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/// @title Interface for WNATIVE
interface IWNATIVE is IERC20 {
    /// @notice Deposit native token to get wrapped native token
    function deposit() external payable;

    /// @notice Withdraw wrapped native token to get native token
    function withdraw(uint) external;

    event Deposit(address indexed to, uint amount);
    event Withdrawal(address indexed from, uint amount);
}
