import { useQuery } from '@tanstack/react-query'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import { useGaugesVotingContract } from 'hooks/useContract'
import { useMemo } from 'react'
import { isAddressEqual } from 'utils'
import { publicClient as getPublicClient } from 'utils/viem'
import { Hex, zeroAddress } from 'viem'
import { useVeCakeUserInfo } from 'views/CakeStaking/hooks/useVeCakeUserInfo'
import { CakePoolType } from 'views/CakeStaking/types'
import { useGauges } from './useGauges'

export type VoteSlope = {
  hash: string
  nativePower: number
  nativeSlope: number
  nativeEnd: number
  proxyPower: number
  proxySlope: number
  proxyEnd: number
}

export const useUserVoteSlopes = () => {
  const { data: gauges } = useGauges()
  const { data: userInfo, isLoading: isUserInfoLoading } = useVeCakeUserInfo()
  const gaugesVotingContract = useGaugesVotingContract()
  const { account, chainId } = useAccountActiveChain()
  const publicClient = useMemo(() => getPublicClient({ chainId }), [chainId])

  const { data, refetch, isLoading } = useQuery({
    queryKey: [
      '/vecake/user-vote-slopes',
      gaugesVotingContract.address,
      account,
      gauges?.length,
      userInfo?.cakePoolProxy,
      publicClient,
    ],
    queryFn: async (): Promise<VoteSlope[]> => {
      if (!gauges || gauges.length === 0 || !account || !publicClient) return []

      const delegated = userInfo?.cakePoolType === CakePoolType.DELEGATED

      const hasProxy =
        !delegated && userInfo && userInfo.cakePoolProxy && !isAddressEqual(userInfo.cakePoolProxy, zeroAddress)

      const contracts = gauges.map((gauge) => {
        return {
          address: gaugesVotingContract.address,
          abi: gaugesVotingContract.abi,
          functionName: 'voteUserSlopes',
          args: [account, gauge.hash as Hex],
        } as const
      })

      if (hasProxy) {
        gauges.forEach((gauge) => {
          contracts.push({
            address: gaugesVotingContract.address,
            abi: gaugesVotingContract.abi,
            functionName: 'voteUserSlopes',
            args: [userInfo.cakePoolProxy, gauge.hash as Hex],
          } as const)
        })
      }
      try {
        const response = await publicClient.multicall({
          contracts,
          allowFailure: false,
        })

        const len = gauges.length
        return gauges.map((gauge, index) => {
          const [nativeSlope, nativePower, nativeEnd] = response[index] ?? [0n, 0n, 0n]
          const [proxySlope, proxyPower, proxyEnd] = response[index + len] ?? [0n, 0n, 0n]

          return {
            hash: gauge.hash,
            nativePower: Number(nativePower),
            nativeSlope: Number(nativeSlope),
            nativeEnd: Number(nativeEnd),
            proxyPower: Number(proxyPower),
            proxySlope: Number(proxySlope),
            proxyEnd: Number(proxyEnd),
          }
        })
      } catch (error) {
        console.error('useUserVoteSlopes', error)
        return []
      }
    },
    enabled: Boolean(gauges?.length) && !isUserInfoLoading && account && account !== '0x',
  })

  return {
    data: useMemo(() => data || [], [data]),
    refetch,
    isLoading,
  }
}

export const useUserVoteGauges = () => {
  const { data: gauges, isLoading: isGaugesLoading } = useGauges()
  const { data: slopes, refetch, isLoading: isVoteLoading } = useUserVoteSlopes()

  const data = useMemo(() => {
    if (!gauges || !slopes) return []

    return gauges.filter((gauge) => {
      const slope = slopes.find((s) => s.hash === gauge.hash)

      const hasNativePower = typeof slope?.nativePower !== 'undefined' && slope.nativePower > 0
      const hasProxyPower = typeof slope?.proxyPower !== 'undefined' && slope.proxyPower > 0

      return hasNativePower || hasProxyPower
    })
  }, [gauges, slopes])

  return {
    data,
    refetch,
    isLoading: isGaugesLoading || isVoteLoading,
  }
}
