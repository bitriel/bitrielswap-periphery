import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { ChainId, WNATIVE, FACTORY_ADDRESS } from '@bitriel/bitrielswap-sdk'

const OLD_FACTORY_MAP: {[chainId in ChainId | number]: string} = {
  [ChainId.MAINNET]: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  [ChainId.BSC]: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
  [ChainId.BSC_TESTNET]: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4"
}

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers, deployments, getNamedAccounts, getChainId } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = ethers.BigNumber.from(await getChainId()).toNumber()

  if (chainId in WNATIVE && chainId in FACTORY_ADDRESS && chainId in OLD_FACTORY_MAP) {
    const nft_position_manager = await deployments.get('NonfungiblePositionManager');

    await deploy('Migrator', {
      from: deployer,
      args: [
        OLD_FACTORY_MAP[chainId], 
        FACTORY_ADDRESS[chainId], 
        WNATIVE[chainId].address, 
        nft_position_manager.address,
        "12100000"
      ],
      log: true,
      deterministicDeployment: false
    })
  }
}

deploy.tags = ['Migrator']
deploy.dependencies = ['NFPositionManager']
export default deploy