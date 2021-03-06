// SPDX-License-Identifier: MIT
pragma solidity >=0.7.6;

import '@bitriel/bitrielswap-core/contracts/interfaces/IBitrielFactory.sol';
import '@bitriel/bitrielswap-core/contracts/interfaces/IBitrielPool.sol';
import './PeripheryImmutableState.sol';
import '../interfaces/IPoolInitializer.sol';

/// @title Creates and initializes V3 Pools
abstract contract PoolInitializer is IPoolInitializer, PeripheryImmutableState {
    /// @inheritdoc IPoolInitializer
    function createAndInitializePoolIfNecessary(
        address token0,
        address token1,
        uint24 fee,
        uint160 sqrtPriceX96
    ) external payable override returns (address pool) {
        require(token0 < token1);
        pool = IBitrielFactory(factory).getPool(token0, token1, fee);

        if (pool == address(0)) {
            pool = IBitrielFactory(factory).createPool(token0, token1, fee);
            IBitrielPool(pool).initialize(sqrtPriceX96);
        } else {
            (uint160 sqrtPriceX96Existing, , , , , , ) = IBitrielPool(pool).slot0();
            if (sqrtPriceX96Existing == 0) {
                IBitrielPool(pool).initialize(sqrtPriceX96);
            }
        }
    }
}
