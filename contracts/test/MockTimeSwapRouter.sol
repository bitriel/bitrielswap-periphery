// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;
pragma abicoder v2;

import '../BitrielSwapRouter.sol';

contract MockTimeSwapRouter is BitrielSwapRouter {
  uint256 time;

  constructor(address _factory, address _WNATIVE) BitrielSwapRouter(_factory, _WNATIVE) {}

  function _blockTimestamp() internal view override returns (uint256) {
    return time;
  }

  function setTime(uint256 _time) external {
    time = _time;
  }
}