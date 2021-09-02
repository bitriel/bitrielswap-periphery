import { FACTORY_ADDRESS, WNATIVE } from "@bitriel/bitrielswap-sdk"
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { ethers, deployments, getNamedAccounts, getChainId } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const chainId = ethers.BigNumber.from(await getChainId()).toNumber()

  if (chainId in FACTORY_ADDRESS && chainId in WNATIVE) {
    await deploy('Quoter', {
      from: deployer,
      args: [FACTORY_ADDRESS[chainId], WNATIVE[chainId].address],
      log: true,
      deterministicDeployment: false
    })
  }
}

deploy.tags = ['Quoter']
export default deploy