import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { WNATIVE, FACTORY_ADDRESS } from '@bitriel/bitrielswap-sdk'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers, deployments, getNamedAccounts, getChainId } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = ethers.BigNumber.from(await getChainId()).toNumber()

  if (chainId in WNATIVE && chainId in FACTORY_ADDRESS) {
    const nft_pos_descriptor = await deployments.get('NonfungibleTokenPositionDescriptor');

    await deploy('NonfungiblePositionManager', {
      from: deployer,
      args: [FACTORY_ADDRESS[chainId], WNATIVE[chainId].address, nft_pos_descriptor.address],
      log: true,
      deterministicDeployment: false
    })
  }
}

deploy.tags = ['NFPositionManager']
deploy.dependencies = ['NFTPositionDescriptor']
export default deploy