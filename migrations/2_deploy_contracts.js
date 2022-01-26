const { FACTORY_ADDRESS, WNATIVE, Tick } = require("@bitriel/bitrielswap-sdk");
const BitrielSwapRouter = artifacts.require("BitrielSwapRouter");
const Quoter = artifacts.require("Quoter");
const Multicall = artifacts.require("BitrielSwapInterfaceMulticall");
const NFTDescriptor = artifacts.require("NFTDescriptor");
const NFTPosDescriptor = artifacts.require("NonfungibleTokenPositionDescriptor");
const NFPositionManager = artifacts.require("NonfungiblePositionManager");
const TickLens = artifacts.require("TickLens");

const NET_TO_CHAIN_ID = new Map([
  ["selendraTestnet", 222],
  ["testnet", 97]
])

module.exports = async function (deployer, network) {
  if(NET_TO_CHAIN_ID.has(network)) {
    const chainId = NET_TO_CHAIN_ID.get(network);

    await deployer.deploy(NFTDescriptor);
    deployer.link(NFTDescriptor, NFTPosDescriptor);
    await deployer.deploy(NFTPosDescriptor, WNATIVE[chainId].address);
    const nft_pos_descriptor = await NFTPosDescriptor.deployed();
    await deployer.deploy(NFPositionManager, FACTORY_ADDRESS[chainId], WNATIVE[chainId].address, nft_pos_descriptor.address);
    await deployer.deploy(BitrielSwapRouter, FACTORY_ADDRESS[chainId], WNATIVE[chainId].address);
    await deployer.deploy(Quoter, FACTORY_ADDRESS[chainId], WNATIVE[chainId].address);
  }

  await deployer.deploy(Multicall);
  await deployer.deploy(TickLens);
};
