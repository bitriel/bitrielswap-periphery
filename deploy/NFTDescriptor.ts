import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy('NFTDescriptor', {
    from: deployer,
    log: true,
    deterministicDeployment: false
  })
}

deploy.tags = ['NFTDescriptor']
export default deploy