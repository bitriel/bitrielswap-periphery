import { ethers } from "hardhat"
import { BigNumber, Contract } from "ethers"

export function encodeParams(types: readonly string[], values: readonly any[]): string {
  const abi = new ethers.utils.AbiCoder();
  return abi.encode(types, values)
}

export async function prepare(obj: any, contracts: readonly string[]) {
  for(let i in contracts) obj[contracts[i]] = await ethers.getContractFactory(contracts[i])
  obj.signers = await ethers.getSigners()
  obj.saing = obj.signers[0]
  obj.nath = obj.signers[1]
  obj.daveat = obj.signers[2]
  obj.piseth = obj.signers[3]
  obj.bonchay = obj.signers[4]
  obj.veasna = obj.signers[5]
  obj.leang = obj.signers[6]
}

export async function deploy(obj: any, contracts: Contract) {
  for (let i in contracts) {
    let contract = contracts[i]
    obj[contract[0]] = await contract[1].deploy(...(contract[2] || []))
    await obj[contract[0]].deployed()
  }
}

export function getBigNumber(amount: any, decimals: number = 18): BigNumber {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals))
}
