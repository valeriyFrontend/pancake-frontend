import { Protocol } from '@pancakeswap/farms'
import { Currency } from '@pancakeswap/sdk'
import { FeeAmount, Pool, TICK_SPACINGS, tickToPrice } from '@pancakeswap/v3-sdk'
import useAllTicksQuery, { TickData } from 'hooks/useAllTicksQuery'
import { useMemo } from 'react'

import { getActiveTick } from 'utils/getActiveTick'
import { PoolState, TickProcessed } from './types'
import { usePool } from './usePools'
import computeSurroundingTicks from './utils/computeSurroundingTicks'

const PRICE_FIXED_DIGITS = 8

function useTicksFromSubgraph(
  currencyA: Currency | undefined | null,
  currencyB: Currency | undefined | null,
  feeAmount: FeeAmount | undefined,
  activeTick: number | undefined,
  enabled = true,
) {
  const poolChainId = currencyA?.wrapped.chainId

  const poolAddress = useMemo(
    () =>
      currencyA && currencyB && feeAmount
        ? Pool.getAddress(currencyA.wrapped, currencyB.wrapped, feeAmount)
        : undefined,
    [currencyA, currencyB, feeAmount],
  )

  return useAllTicksQuery({
    chainId: poolChainId,
    poolAddress,
    interval: 30000,
    enabled,
    protocol: Protocol.V3,
    activeTick,
  })
}

// Fetches all ticks for a given pool
export function useAllV3Ticks({
  currencyA,
  currencyB,
  feeAmount,
  activeTick,
  enabled = true,
}: {
  currencyA?: Currency | null
  currencyB?: Currency | null
  feeAmount?: FeeAmount
  activeTick?: number
  enabled?: boolean
}): {
  isLoading: boolean
  error: unknown
  ticks: TickData[] | undefined
} {
  const subgraphTickData = useTicksFromSubgraph(currencyA, currencyB, feeAmount, activeTick, enabled)

  return {
    isLoading: subgraphTickData.isLoading,
    error: subgraphTickData.error,
    ticks: subgraphTickData.data,
  }
}

export function usePoolActiveLiquidity(
  currencyA: Currency | undefined,
  currencyB: Currency | undefined,
  feeAmount: FeeAmount | undefined,
): {
  isLoading: boolean
  error: any
  activeTick: number | undefined
  data: TickProcessed[] | undefined
} {
  const [poolState, pool] = usePool(currencyA, currencyB, feeAmount)
  // Find nearest valid tick for pool in case tick is not initialized.
  const activeTick = useMemo(
    () => (feeAmount ? getActiveTick(pool?.tickCurrent, TICK_SPACINGS[feeAmount]) : undefined),
    [pool, feeAmount],
  )
  const { isLoading, error, ticks } = useAllV3Ticks({ currencyA, currencyB, feeAmount, activeTick })
  const { data } = useActiveLiquidityByPool({
    currencyA,
    currencyB,
    tickSpacing: feeAmount ? TICK_SPACINGS[feeAmount] : undefined,
    pool,
    ticks,
  })
  return useMemo(() => {
    if (
      !currencyA ||
      !currencyB ||
      activeTick === undefined ||
      poolState !== PoolState.EXISTS ||
      !ticks ||
      ticks.length === 0 ||
      isLoading
    ) {
      return {
        isLoading: isLoading || poolState === PoolState.LOADING,
        error,
        activeTick,
        data: undefined,
      }
    }
    return {
      isLoading,
      error,
      activeTick,
      data,
    }
  }, [activeTick, currencyA, currencyB, data, error, isLoading, poolState, ticks])
}

export function useActiveLiquidityByPool({
  currencyA,
  currencyB,
  pool,
  ticks,
  tickSpacing,
}: {
  currencyA: Currency | undefined
  currencyB: Currency | undefined
  tickSpacing: number | undefined
  ticks: TickData[] | undefined
  pool: Pool | null
}): {
  data: TickProcessed[] | undefined
  activeTick: number | undefined
} {
  const activeTick = useMemo(() => getActiveTick(pool?.tickCurrent, tickSpacing), [pool, tickSpacing])
  return useMemo(() => {
    if (!currencyA || !currencyB || !ticks || !activeTick) {
      return {
        data: undefined,
        activeTick,
      }
    }

    const token0 = currencyA?.wrapped
    const token1 = currencyB?.wrapped

    // find where the active tick would be to partition the array
    // if the active tick is initialized, the pivot will be an element
    // if not, take the previous tick as pivot
    const pivot = ticks.findIndex(({ tick }) => Number(tick) > activeTick) - 1

    if (pivot < 0) {
      // consider setting a local error
      console.error('TickData pivot not found')
      return {
        data: undefined,
        activeTick,
      }
    }

    const activeTickProcessed: TickProcessed = {
      liquidityActive: BigInt(pool?.liquidity ?? 0),
      tick: activeTick,
      liquidityNet: Number(ticks[pivot].tick) === activeTick ? BigInt(ticks[pivot].liquidityNet) : 0n,
      price0: tickToPrice(token0, token1, activeTick).toFixed(PRICE_FIXED_DIGITS),
    }

    const subsequentTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, ticks, pivot, true)

    const previousTicks = computeSurroundingTicks(token0, token1, activeTickProcessed, ticks, pivot, false)

    const ticksProcessed = previousTicks.concat(activeTickProcessed).concat(subsequentTicks)

    return {
      data: ticksProcessed,
      activeTick,
    }
  }, [currencyA, currencyB, activeTick, pool, ticks])
}
