/* eslint-disable no-param-reassign */
import { ChainId } from '@pancakeswap/chains'
import { BinPoolManagerAbi, CLPoolManagerAbi, DYNAMIC_FEE_FLAG, findHook } from '@pancakeswap/infinity-sdk'
import { InfinityBinPool, InfinityClPool } from '@pancakeswap/smart-router'
import { fetchStableSwapData } from '@pancakeswap/stable-swap-sdk'
import { memoizeAsync } from '@pancakeswap/utils/memoize'
import BigNumber from 'bignumber.js'
import { fetchAllCampaignsByChainId } from 'hooks/infinity/useCampaigns'
import { getInfinityCakeAPR } from 'hooks/infinity/useInfinityCakeAPR'
import { getCakePriceFromOracle } from 'hooks/useCakePrice'
import groupBy from 'lodash/groupBy'
import { CakeAprValue } from 'state/farmsV4/atom'
import { getAllNetworkMerklApr, getCakeApr, getLpApr } from 'state/farmsV4/state/poolApr/fetcher'
import { PoolInfo } from 'state/farmsV4/state/type'
import { safeGetAddress } from 'utils'
import { getPoolManagerAddress } from 'utils/addressHelpers'
import { isInfinityProtocol } from 'utils/protocols'
import { ContractFunctionReturnType } from 'viem'
import { Address } from 'viem/accounts'
import { createBatchProcessor, multicallBatcher } from './batchProcessor'
import { FarmInfo, getFarmKey, isValidPoolKeyResult, parsePoolKeyResult, parseSlot0 } from './farm.util'

interface FillItem<T> {
  id: string
  value: T
}

const fetchAllCampaigns = memoizeAsync(
  async (chains: ChainId[]) => {
    const list = await Promise.all(
      chains.map((chainId) => {
        return fetchAllCampaignsByChainId({
          chainId: Number(chainId),
        })
      }),
    )
    return list.reduce((acc, campaigns, index) => {
      acc[chains[index]] = campaigns
      return acc
    }, {})
  },
  {
    resolver: (chains) => {
      return chains.sort().join(',')
    },
  },
)

const getCakePrice = memoizeAsync(async () => {
  return BigNumber(await getCakePriceFromOracle())
})

async function batchGetInfinityCakeApr(pools: PoolInfo[]) {
  const chains = Array.from(new Set(pools.map((pool) => Number(pool.farm!.chainId))))
  const [allCampaigns, cakePrice] = await Promise.all([fetchAllCampaigns(chains), getCakePrice()])
  const result: FillItem<CakeAprValue>[] = []
  for (const pool of pools) {
    const farm = pool.farm!
    const chainId = Number(farm.chainId)
    const campaigns = allCampaigns[chainId]

    const cakeApr = getInfinityCakeAPR({
      chainId: Number(farm.chainId),
      poolId: farm.id,
      cakePrice,
      campaigns,
      tvlUSD: `${farm.tvlUSD}`,
    })
    result.push({
      id: getFarmKey(farm),
      value: cakeApr,
    })
  }
  return result
}

async function batchGetOtherCakeApr(pools: PoolInfo[]) {
  const cakePrice = await getCakePrice()
  const aprs = await Promise.all(
    pools.map(async (pool) => {
      if (!pool.farm?.pid) {
        return {}
      }

      return getCakeApr(pool!, cakePrice)
    }),
  )
  return pools.map((pool, index) => {
    const farm = pool.farm!
    const result = aprs[index]
    const resultKey = Object.keys(result)[0]
    const apr = result[resultKey] as CakeAprValue
    return {
      id: getFarmKey(farm),
      value: apr,
    } as FillItem<CakeAprValue>
  })
}

export const batchGetCakeApr = createBatchProcessor<PoolInfo, FillItem<CakeAprValue>>({
  groupBy: (pools: PoolInfo[]) => {
    return groupBy(pools, (pool) => (isInfinityProtocol(pool.farm!.protocol) ? 'infinity' : 'other'))
  },
  groups: {
    infinity: batchGetInfinityCakeApr,
    other: batchGetOtherCakeApr,
  },
})

const cachedGetLpApr = memoizeAsync(getLpApr, {
  resolver: (params) => {
    return `${params.protocol}:${params.chainId}:${params.lpAddress}:${params.poolId}`
  },
})
export async function batchGetLpAprData(pools: PoolInfo[]) {
  const lpAprs = await Promise.allSettled(
    pools.map((pool) => {
      const farm = pool.farm!
      if (farm.protocol === 'stable') {
        return 0
      }

      return cachedGetLpApr(
        {
          protocol: farm.protocol,
          chainId: farm.chainId,
          lpAddress: farm.lpAddress,
          poolId: farm.id,
        },
        true,
      )
    }),
  )

  return pools.map((pool, index) => {
    const result = lpAprs[index]
    const farm = pool.farm!
    const apr = result.status === 'fulfilled' ? `${result.value}` : '0'
    return {
      id: getFarmKey(farm),
      value: Number(apr),
    }
  })
}

const cachedGetAllNetworkMerklApr = memoizeAsync(getAllNetworkMerklApr, {
  resolver: () => '',
})
export async function batchGetMerklAprData(pools: PoolInfo[]) {
  const aprs = await cachedGetAllNetworkMerklApr()
  return pools.map((pool) => {
    const farm = pool.farm!
    const key = `${farm.chainId}:${safeGetAddress(farm.id)}`
    const merklApr = aprs[key] || '0'
    return {
      id: getFarmKey(farm),
      value: merklApr,
    }
  })
}

type CLPoolCallsResult = [
  ContractFunctionReturnType<typeof CLPoolManagerAbi, 'view', 'poolIdToPoolKey'>,
  ContractFunctionReturnType<typeof CLPoolManagerAbi, 'view', 'getSlot0'>,
  ContractFunctionReturnType<typeof CLPoolManagerAbi, 'view', 'getLiquidity'>,
]

const resolveFarm = (farm: FarmInfo) => {
  return getFarmKey(farm)
}

export const fillClPoolData = memoizeAsync(
  async (farm: FarmInfo) => {
    const chainId = farm.chainId as ChainId
    const poolId = farm.id as Address
    const poolManagerAddress = getPoolManagerAddress('CL', chainId)
    const contracts = [
      {
        address: poolManagerAddress,
        functionName: 'poolIdToPoolKey',
        abi: CLPoolManagerAbi,
        args: [poolId],
      },
      {
        address: poolManagerAddress,
        functionName: 'getSlot0',
        abi: CLPoolManagerAbi,
        args: [poolId],
      },
      {
        address: poolManagerAddress,
        functionName: 'getLiquidity',
        abi: CLPoolManagerAbi,
        args: [poolId],
      },
    ]
    const results = await multicallBatcher.fetch({
      chainId,
      params: {
        contracts,
        allowFailure: false,
      },
    })

    const [poolKey, slot0, liquidity] = results as CLPoolCallsResult
    const pool = farm.pool as InfinityClPool
    const parsedPoolKey = parsePoolKeyResult('CL', poolKey)
    const hookData = findHook(parsedPoolKey.hooks as string, chainId)
    const slot0Info = parseSlot0('CL', slot0)
    const isDynamic = parsedPoolKey.fee === DYNAMIC_FEE_FLAG
    const fee = isDynamic && hookData?.defaultFee ? hookData?.defaultFee : pool.fee
    pool.fee = fee
    pool.protocolFee = slot0Info.protocolFee
    pool.liquidity = liquidity
    pool.hooks = parsedPoolKey.hooks
    // eslint-disable-next-line no-param-reassign
    farm.feeTier = pool.fee
    return farm
  },
  {
    resolver: resolveFarm,
  },
)

type BinPoolCallsResult = [
  ContractFunctionReturnType<typeof BinPoolManagerAbi, 'view', 'poolIdToPoolKey'>,
  ContractFunctionReturnType<typeof BinPoolManagerAbi, 'view', 'getSlot0'>,
]

export const fillBinPoolData = memoizeAsync(
  async (farm: FarmInfo) => {
    const chainId = farm.chainId as ChainId
    const poolId = farm.id as Address
    const poolManagerAddress = getPoolManagerAddress('Bin', chainId)
    const calls = [
      {
        address: poolManagerAddress,
        functionName: 'poolIdToPoolKey',
        abi: BinPoolManagerAbi,
        args: [poolId],
      },
      {
        address: poolManagerAddress,
        functionName: 'getSlot0',
        abi: BinPoolManagerAbi,
        args: [poolId],
      },
    ]
    const results = await multicallBatcher.fetch({
      chainId,
      params: {
        contracts: calls,
        allowFailure: false,
      },
    })

    const newFarm = farm
    const [poolKey, slot0] = results as BinPoolCallsResult
    const pool = farm.pool as InfinityBinPool

    if (!isValidPoolKeyResult(poolKey)) throw new Error('Invalid pool key result')

    const parsedPoolKey = parsePoolKeyResult('Bin', poolKey)
    const slot0Info = parseSlot0('Bin', slot0)
    const isDynamic = parsedPoolKey.fee === DYNAMIC_FEE_FLAG
    const hookData = findHook(parsedPoolKey.hooks as string, chainId)
    const fee = isDynamic && hookData?.defaultFee ? hookData?.defaultFee : pool.fee
    pool.fee = fee

    pool.fee = fee
    pool.hooks = parsedPoolKey.hooks
    newFarm.feeTier = pool.fee
    pool.protocolFee = slot0Info.protocolFee
    return newFarm
  },
  {
    resolver: resolveFarm,
  },
)

const fillStablePoolData = async (farm: FarmInfo) => {
  const stablePools = await fetchStableSwapData(farm.chainId)
  const relatedPool = stablePools.find((x) => x.stableSwapAddress.toLowerCase() === farm.id.toLowerCase())

  if (relatedPool) {
    farm.lpAddress = relatedPool.lpAddress
    farm.feeTier = relatedPool.stableTotalFee * 1_000_000
  }
  return farm
}

export const fillOnchainPoolData = memoizeAsync(
  async (farm: FarmInfo) => {
    if (farm.protocol === 'infinityCl') {
      return fillClPoolData(farm)
    }
    if (farm.protocol === 'infinityBin') {
      return fillBinPoolData(farm)
    }
    if (farm.protocol === 'stable') {
      return fillStablePoolData(farm)
    }
    return farm
  },
  {
    resolver: resolveFarm,
    isValid: () => true,
  },
)
