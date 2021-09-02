import { Fixture } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { constants, Contract } from 'ethers'
import WNATIVE from '../contracts/wnative.json'
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@bitriel/bitrielswap-core/build/contracts/BitrielFactory.json'
import { 
  abi as OLD_FACTORY_ABI, 
  bytecode as OLD_FACTORY_BYTECODE 
} from '@uniswap/v2-core/build/UniswapV2Factory.json'
import { 
  Iwnative,
  Erc20Mock,
  IBitrielFactory, 
  MockTimeSwapRouter,
  MockTimeNonfungiblePositionManager,
  NonfungibleTokenPositionDescriptor,
} from '../../types'

export const oldFactoryFixture: Fixture<{ oldFactory: Contract }> = async ([wallet]) => {
  const oldFactory = await waffle.deployContract(
    wallet,
    {
      bytecode: OLD_FACTORY_BYTECODE,
      abi: OLD_FACTORY_ABI,
    },
    [constants.AddressZero]
  )

  return { oldFactory }
}

const wnativeFixture: Fixture<{ wnative: Iwnative }> = async ([wallet]) => {
  const wnative = (await waffle.deployContract(wallet, {
    bytecode: WNATIVE.bytecode,
    abi: WNATIVE.abi,
  })) as Iwnative

  return { wnative }
}

const factoryFixture: Fixture<IBitrielFactory> = async ([wallet]) => {
  return (await waffle.deployContract(wallet, {
    bytecode: FACTORY_BYTECODE,
    abi: FACTORY_ABI,
  })) as IBitrielFactory
}

export const swapRouterFixture: Fixture<{
  wnative: Iwnative
  factory: IBitrielFactory
  router: MockTimeSwapRouter
}> = async ([wallet], provider) => {
  const { wnative } = await wnativeFixture([wallet], provider)
  const factory = await factoryFixture([wallet], provider)

  const router = (await (await ethers.getContractFactory('MockTimeSwapRouter')).deploy(
    factory.address,
    wnative.address
  )) as MockTimeSwapRouter

  return { factory, wnative, router }
}

export const completeFixture: Fixture<{
  wnative: Iwnative
  factory: IBitrielFactory
  router: MockTimeSwapRouter
  nft: MockTimeNonfungiblePositionManager
  tokens: [Erc20Mock, Erc20Mock, Erc20Mock]
}> = async ([wallet], provider) => {
  const { wnative, factory, router } = await swapRouterFixture([wallet], provider)

  const tokenFactory = await ethers.getContractFactory('ERC20Mock')
  const tokens: [Erc20Mock, Erc20Mock, Erc20Mock] = [
    (await tokenFactory.deploy("Token1", "TK1", constants.MaxUint256.div(2))) as Erc20Mock,
    (await tokenFactory.deploy("Token2", "TK2", constants.MaxUint256.div(2))) as Erc20Mock,
    (await tokenFactory.deploy("Token3", "TK3", constants.MaxUint256.div(2))) as Erc20Mock,
  ]

  const nftDescriptorLibraryFactory = await ethers.getContractFactory('NFTDescriptor')
  const nftDescriptorLibrary = await nftDescriptorLibraryFactory.deploy()
  const positionDescriptorFactory = await ethers.getContractFactory('NonfungibleTokenPositionDescriptor', {
    libraries: {
      NFTDescriptor: nftDescriptorLibrary.address,
    },
  })
  const nftDescriptor = (await positionDescriptorFactory.deploy(
    tokens[0].address
  )) as NonfungibleTokenPositionDescriptor

  const positionManagerFactory = await ethers.getContractFactory('MockTimeNonfungiblePositionManager')
  const nft = (await positionManagerFactory.deploy(
    factory.address,
    wnative.address,
    nftDescriptor.address
  )) as MockTimeNonfungiblePositionManager

  tokens.sort((a, b) => (a.address.toLowerCase() < b.address.toLowerCase() ? -1 : 1))

  return {
    wnative,
    factory,
    router,
    tokens,
    nft,
  }
}