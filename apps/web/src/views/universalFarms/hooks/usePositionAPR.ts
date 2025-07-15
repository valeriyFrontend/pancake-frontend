import { Protocol } from '@pancakeswap/farms'
import { BinLiquidityShape } from '@pancakeswap/infinity-sdk'
import { Currency, CurrencyAmount } from '@pancakeswap/swap-sdk-core'
import { BIG_ONE, BIG_ZERO } from '@pancakeswap/utils/bigNumber'
import { formatPercent } from '@pancakeswap/utils/formatFractions'
import {
  encodeSqrtRatioX96,
  FeeAmount,
  FeeCalculator,
  getPriceOfCurrency,
  isPoolTickInRange,
  maxLiquidityForAmount0Precise,
  maxLiquidityForAmount1,
  parseProtocolFees,
  TickMath,
} from '@pancakeswap/v3-sdk'
import { useAmountsByUsdValue, useRoi } from '@pancakeswap/widgets-internal/roi'
import BN from 'bignumber.js'
import { useCLPriceRange } from 'hooks/infinity/useCLPriceRange'
import { useCurrencyByPoolId } from 'hooks/infinity/useCurrencyByPoolId'
import { useInfinityBinPositionCakeAPR, useInfinityCLPositionCakeAPR } from 'hooks/infinity/useInfinityCakeAPR'
import { useCakePrice } from 'hooks/useCakePrice'
import { useCurrencyUsdPrice } from 'hooks/useCurrencyUsdPrice'
import useV3DerivedInfo from 'hooks/v3/useV3DerivedInfo'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { CakeApr } from 'state/farmsV4/atom'
import {
  useAccountPositionDetailByPool,
  useExtraInfinityPositionInfo,
  useExtraV3PositionInfo,
  usePoolApr,
} from 'state/farmsV4/hooks'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  POSITION_STATUS,
  PositionDetail,
  StableLPDetail,
  V2LPDetail,
} from 'state/farmsV4/state/accountPositions/type'
import {
  ChainIdAddressKey,
  InfinityBinPoolInfo,
  InfinityCLPoolInfo,
  InfinityPoolInfo,
  PoolInfo,
} from 'state/farmsV4/state/type'
import { useBinRangeQueryState, useClRangeQueryState, useLiquidityShapeQueryState } from 'state/infinity/shared'
import {
  lastEditAtom,
  useAddDepositAmounts,
  useClDepositAmounts,
} from 'views/AddLiquidityInfinity/hooks/useAddDepositAmounts'
import { usePool } from 'views/AddLiquidityInfinity/hooks/usePool'
import { useV3FormState } from 'views/AddLiquidityV3/formViews/V3FormView/form/reducer'
import { useLmPoolLiquidity } from 'views/Farms/hooks/useLmPoolLiquidity'
import { useAccount } from 'wagmi'
import { getActiveLiquidityFromShape } from '../utils/getActiveLiquidityFromShape'
import { useBinAmountsFromUsdValue } from './useBinAmountsFromUsdValue'

const V3_LP_FEE_RATE = {
  [FeeAmount.LOWEST]: 0.67,
  [FeeAmount.LOW]: 0.66,
  [FeeAmount.MEDIUM]: 0.68,
  [FeeAmount.HIGH]: 0.68,
}

export const useV2PositionApr = (pool: PoolInfo, userPosition: StableLPDetail | V2LPDetail) => {
  const key = useMemo(() => `${pool?.chainId}:${pool?.lpAddress}` as const, [pool?.chainId, pool?.lpAddress])
  const { lpApr: globalLpApr, cakeApr: globalCakeApr, merklApr } = usePoolApr(key, pool)
  const numerator = useMemo(() => {
    const lpAprNumerator = new BN(globalLpApr).times(globalCakeApr?.userTvlUsd ?? BIG_ZERO)
    const othersNumerator = new BN(globalCakeApr?.value ?? 0)
      .times(userPosition.farmingBoosterMultiplier)
      .plus(merklApr)
      .times(globalCakeApr?.userTvlUsd ?? BIG_ZERO)
    return userPosition.isStaked ? lpAprNumerator.plus(othersNumerator) : lpAprNumerator
  }, [
    globalCakeApr?.userTvlUsd,
    globalCakeApr?.value,
    globalLpApr,
    userPosition.farmingBoosterMultiplier,
    userPosition.isStaked,
    merklApr,
  ])

  const denominator = useMemo(() => {
    return globalCakeApr?.userTvlUsd ?? BIG_ZERO
  }, [globalCakeApr?.userTvlUsd])

  return {
    lpApr: parseFloat(globalLpApr) ?? 0,
    numerator,
    denominator,
    cakeApr: {
      ...globalCakeApr,
      value: String(parseFloat(globalCakeApr?.value) * userPosition.farmingBoosterMultiplier) as `${number}`,
    },
    merklApr: parseFloat(merklApr ?? 0) ?? 0,
  }
}

export const useV3PositionApr = (pool: PoolInfo, userPosition: PositionDetail) => {
  const key = useMemo(() => `${pool.chainId}:${pool.lpAddress}` as const, [pool.chainId, pool.lpAddress])
  const { removed, outOfRange, position } = useExtraV3PositionInfo(userPosition)
  const { cakeApr: globalCakeApr, merklApr: merklApr_ } = usePoolApr(key, pool)
  const { data: token0UsdPrice_ } = useCurrencyUsdPrice(pool.token0)
  const { data: token1UsdPrice_ } = useCurrencyUsdPrice(pool.token1)

  const [token0UsdPrice, token1UsdPrice] = useMemo(() => {
    if (token0UsdPrice_ && token1UsdPrice_) return [token0UsdPrice_, token1UsdPrice_]
    if (token0UsdPrice_ && !token1UsdPrice_)
      return [token0UsdPrice_, parseFloat(pool?.token0Price ?? '0') * token0UsdPrice_]
    if (!token0UsdPrice_ && token1UsdPrice_)
      return [parseFloat(pool?.token1Price ?? '0') * token1UsdPrice_, token1UsdPrice_]
    return [token0UsdPrice_, token1UsdPrice_]
  }, [pool?.token0Price, pool?.token1Price, token0UsdPrice_, token1UsdPrice_])

  const cakePrice = useCakePrice()

  const userTVLUsd = useMemo(() => {
    return position?.amount0 && position?.amount1 && token0UsdPrice && token1UsdPrice
      ? new BN(position.amount0.toExact())
          .times(token0UsdPrice)
          .plus(new BN(position.amount1.toExact()).times(token1UsdPrice))
      : BIG_ZERO
  }, [position?.amount0, position?.amount1, token0UsdPrice, token1UsdPrice])

  const cakeApr = useMemo(() => {
    if (outOfRange || removed || globalCakeApr.poolWeight?.isZero()) {
      return {
        ...globalCakeApr,
        value: '0' as const,
      }
    }

    if (userPosition.isStaked) {
      const apr = !userTVLUsd.isZero()
        ? new BN(globalCakeApr.cakePerYear ?? 0)
            .times(globalCakeApr.poolWeight ?? 0)
            .times(cakePrice)
            .times(new BN(userPosition.farmingLiquidity.toString()).dividedBy(pool?.liquidity?.toString() ?? 1))
            .div(userTVLUsd)
            .times(userPosition.farmingMultiplier)
        : BIG_ZERO

      return {
        ...globalCakeApr,
        value: apr.toString() as `${number}`,
      }
    }

    const baseApr = !userTVLUsd.isZero()
      ? new BN(globalCakeApr.cakePerYear ?? 0)
          .times(globalCakeApr.poolWeight ?? 0)
          .times(cakePrice)
          .times(new BN(userPosition.liquidity.toString()).dividedBy(pool?.liquidity?.toString() ?? 1))
          .div(userTVLUsd)
      : BIG_ZERO

    return {
      ...globalCakeApr,
      value: baseApr.toString() as `${number}`,
    }
  }, [
    outOfRange,
    removed,
    globalCakeApr,
    userPosition.isStaked,
    userPosition.liquidity,
    userPosition.farmingLiquidity,
    userPosition.farmingMultiplier,
    cakePrice,
    pool.liquidity,
    userTVLUsd,
  ])

  const lpApr = useMemo(() => {
    if (outOfRange || removed || userTVLUsd.isZero()) return 0
    const apr = new BN(pool.fee24hUsd ?? 0)
      .times(365)
      .times(V3_LP_FEE_RATE[pool.feeTier] ?? 1)
      .times(new BN(userPosition.liquidity.toString()).dividedBy(pool.liquidity?.toString() ?? 1))
      .div(userTVLUsd)
      .toNumber()
    return apr
  }, [outOfRange, pool.fee24hUsd, pool.feeTier, pool.liquidity, removed, userPosition.liquidity, userTVLUsd])
  const merklApr = outOfRange ? 0 : parseFloat(merklApr_ ?? 0) ?? 0

  const numerator = useMemo(() => {
    if (outOfRange || removed) return BIG_ZERO
    return BN(lpApr)
      .plus(cakeApr.value ?? BIG_ZERO)
      .plus(parseFloat(cakeApr.value) > 0 ? merklApr : 0)
      .times(userTVLUsd)
  }, [cakeApr.value, lpApr, merklApr, outOfRange, removed, userTVLUsd])
  const denominator = userTVLUsd

  return {
    denominator,
    numerator,
    lpApr,
    cakeApr,
    merklApr,
  }
}

const usePositionTVLUsd = ({
  token0UsdPrice,
  token1UsdPrice,
  token0Price,
  token1Price,
  amount0,
  amount1,
}: {
  token0UsdPrice: number | undefined
  token1UsdPrice: number | undefined
  token0Price: `${number}` | undefined
  token1Price: `${number}` | undefined
  amount0: CurrencyAmount<Currency> | undefined
  amount1: CurrencyAmount<Currency> | undefined
}) => {
  const [token0Usd, token1Usd] = useMemo(() => {
    if (token0UsdPrice && token1UsdPrice) return [token0UsdPrice, token1UsdPrice]
    if (token0UsdPrice && !token1UsdPrice) return [token0UsdPrice, parseFloat(token0Price ?? '0') * token0UsdPrice]
    if (!token0UsdPrice && token1UsdPrice) return [parseFloat(token1Price ?? '0') * token1UsdPrice, token1UsdPrice]
    return [token0UsdPrice, token1UsdPrice]
  }, [token0Price, token1Price, token0UsdPrice, token1UsdPrice])

  return useMemo(() => {
    return amount0 && amount1 && token0Usd && token1Usd
      ? new BN(amount0.toExact()).times(token0Usd).plus(new BN(amount1.toExact()).times(token1Usd))
      : BIG_ZERO
  }, [amount0, amount1, token0Usd, token1Usd])
}

export const useInfinityCLPositionApr = (pool: InfinityPoolInfo, position: InfinityCLPositionDetail) => {
  const { removed, outOfRange, amount0, amount1, pool: onChainPoolInfo } = useExtraInfinityPositionInfo(position)
  const { data: token0UsdPrice } = useCurrencyUsdPrice(pool.token0)
  const { data: token1UsdPrice } = useCurrencyUsdPrice(pool.token1)
  const cakePrice = useCakePrice()
  const TVLUsd = usePositionTVLUsd({
    token0UsdPrice,
    token1UsdPrice,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    amount0,
    amount1,
  })
  const poolWithOnChainLiquidity = useMemo(() => {
    if (!onChainPoolInfo) return pool
    return {
      ...pool,
      // @notice: backend returns liquidity not 100% on time
      // it will cause the derived apr not same as the position apr after created
      liquidity: onChainPoolInfo.liquidity ?? pool.liquidity,
    }
  }, [onChainPoolInfo, pool])
  const cakeApr = useInfinityCLPositionCakeAPR({ pool: poolWithOnChainLiquidity, position, cakePrice, tvlUSD: TVLUsd })
  return useInfinityPositionApr({
    pool: poolWithOnChainLiquidity,
    position,
    positionLiquidity: position.liquidity,
    removed,
    outOfRange,
    cakeApr,
    userTVLUsd: TVLUsd,
  })
}

export const useInfinityBinPositionApr = (pool: InfinityPoolInfo, position: InfinityBinPositionDetail) => {
  const [currency0, currency1] = useMemo(() => {
    if (!pool) return [undefined, undefined]
    return [pool.token0, pool.token1]
  }, [pool])

  const amount0 = useMemo(
    () => (currency0 ? CurrencyAmount.fromRawAmount(currency0, position?.reserveX ?? 0n) : undefined),
    [currency0, position],
  )
  const amount1 = useMemo(
    () => (currency1 ? CurrencyAmount.fromRawAmount(currency1, position?.reserveY ?? 0n) : undefined),
    [currency1, position],
  )
  const { data: token0UsdPrice } = useCurrencyUsdPrice(pool.token0)
  const { data: token1UsdPrice } = useCurrencyUsdPrice(pool.token1)
  const cakePrice = useCakePrice()
  const poolTVLUsd = usePositionTVLUsd({
    token0UsdPrice,
    token1UsdPrice,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    amount0,
    amount1,
  })

  const cakeApr = useInfinityBinPositionCakeAPR({ pool, position, cakePrice, tvlUSD: poolTVLUsd })

  return useInfinityPositionApr({
    pool,
    position,
    positionLiquidity: position.activeLiquidity,
    removed: position.status === POSITION_STATUS.CLOSED,
    outOfRange: position.status === POSITION_STATUS.INACTIVE,
    cakeApr,
    userTVLUsd: poolTVLUsd,
  })
}

export type InfinityPositionAPR = {
  denominator: BN
  numerator: BN
  lpApr: `${number}`
  cakeApr: CakeApr[ChainIdAddressKey]
  merklApr: number
}

export const useInfinityPositionApr = <T extends InfinityCLPositionDetail | InfinityBinPositionDetail>({
  pool,
  position,
  positionLiquidity,
  removed,
  outOfRange,
  cakeApr,
  userTVLUsd: userTVLUsd_,
}: {
  pool: InfinityPoolInfo
  position: T
  positionLiquidity: bigint
  removed: boolean
  outOfRange: boolean
  cakeApr: CakeApr[ChainIdAddressKey]
  userTVLUsd: BN
}): InfinityPositionAPR => {
  const share = useMemo(
    () => new BN(positionLiquidity.toString()).dividedBy(pool?.liquidity?.toString() ?? 1),
    [pool?.liquidity, positionLiquidity],
  )

  const userTVLUsd = useMemo(() => {
    if (userTVLUsd_.isZero()) {
      return share.times(pool.tvlUsd ?? 0)
    }
    return userTVLUsd_
  }, [userTVLUsd_, share, pool.tvlUsd])

  const lpApr = useMemo(() => {
    if (outOfRange || removed) return `0`
    if (userTVLUsd.isZero()) {
      return `0`
    }
    const apr = new BN(pool.lpFee24hUsd ?? 0).times(365).times(share).div(userTVLUsd).toString()
    return apr as `${number}`
  }, [userTVLUsd, outOfRange, pool.lpFee24hUsd, removed, share])

  const merklApr = 0

  const numerator = useMemo(() => {
    if (outOfRange || removed) return BIG_ZERO
    return BN(lpApr)
      .plus(position.isStaked ? cakeApr.value : BIG_ZERO)
      .times(userTVLUsd)
  }, [cakeApr, lpApr, outOfRange, removed, position.isStaked, userTVLUsd])
  const denominator = userTVLUsd

  return {
    denominator,
    numerator,
    lpApr,
    cakeApr: outOfRange || removed ? { ...cakeApr, value: '0' } : cakeApr,
    merklApr,
  }
}

export const useV3FormDerivedApr = (pool: PoolInfo, inverted?: boolean) => {
  const key = useMemo(() => `${pool.chainId}:${pool.lpAddress}` as const, [pool.chainId, pool.lpAddress])
  const formState = useV3FormState()
  // const { data: estimateUserMultiplier } = useEstimateUserMultiplier(pool.chainId, userPosition.tokenId)
  // const { removed, outOfRange, position } = useExtraV3PositionInfo(userPosition)

  const [token0, token1] = useMemo(() => {
    if (inverted) {
      return [pool.token1, pool.token0]
    }
    return [pool.token0, pool.token1]
  }, [pool, inverted])

  const { cakeApr: globalCakeApr, merklApr } = usePoolApr(key, pool)
  const lmPoolLiquidity = useLmPoolLiquidity(pool.lpAddress, pool.chainId)
  const { data: token0UsdPrice } = useCurrencyUsdPrice(token0)
  const { data: token1UsdPrice } = useCurrencyUsdPrice(token1)
  const {
    pool: _pool,
    ticks,
    price,
    pricesAtTicks,
    parsedAmounts,
  } = useV3DerivedInfo(token0, token1, pool.feeTier, token0, undefined, formState)
  const sqrtRatioX96 = useMemo(() => price && encodeSqrtRatioX96(price.numerator, price.denominator), [price])

  const { amountA: aprAmountA, amountB: aprAmountB } = useAmountsByUsdValue({
    usdValue: '1',
    currencyA: token0,
    currencyB: token1,
    price,
    priceLower: pricesAtTicks.LOWER,
    priceUpper: pricesAtTicks.UPPER,
    sqrtRatioX96,
    currencyAUsdPrice: token0UsdPrice,
    currencyBUsdPrice: token1UsdPrice,
  })
  const amountA = useMemo(() => {
    return parsedAmounts.CURRENCY_A || aprAmountA
  }, [aprAmountA, parsedAmounts.CURRENCY_A])
  const amountB = useMemo(() => {
    return parsedAmounts.CURRENCY_B || aprAmountB
  }, [aprAmountB, parsedAmounts.CURRENCY_B])
  const liquidity = useMemo(() => {
    if (!amountA || !amountB || !sqrtRatioX96 || typeof ticks.LOWER !== 'number' || typeof ticks.UPPER !== 'number')
      return 0n
    const amount0 = amountA.toExact()
    const amount1 = amountB.toExact()
    if (!amount0 || !amount1) return 0n

    return (
      FeeCalculator.getLiquidityByAmountsAndPrice({
        amountA,
        amountB,
        tickLower: ticks.LOWER,
        tickUpper: ticks.UPPER,
        sqrtRatioX96,
      }) ?? 0n
    )
  }, [amountA, amountB, sqrtRatioX96, ticks.LOWER, ticks.UPPER])

  const inRange = useMemo(() => isPoolTickInRange(_pool, ticks.LOWER, ticks.UPPER), [_pool, ticks.LOWER, ticks.UPPER])

  const cakePrice = useCakePrice()

  const userTVLUsd = useMemo(() => {
    return parsedAmounts.CURRENCY_A && parsedAmounts.CURRENCY_B && token0UsdPrice && token1UsdPrice
      ? new BN(parsedAmounts.CURRENCY_A.toExact())
          .times(token0UsdPrice)
          .plus(new BN(parsedAmounts.CURRENCY_B.toExact()).times(token1UsdPrice))
      : BIG_ONE
  }, [parsedAmounts.CURRENCY_A, parsedAmounts.CURRENCY_B, token0UsdPrice, token1UsdPrice])

  const cakeApr = useMemo(() => {
    if (!inRange) {
      return {
        ...globalCakeApr,
        value: '0' as const,
      }
    }

    const baseApr = lmPoolLiquidity
      ? new BN(globalCakeApr.cakePerYear ?? 0)
          .times(globalCakeApr.poolWeight ?? 0)
          .times(cakePrice)
          .times(new BN(liquidity.toString()).dividedBy(lmPoolLiquidity?.toString() ?? 1))
          .div(userTVLUsd)
      : BIG_ZERO
    // const apr = baseApr.times(estimateUserMultiplier ?? 0)

    return {
      ...globalCakeApr,
      value: baseApr.toString() as `${number}`,
    }
  }, [inRange, globalCakeApr, cakePrice, liquidity, lmPoolLiquidity, userTVLUsd])

  const [protocolFee] = useMemo(
    () => (_pool?.feeProtocol && parseProtocolFees(_pool.feeProtocol)) || [],
    [_pool?.feeProtocol],
  )

  const { apr } = useRoi({
    amountA,
    amountB,
    currencyAUsdPrice: token0UsdPrice,
    currencyBUsdPrice: token1UsdPrice,
    tickLower: ticks?.LOWER,
    tickUpper: ticks?.UPPER,
    volume24H: pool?.vol24hUsd && parseFloat(pool?.vol24hUsd),
    sqrtRatioX96,
    mostActiveLiquidity: _pool?.liquidity,
    fee: pool?.feeTier,
    protocolFee,
  })

  return {
    lpApr: parseFloat(`${formatPercent(apr, 5) || '0'}`) / 100,
    cakeApr,
    merklApr: inRange ? parseFloat(merklApr ?? 0) ?? 0 : 0,
  }
}

export const useInfinityCLDerivedApr = (poolInfo: InfinityCLPoolInfo) => {
  const key = useMemo(
    () => `${poolInfo.chainId}:${poolInfo.lpAddress}` as const,
    [poolInfo.chainId, poolInfo.lpAddress],
  )
  const { currency0, currency1 } = useCurrencyByPoolId({ poolId: poolInfo.poolId, chainId: poolInfo.chainId })

  const { cakeApr: globalCakeApr, merklApr, lpApr: globalLpApr } = usePoolApr(key, poolInfo)
  const { data: token0UsdPrice } = useCurrencyUsdPrice(currency0)
  const { data: token1UsdPrice } = useCurrencyUsdPrice(currency1)

  const pool = usePool<'CL'>()
  const sqrtRatioX96 = pool?.sqrtRatioX96
  const price = useMemo(
    () =>
      sqrtRatioX96 && currency0 && currency1
        ? getPriceOfCurrency(
            {
              currency0,
              currency1,
              sqrtRatioX96,
            },
            currency0,
          )
        : undefined,
    [sqrtRatioX96, currency0, currency1],
  )

  const { lowerPrice, upperPrice } = useCLPriceRange(currency0, currency1, pool?.tickSpacing ?? undefined)

  const { amountA: aprAmountA, amountB: aprAmountB } = useAmountsByUsdValue({
    usdValue: '1',
    currencyA: currency0,
    currencyB: currency1,
    price,
    priceLower: lowerPrice,
    priceUpper: upperPrice,
    sqrtRatioX96,
    currencyAUsdPrice: token0UsdPrice,
    currencyBUsdPrice: token1UsdPrice,
  })
  const lastEdit = useAtomValue(lastEditAtom)
  const { depositCurrencyAmount0, depositCurrencyAmount1 } = useClDepositAmounts()
  const amountA = useMemo(() => {
    return depositCurrencyAmount0 || aprAmountA
  }, [aprAmountA, depositCurrencyAmount0])
  const amountB = useMemo(() => {
    return depositCurrencyAmount1 || aprAmountB
  }, [aprAmountB, depositCurrencyAmount1])

  const [{ lowerTick, upperTick }] = useClRangeQueryState()

  const liquidity = useMemo(() => {
    if (!amountA || !amountB || !sqrtRatioX96 || typeof lowerTick !== 'number' || typeof upperTick !== 'number')
      return 0n
    const amount0 = amountA.toExact()
    const amount1 = amountB.toExact()
    if (!amount0 || !amount1) return 0n

    const getLiquidity = lastEdit.lastEditCurrency === 0 ? maxLiquidityForAmount0Precise : maxLiquidityForAmount1
    const liquidityFromAmount = lastEdit.lastEditCurrency === 0 ? amountA : amountB

    return getLiquidity(
      sqrtRatioX96,
      lastEdit.lastEditCurrency === 0 ? TickMath.getSqrtRatioAtTick(upperTick) : TickMath.getSqrtRatioAtTick(lowerTick),
      liquidityFromAmount.quotient,
    )
  }, [amountA, amountB, sqrtRatioX96, lowerTick, upperTick, lastEdit.lastEditCurrency])

  const inRange = useMemo(() => {
    if (!pool) return false
    const below = typeof lowerTick === 'number' ? pool.tickCurrent < lowerTick : undefined
    const above = typeof upperTick === 'number' ? pool.tickCurrent >= upperTick : undefined
    return typeof below === 'boolean' && typeof above === 'boolean' ? !below && !above : false
  }, [pool, lowerTick, upperTick])

  const cakePrice = useCakePrice()

  const userTVLUsd = usePositionTVLUsd({
    token0UsdPrice,
    token1UsdPrice,
    token0Price: poolInfo.token0Price,
    token1Price: poolInfo.token1Price,
    amount0: amountA,
    amount1: amountB,
  })

  const share = useMemo(() => {
    const lqBN = new BN(liquidity.toString())
    const poolLqBN = new BN(pool?.liquidity?.toString() ?? 0)
    const baseLqBN = lqBN.plus(poolLqBN).isGreaterThan(0) ? lqBN.plus(poolLqBN) : 1
    return lqBN.dividedBy(baseLqBN)
  }, [liquidity, pool?.liquidity])

  const cakeApr = useMemo(() => {
    if (!inRange || userTVLUsd.isZero()) {
      return {
        ...globalCakeApr,
        value: '0' as const,
      }
    }

    const baseApr = userTVLUsd.isZero()
      ? BIG_ZERO
      : new BN(globalCakeApr.cakePerYear ?? 0)
          .times(globalCakeApr.poolWeight ?? 0)
          .times(cakePrice)
          .times(share)
          .div(userTVLUsd)

    return {
      ...globalCakeApr,
      value: baseApr.toString() as `${number}`,
    }
  }, [inRange, globalCakeApr, cakePrice, userTVLUsd, share])

  const lpApr = useMemo(() => {
    if (!inRange || !userTVLUsd) return globalLpApr

    const apr = new BN(poolInfo?.lpFee24hUsd ?? 0).times(365).times(share).div(userTVLUsd).toString()

    return apr as `${number}`
  }, [inRange, userTVLUsd, globalLpApr, poolInfo?.lpFee24hUsd, share])

  return {
    lpApr: parseFloat((liquidity === 0n ? globalLpApr : lpApr) ?? 0),
    cakeApr,
    merklApr: inRange ? parseFloat(merklApr ?? 0) ?? 0 : 0,
  }
}

export const useInfinityBinDerivedApr = (poolInfo: InfinityBinPoolInfo) => {
  const key = useMemo(
    () => `${poolInfo.chainId}:${poolInfo.lpAddress}` as const,
    [poolInfo.chainId, poolInfo.lpAddress],
  )
  const { currency0, currency1 } = useCurrencyByPoolId({
    poolId: poolInfo.poolId,
    chainId: poolInfo.chainId,
  })
  const { cakeApr: globalCakeApr, merklApr } = usePoolApr(key, poolInfo)
  const { data: token0UsdPrice } = useCurrencyUsdPrice(currency0)
  const { data: token1UsdPrice } = useCurrencyUsdPrice(currency1)
  const pool = usePool<'Bin'>()
  const poolLiquidity = poolInfo.liquidity
  const { address: account } = useAccount()
  const { data: existingPosition } = useAccountPositionDetailByPool<Protocol.InfinityBIN>(
    poolInfo.chainId,
    account,
    poolInfo,
  )
  // const poolLiquidity = useBinPoolLiquidity({ poolId: poolInfo.poolId, chainId: poolInfo.chainId })

  const [{ lowerBinId, upperBinId }] = useBinRangeQueryState()
  const { depositCurrencyAmount0, depositCurrencyAmount1 } = useAddDepositAmounts()

  const [aprAmountA, aprAmountB] = useBinAmountsFromUsdValue({
    usdValue: '10',
    currency0,
    currency1,
    currency0UsdPrice: token0UsdPrice,
    currency1UsdPrice: token1UsdPrice,
  })

  const amountA = useMemo(() => {
    return depositCurrencyAmount0 || aprAmountA || undefined
  }, [aprAmountA, depositCurrencyAmount0])
  const amountB = useMemo(() => {
    return depositCurrencyAmount1 || aprAmountB || undefined
  }, [aprAmountB, depositCurrencyAmount1])

  const [liquidityShape] = useLiquidityShapeQueryState()

  const liquidity = useMemo(() => {
    if (!lowerBinId || !upperBinId || !pool?.binStep) return new BN(0)

    const l = getActiveLiquidityFromShape({
      liquidityShape: liquidityShape as BinLiquidityShape,
      lowerBinId,
      upperBinId,
      binStep: pool?.binStep,
      amount0: amountA?.quotient ?? 0n,
      amount1: amountB?.quotient ?? 0n,
      activeBinId: pool?.activeId,
    })

    return l
  }, [amountA, amountB, lowerBinId, upperBinId, pool?.binStep, pool?.activeId, liquidityShape])

  const inRange = useMemo(() => {
    if (!pool || !lowerBinId || !upperBinId) return false
    return pool.activeId >= lowerBinId && pool.activeId <= upperBinId
  }, [pool, lowerBinId, upperBinId])

  const cakePrice = useCakePrice()

  const derivedUserTVLUsd = usePositionTVLUsd({
    token0UsdPrice,
    token1UsdPrice,
    token0Price: poolInfo.token0Price,
    token1Price: poolInfo.token1Price,
    amount0: amountA ?? undefined,
    amount1: amountB ?? undefined,
  })

  const existingPositionTvlUsd = useMemo(() => {
    const position = existingPosition?.[0]
    if (!position || !currency0 || !currency1) return BIG_ZERO
    const amount0 = CurrencyAmount.fromRawAmount(currency0, position.reserveX ?? 0n)
    const amount1 = CurrencyAmount.fromRawAmount(currency1, position.reserveY ?? 0n)
    return new BN(amount0.toExact())
      .times(token0UsdPrice ?? 0)
      .plus(new BN(amount1.toExact()).times(token1UsdPrice ?? 0))
  }, [existingPosition, token0UsdPrice, token1UsdPrice, currency0, currency1])

  const userTVLUsd = useMemo(() => {
    return existingPositionTvlUsd.plus(derivedUserTVLUsd)
  }, [existingPositionTvlUsd, derivedUserTVLUsd])

  const share = useMemo(() => {
    if (liquidity.isZero()) return new BN(0)

    const existingPositionLiquidity = existingPosition?.[0]?.activeLiquidity.toString() ?? 0
    const lqBN = new BN(liquidity.toString()).plus(existingPositionLiquidity)
    const targetLiquidity = new BN(poolLiquidity?.toString() ?? 0).plus(liquidity)
    return lqBN.dividedBy(targetLiquidity.isGreaterThan(0) ? targetLiquidity : 1)
  }, [existingPosition, liquidity, poolLiquidity])

  const cakeApr = useMemo(() => {
    if (!inRange) {
      return {
        ...globalCakeApr,
        value: '0' as const,
      }
    }

    const baseApr = userTVLUsd.isZero()
      ? BIG_ZERO
      : new BN(globalCakeApr.cakePerYear ?? 0)
          .times(globalCakeApr.poolWeight ?? 0)
          .times(cakePrice)
          .times(share)
          .div(userTVLUsd)

    return {
      ...globalCakeApr,
      value: baseApr.toString() as `${number}`,
    }
  }, [inRange, userTVLUsd, globalCakeApr, cakePrice, share])

  const apr = useMemo(
    () =>
      userTVLUsd.isZero() ? BIG_ZERO : new BN(poolInfo.lpFee24hUsd ?? 0).multipliedBy(365).times(share).div(userTVLUsd),
    [userTVLUsd, poolInfo.lpFee24hUsd, share],
  )

  return {
    lpApr: parseFloat(apr.toFixed(5)),
    cakeApr,
    merklApr: inRange ? parseFloat(merklApr ?? 0) ?? 0 : 0,
  }
}
