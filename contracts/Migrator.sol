// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0;
pragma abicoder v2;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@bitriel/bitrielswap-core/contracts/libraries/LowGasSafeMath.sol';

import './base/PeripheryImmutableState.sol';
import './base/Multicall.sol';
import './base/SelfPermit.sol';
import './base/PoolInitializer.sol';
import './interfaces/INonfungiblePositionManager.sol';
import './interfaces/IMigrator.sol';
import './interfaces/external/IWNATIVE.sol';
import './libraries/TransferHelper.sol';

/// @title BitrielSwap Migrator
contract Migrator is IMigrator, PeripheryImmutableState, PoolInitializer, Multicall, SelfPermit {
    using LowGasSafeMath for uint256;

    address public immutable oldFactory;
    address public immutable nonfungiblePositionManager;
    uint256 public immutable notBeforeBlock;

    constructor(
        address _oldFactory,
        address _factory,
        address _WNATIVE,
        address _nonfungiblePositionManager,
        uint256 _notBeforeBlock
    ) PeripheryImmutableState(_factory, _WNATIVE) {
        oldFactory = _oldFactory;
        nonfungiblePositionManager = _nonfungiblePositionManager;
        notBeforeBlock = _notBeforeBlock;
    }

    receive() external payable {
        require(msg.sender == WNATIVE, 'Not WNATIVE');
    }

    /// @inheritdoc IMigrator
    function migrate(MigrateParams calldata params) external override returns(uint256 tokenId) {
        require(block.number >= notBeforeBlock, "TE"); // too early to migrate
        require(IUniswapV2Pair(params.pair).factory() == oldFactory, "NOF"); // not from old factory
        require(params.percentageToMigrate > 0, 'PTS'); // Percentage too small
        require(params.percentageToMigrate <= 100, 'PTL'); // Percentage too large
        
        // burn Uniswap v2 liquidity to this address
        IUniswapV2Pair(params.pair).transferFrom(msg.sender, params.pair, params.liquidityToMigrate);
        (uint256 amount0V2, uint256 amount1V2) = IUniswapV2Pair(params.pair).burn(address(this));

        // calculate the amounts to migrate to BitrielSwap
        uint256 amount0V2ToMigrate = amount0V2.mul(params.percentageToMigrate) / 100;
        uint256 amount1V2ToMigrate = amount1V2.mul(params.percentageToMigrate) / 100;

        // approve the position manager up to the maximum token amounts
        TransferHelper.safeApprove(params.token0, nonfungiblePositionManager, amount0V2ToMigrate);
        TransferHelper.safeApprove(params.token1, nonfungiblePositionManager, amount1V2ToMigrate);

        // mint BitrielSwap position
        uint256 amount0V3; uint256 amount1V3;
        (tokenId, , amount0V3, amount1V3) = INonfungiblePositionManager(nonfungiblePositionManager).mint(
            INonfungiblePositionManager.MintParams({
                token0: params.token0,
                token1: params.token1,
                fee: params.fee,
                tickLower: params.tickLower,
                tickUpper: params.tickUpper,
                amount0Desired: amount0V2ToMigrate,
                amount1Desired: amount1V2ToMigrate,
                amount0Min: params.amount0Min,
                amount1Min: params.amount1Min,
                recipient: params.recipient,
                deadline: params.deadline
            })
        );

        // if necessary, clear allowance and refund dust
        if (amount0V3 < amount0V2) {
            if (amount0V3 < amount0V2ToMigrate) {
                TransferHelper.safeApprove(params.token0, nonfungiblePositionManager, 0);
            }

            uint256 refund0 = amount0V2 - amount0V3;
            if (params.refundAsNative && params.token0 == WNATIVE) {
                IWNATIVE(WNATIVE).withdraw(refund0);
                TransferHelper.safeTransferNative(msg.sender, refund0);
            } else {
                TransferHelper.safeTransfer(params.token0, msg.sender, refund0);
            }
        }
        if (amount1V3 < amount1V2) {
            if (amount1V3 < amount1V2ToMigrate) {
                TransferHelper.safeApprove(params.token1, nonfungiblePositionManager, 0);
            }

            uint256 refund1 = amount1V2 - amount1V3;
            if (params.refundAsNative && params.token1 == WNATIVE) {
                IWNATIVE(WNATIVE).withdraw(refund1);
                TransferHelper.safeTransferNative(msg.sender, refund1);
            } else {
                TransferHelper.safeTransfer(params.token1, msg.sender, refund1);
            }
        }
    }
}