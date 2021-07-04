// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.7.6;

abstract contract PeripheryValidation {
    modifier checkDeadline(uint256 deadline) {
        require(block.timestamp <= deadline, 'Transaction too old');
        _;
    }
}
