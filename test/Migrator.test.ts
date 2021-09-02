import { Fixture } from 'ethereum-waffle'
import { constants, Contract, Wallet } from 'ethers'
import { ethers, waffle } from 'hardhat'
import { expect } from "chai"
import { FeeAmount } from './utils/constants'

import {
  Iwnative,
  Erc20Mock,
  IBitrielFactory,
  IUniswapV2Pair,
  MockTimeNonfungiblePositionManager,
  Migrator,
} from "../types"
import { abi as PAIR_ABI } from "@uniswap/v2-core/build/UniswapV2Pair.json"
import { oldFactoryFixture, completeFixture } from './shared/fixtures'
import { encodePriceSqrt, snapshotGasCost, sortedTokens, getMaxTick, getMinTick } from "./shared"

describe("Migrator", () => {
  let accounts: Wallet[];
  let oldFactory: Contract;
  let factory: IBitrielFactory;
  let wnative: Iwnative;
  let nft: MockTimeNonfungiblePositionManager;
  let pair: IUniswapV2Pair;
  let token: Erc20Mock;
  let migrator: Migrator;

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  const migratorFixture: Fixture<{
    oldFactory: Contract
    factory: IBitrielFactory
    token: Erc20Mock
    wnative: Iwnative
    nft: MockTimeNonfungiblePositionManager
    migrator: Migrator
  }> = async (wallets, provider) => {
    const { wnative, factory, tokens, nft } = await completeFixture(wallets, provider)

    const { oldFactory } = await oldFactoryFixture(wallets, provider)

    const token = tokens[0]
    await token.approve(oldFactory.address, constants.MaxUint256)
    await wnative.deposit({ value: 10000 })
    await wnative.approve(nft.address, constants.MaxUint256)

    // deploy the migrator
    const migrator = (await (await ethers.getContractFactory('Migrator')).deploy(
      oldFactory.address,
      factory.address,
      wnative.address,
      nft.address,
      "0"
    )) as Migrator

    return {
      oldFactory,
      factory,
      token,
      wnative,
      nft,
      migrator,
    }
  }

  before('get signers and contract factories', async () => {
    accounts = await (ethers as any).getSigners()
    loadFixture = waffle.createFixtureLoader(accounts)
  })

  beforeEach('load fixture', async () => {
    ;({ oldFactory, factory, token, wnative, nft, migrator } = await loadFixture(migratorFixture))
  })

  afterEach('ensure allowances are cleared', async () => {
    const allowanceToken = await token.allowance(migrator.address, nft.address)
    const allowanceWNATIVE = await wnative.allowance(migrator.address, nft.address)
    expect(allowanceToken).to.be.eq(0)
    expect(allowanceWNATIVE).to.be.eq(0)
  })

  afterEach('ensure balances are cleared', async () => {
    const balanceToken = await token.balanceOf(migrator.address)
    const balanceWNATIVE = await wnative.balanceOf(migrator.address)
    expect(balanceToken).to.be.eq(0)
    expect(balanceWNATIVE).to.be.eq(0)
  })

  afterEach('ensure native balance is cleared', async () => {
    const balanceNATIVE = await ethers.provider.getBalance(migrator.address)
    expect(balanceNATIVE).to.be.eq(0)
  })

  describe('#migrate', () => {
    let tokenLower: boolean
    const expectedLiquidity = 10000 - 1000

    beforeEach(() => {
      tokenLower = token.address.toLowerCase() < wnative.address.toLowerCase()
    })

    beforeEach('add V2 liquidity', async () => {
      await oldFactory.createPair(token.address, wnative.address)
      const pairAddress = await oldFactory.getPair(token.address, wnative.address)
      pair = new Contract(pairAddress, PAIR_ABI, accounts[0]) as IUniswapV2Pair
      await token.transfer(pairAddress, 10000)
      await wnative.transfer(pairAddress, 10000)
      await pair.mint(accounts[0].address)
      expect(await pair.balanceOf(accounts[0].address)).equal(expectedLiquidity)
    })

    it('fail if pool is not initialized', async () => {
      await pair.approve(migrator.address, expectedLiquidity)
      const [token0, token1] = sortedTokens(wnative, token)

      await expect(migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: -1,
        tickUpper: 1,
        amount0Min: 9000,
        amount1Min: 9000,
        recipient: accounts[0].address,
        deadline: 1,
        refundAsNative: false
      })).reverted
    })

    it('works once v3 pool is initialized', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(FeeAmount.MEDIUM),
        tickUpper: getMaxTick(FeeAmount.MEDIUM),
        amount0Min: 9000,
        amount1Min: 9000,
        recipient: accounts[0].address,
        deadline: 1,
        refundAsNative: false,
      })

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(9000)

      const poolAddress = await factory.getPool(token.address, wnative.address, FeeAmount.MEDIUM)
      expect(await token.balanceOf(poolAddress)).to.be.eq(9000)
      expect(await wnative.balanceOf(poolAddress)).to.be.eq(9000)
    })

    it('works for partial', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )

      const tokenBalanceBefore = await token.balanceOf(accounts[0].address)
      const wnativeBalanceBefore = await wnative.balanceOf(accounts[0].address)

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 50,
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(FeeAmount.MEDIUM),
        tickUpper: getMaxTick(FeeAmount.MEDIUM),
        amount0Min: 4500,
        amount1Min: 4500,
        recipient: accounts[0].address,
        deadline: 1,
        refundAsNative: false,
      })

      const tokenBalanceAfter = await token.balanceOf(accounts[0].address)
      const wnativeBalanceAfter = await wnative.balanceOf(accounts[0].address)

      expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
      expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(4500)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(4500)

      const poolAddress = await factory.getPool(token.address, wnative.address, FeeAmount.MEDIUM)
      expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
      expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
    })

    it('double the price', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(2, 1)
      )

      const tokenBalanceBefore = await token.balanceOf(accounts[0].address)
      const wnativeBalanceBefore = await wnative.balanceOf(accounts[0].address)

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(FeeAmount.MEDIUM),
        tickUpper: getMaxTick(FeeAmount.MEDIUM),
        amount0Min: 4500,
        amount1Min: 8999,
        recipient: accounts[0].address,
        deadline: 1,
        refundAsNative: false,
      })

      const tokenBalanceAfter = await token.balanceOf(accounts[0].address)
      const wnativeBalanceAfter = await wnative.balanceOf(accounts[0].address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factory.getPool(token.address, wnative.address, FeeAmount.MEDIUM)
      if (token.address.toLowerCase() < wnative.address.toLowerCase()) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(1)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(4500)
      }
    })

    it('half the price', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 2)
      )

      const tokenBalanceBefore = await token.balanceOf(accounts[0].address)
      const wnativeBalanceBefore = await wnative.balanceOf(accounts[0].address)

      await pair.approve(migrator.address, expectedLiquidity)
      await migrator.migrate({
        pair: pair.address,
        liquidityToMigrate: expectedLiquidity,
        percentageToMigrate: 100,
        token0: token0.address,
        token1: token1.address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(FeeAmount.MEDIUM),
        tickUpper: getMaxTick(FeeAmount.MEDIUM),
        amount0Min: 8999,
        amount1Min: 4500,
        recipient: accounts[0].address,
        deadline: 1,
        refundAsNative: false,
      })

      const tokenBalanceAfter = await token.balanceOf(accounts[0].address)
      const wnativeBalanceAfter = await wnative.balanceOf(accounts[0].address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factory.getPool(token.address, wnative.address, FeeAmount.MEDIUM)
      if (token.address.toLowerCase() < wnative.address.toLowerCase()) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(4500)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
        expect(wnativeBalanceAfter.sub(wnativeBalanceBefore)).to.be.eq(1)
      }
    })

    it('double the price - as native token', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(2, 1)
      )

      const tokenBalanceBefore = await token.balanceOf(accounts[0].address)

      await pair.approve(migrator.address, expectedLiquidity)
      await expect(
        migrator.migrate({
          pair: pair.address,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: token0.address,
          token1: token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(FeeAmount.MEDIUM),
          tickUpper: getMaxTick(FeeAmount.MEDIUM),
          amount0Min: 4500,
          amount1Min: 8999,
          recipient: accounts[0].address,
          deadline: 1,
          refundAsNative: true,
        })
      )
        .to.emit(wnative, 'Withdrawal')
        .withArgs(migrator.address, tokenLower ? 1 : 4500)

      const tokenBalanceAfter = await token.balanceOf(accounts[0].address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factory.getPool(token.address, wnative.address, FeeAmount.MEDIUM)
      if (tokenLower) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
      }
    })

    it('half the price - as native token', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 2)
      )

      const tokenBalanceBefore = await token.balanceOf(accounts[0].address)

      await pair.approve(migrator.address, expectedLiquidity)
      await expect(
        migrator.migrate({
          pair: pair.address,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: token0.address,
          token1: token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(FeeAmount.MEDIUM),
          tickUpper: getMaxTick(FeeAmount.MEDIUM),
          amount0Min: 8999,
          amount1Min: 4500,
          recipient: accounts[0].address,
          deadline: 1,
          refundAsNative: true,
        })
      )
        .to.emit(wnative, 'Withdrawal')
        .withArgs(migrator.address, tokenLower ? 4500 : 1)

      const tokenBalanceAfter = await token.balanceOf(accounts[0].address)

      const position = await nft.positions(1)
      expect(position.liquidity).to.be.eq(6363)

      const poolAddress = await factory.getPool(token.address, wnative.address, FeeAmount.MEDIUM)
      if (tokenLower) {
        expect(await token.balanceOf(poolAddress)).to.be.eq(8999)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(1)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(4500)
      } else {
        expect(await token.balanceOf(poolAddress)).to.be.eq(4500)
        expect(tokenBalanceAfter.sub(tokenBalanceBefore)).to.be.eq(4500)
        expect(await wnative.balanceOf(poolAddress)).to.be.eq(8999)
      }
    })

    it('gas', async () => {
      const [token0, token1] = sortedTokens(wnative, token)
      await migrator.createAndInitializePoolIfNecessary(
        token0.address,
        token1.address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )

      await pair.approve(migrator.address, expectedLiquidity)
      await snapshotGasCost(
        migrator.migrate({
          pair: pair.address,
          liquidityToMigrate: expectedLiquidity,
          percentageToMigrate: 100,
          token0: token0.address,
          token1: token1.address,
          fee: FeeAmount.MEDIUM,
          tickLower: getMinTick(FeeAmount.MEDIUM),
          tickUpper: getMaxTick(FeeAmount.MEDIUM),
          amount0Min: 9000,
          amount1Min: 9000,
          recipient: accounts[0].address,
          deadline: 1,
          refundAsNative: false,
        })
      )
    })
  })
})