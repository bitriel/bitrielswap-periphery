const { WNATIVE, FACTORY_ADDRESS } = require('@bitriel/bitrielswap-sdk');
const BitrielSwapRouter = artifacts.require("BitrielSwapRouter");
const Migrator = artifacts.require("Migrator");
const NFTDescriptor = artifacts.require("NFTDescriptor");
const NFTPositionDescriptor = artifacts.require("NonfungibleTokenPositionDescriptor");
const NFPositionManager = artifacts.require("NonfungiblePositionManager");

const Quoter = artifacts.require("lens/Quoter.sol");
const Ticklens = artifacts.require("lens/TickLens.sol");
const BitrielSwapInterfaceMulticall = artifacts.require("lens/BitrielSwapInterfaceMulticall.sol");

module.exports = async function (deployer) {
  const chainId = await web3.eth.getChainId()
  let factory
  let weth

  if (chainId in FACTORY_ADDRESS && chainId in WNATIVE) {
    weth = WNATIVE[chainId].address;
    factory = FACTORY_ADDRESS[chainId];
  } else {
    throw Error("No WNATIVE!");
  }

  await Promise.all([
    deployer.deploy(BitrielSwapInterfaceMulticall),
    deployer.deploy(Ticklens),
    deployer.deploy(Quoter, factory, weth),
    deployer.deploy(BitrielSwapRouter, factory, weth),
  ]);

  await deployer.deploy(NFTDescriptor);
  await deployer.link(NFTDescriptor, NFTPositionDescriptor);
  await deployer.deploy(NFTPositionDescriptor, weth);
  const nftPositionDesc = await NFTPositionDescriptor.deployed();
  await deployer.deploy(NFPositionManager, factory, weth, nftPositionDesc.address);
  const nftPosManager = await NFPositionManager.deployed();
  await deployer.deploy(Migrator, factory, weth, nftPosManager.address);
};
