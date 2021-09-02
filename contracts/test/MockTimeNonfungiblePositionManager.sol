// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;
pragma abicoder v2;

import '../NonfungiblePositionManager.sol';

contract MockTimeNonfungiblePositionManager is NonfungiblePositionManager {
  uint256 time;

  constructor(
    address _factory,
    address _WNATIVE,
    address _tokenDescriptor
  ) NonfungiblePositionManager(_factory, _WNATIVE, _tokenDescriptor) {}

  function _blockTimestamp() internal view override returns (uint256) {
    return time;
  }

  function setTime(uint256 _time) external {
    time = _time;
  }
}