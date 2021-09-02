import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import { WNATIVE } from '@bitriel/bitrielswap-sdk'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers, deployments, getNamedAccounts, getChainId } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = ethers.BigNumber.from(await getChainId()).toNumber()

  if (chainId in WNATIVE) {
    const nft_descriptor = await deployments.get('NFTDescriptor');

    await deploy('NonfungibleTokenPositionDescriptor', {
      from: deployer,
      args: [WNATIVE[chainId].address],
      libraries: {
        NFTDescriptor: nft_descriptor.address
      },
      log: true,
      deterministicDeployment: false
    })
  }
}

deploy.tags = ['NFTPositionDescriptor']
deploy.dependencies = ['NFTDescriptor']
export default deploy