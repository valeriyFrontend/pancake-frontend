import { Currency, isCurrencySorted } from '@pancakeswap/swap-sdk-core'
import { useQuery } from '@tanstack/react-query'
import { QUERY_SETTINGS_IMMUTABLE, QUERY_SETTINGS_WITHOUT_INTERVAL_REFETCH } from 'config/constants'
import { InfinityProtocol } from 'config/constants/protocols'
import { addDays, addHours, addMinutes, addMonths, startOfHour } from 'date-fns'
import dayjs from 'dayjs'
import { tryParsePrice } from 'hooks/v3/utils'
import { useCallback, useMemo } from 'react'
import { chainIdToExplorerInfoChainName, explorerApiClient } from 'state/info/api/client'
import type { components as APISchema } from 'state/info/api/schema'
import type { Address } from 'viem/accounts'

interface IRateDataProps {
  period: APISchema['schemas']['ChartPeriod']
  poolId?: Address
  protocol: InfinityProtocol
  chainId?: number
}

interface ITokenRateProps extends IRateDataProps {
  baseCurrency?: Currency
  quoteCurrency?: Currency
}

export type PriceChartEntryFromAPI = {
  time: Date | null
  open: number
  close: number
  high: number
  low: number
}

const generateDateSequence = (period: APISchema['schemas']['ChartPeriod']) => {
  let dateSequence: Date[] = []
  const startDate = new Date(Date.now() - (new Date().getMinutes() % 5) * 60000)
  const startDay = dayjs(startDate).utc().startOf('day').toDate()

  // Generate sequence for 1 hour with 5 min step
  if (period === '1H') {
    const endDateHourly = addHours(startDate, -1)
    for (let date = startDate; date > endDateHourly; date = addMinutes(date, -5)) {
      dateSequence.push(date)
    }
  }

  // Generate sequence for 1 day with 1 hour step
  if (period === '1D') {
    const endDateDaily = addDays(startDate, -1)
    for (let date = startDate; date > endDateDaily; date = addHours(date, -1)) {
      dateSequence.push(startOfHour(date))
    }
  }

  // Generate sequence for 1 week with 6 hour step
  if (period === '1W') {
    const endDateWeekly = addDays(startDate, -8)
    for (let date = startDay; date >= endDateWeekly; date = addDays(date, -1)) {
      dateSequence.push(addHours(date, 18)) // 18:00
      dateSequence.push(addHours(date, 12)) // 12:00
      dateSequence.push(addHours(date, 6)) // 06:00
      dateSequence.push(date) // 00:00
    }
    dateSequence = dateSequence.filter((d) => +d <= Date.now())
  }

  // Generate sequence for 1 month with 24 hour (1 day) step at 00:00
  if (period === '1M') {
    const endDateMonthly = addMonths(startDate, -1)
    for (let date = startDay; date >= endDateMonthly; date = addDays(date, -1)) {
      dateSequence.push(dayjs(date).utc().startOf('day').toDate())
    }
  }

  return dateSequence.reverse().map((d) => ({
    time: d,
    open: 0,
    close: 0,
    high: 0,
    low: 0,
  }))
}

export const useTokenRateData = ({
  chainId,
  poolId,
  protocol,
  period,
  baseCurrency,
  quoteCurrency,
}: ITokenRateProps) => {
  const { data: rateData, isLoading } = usePoolRateData({ chainId, poolId, protocol, period })
  const isSorted = useMemo(
    () => baseCurrency && quoteCurrency && isCurrencySorted(baseCurrency, quoteCurrency),
    [baseCurrency, quoteCurrency],
  )
  const parsePrice = useCallback(
    (priceValue?: number) => {
      const basePrice = tryParsePrice(baseCurrency, quoteCurrency, priceValue?.toString())
      const price = isSorted ? basePrice?.invert() : basePrice
      return price && price?.denominator !== 0n ? parseFloat(price.toFixed(18)) : 0
    },
    [baseCurrency, quoteCurrency, isSorted],
  )

  const tokenRateData = useMemo(
    () =>
      rateData.map((item) => ({
        time: item.time,
        low: parsePrice(item.low),
        high: parsePrice(item.high),
        open: parsePrice(item.open),
        close: parsePrice(item.close),
      })),
    [rateData, parsePrice],
  )
  return {
    isLoading,
    data: tokenRateData,
  }
}

const usePoolRateData = ({ chainId, poolId, protocol, period }: IRateDataProps) => {
  const chainName = chainId
    ? chainIdToExplorerInfoChainName[chainId as keyof typeof chainIdToExplorerInfoChainName]
    : undefined
  const { isLoading, data: rateDataFromAPI } = useQuery({
    queryKey: ['usePoolRateData', chainName, protocol, poolId, period],
    queryFn: ({ signal }) => {
      if (!chainName || !protocol || !poolId) {
        return undefined
      }
      return explorerApiClient.GET('/cached/pools/chart/{protocol}/{chainName}/{address}/rate', {
        signal,
        params: {
          path: {
            chainName,
            protocol,
            address: poolId,
          },
          query: {
            period,
          },
        },
      })
    },
    enabled: Boolean(chainName && poolId && protocol && period),
    ...QUERY_SETTINGS_IMMUTABLE,
    ...QUERY_SETTINGS_WITHOUT_INTERVAL_REFETCH,
  })

  const data = useMemo(() => {
    const resp = rateDataFromAPI?.data?.map((d) => ({
      time: dayjs(d.bucket as string).toDate(),
      open: Number(d.open),
      close: Number(d.close),
      high: Number(d.high),
      low: Number(d.low),
    }))
    return generateDateSequence(period).map((seqPoint) => {
      const before = resp?.findLast((d) => +d.time <= +seqPoint.time)
      const after = resp?.find((d) => +d.time > +seqPoint.time)

      if (before && +before.time === +seqPoint.time) {
        return {
          ...before,
          time: seqPoint.time,
        }
      }
      if (!before && !after) {
        return seqPoint
      }
      if (!after) {
        return {
          ...before,
          time: seqPoint.time,
        }
      }
      if (!before) {
        return {
          ...after,
          time: seqPoint.time,
        }
      }
      const totalTimeDiff = +after.time - +before.time
      const pointTimeDiff = +seqPoint.time - +before.time
      const ratio = pointTimeDiff / totalTimeDiff
      return {
        time: seqPoint.time,
        open: before.open + (after.open - before.open) * ratio,
        close: before.close + (after.close - before.close) * ratio,
        high: before.high + (after.high - before.high) * ratio,
        low: before.low + (after.low - before.low) * ratio,
      }
    })
  }, [period, rateDataFromAPI?.data])

  return {
    isLoading,
    data,
  }
}
