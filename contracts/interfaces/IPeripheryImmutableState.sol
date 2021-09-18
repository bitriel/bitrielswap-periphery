// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;

/// @title Immutable state
/// @notice Functions that return immutable state of the router
interface IPeripheryImmutableState {
    /// @return Returns the address of the Bitriel factory
    function factory() external view returns (address);

    /// @return Returns the address of WNATIVE
    function WNATIVE() external view returns (address);
}
