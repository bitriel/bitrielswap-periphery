// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import './PeripheryImmutableState.sol';
import '../interfaces/IPeripheryPayments.sol';
import '../interfaces/external/IWNATIVE.sol';
import '../libraries/TransferHelper.sol';

abstract contract PeripheryPayments is IPeripheryPayments, PeripheryImmutableState {
    receive() external payable {
        require(msg.sender == WNATIVE, 'Not WNATIVE');
    }

    /// @inheritdoc IPeripheryPayments
    function unwrapWNATIVE(uint256 amountMinimum, address recipient) external payable override {
        uint256 balanceWNATIVE = IWNATIVE(WNATIVE).balanceOf(address(this));
        require(balanceWNATIVE >= amountMinimum, 'Insufficient WNATIVE');

        if (balanceWNATIVE > 0) {
            IWNATIVE(WNATIVE).withdraw(balanceWNATIVE);
            TransferHelper.safeTransferNative(recipient, balanceWNATIVE);
        }
    }

    /// @inheritdoc IPeripheryPayments
    function sweepToken(
        address token,
        uint256 amountMinimum,
        address recipient
    ) external payable override {
        uint256 balanceToken = IERC20(token).balanceOf(address(this));
        require(balanceToken >= amountMinimum, 'Insufficient token');

        if (balanceToken > 0) {
            TransferHelper.safeTransfer(token, recipient, balanceToken);
        }
    }

    /// @inheritdoc IPeripheryPayments
    function refundNative() external payable override {
        if (address(this).balance > 0) TransferHelper.safeTransferNative(msg.sender, address(this).balance);
    }

    /// @param token The token to pay
    /// @param payer The entity that must pay
    /// @param recipient The entity that will receive payment
    /// @param value The amount to pay
    function pay(
        address token,
        address payer,
        address recipient,
        uint256 value
    ) internal {
        if (token == WNATIVE && address(this).balance >= value) {
            // pay with WNATIVE
            IWNATIVE(WNATIVE).deposit{value: value}(); // wrap only what is needed to pay
            IWNATIVE(WNATIVE).transfer(recipient, value);
        } else if (payer == address(this)) {
            // pay with tokens already in the contract (for the exact input multihop case)
            TransferHelper.safeTransfer(token, recipient, value);
        } else {
            // pull payment
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        }
    }
}
