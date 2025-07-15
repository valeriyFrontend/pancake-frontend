import { Button } from '@pancakeswap/uikit'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HStack, Text, VStack } from '@chakra-ui/react'
import { ApiV3PoolInfoConcentratedItem } from '@pancakeswap/solana-core-sdk'

import { useTranslation } from '@pancakeswap/localization'
import BN from 'bn.js'
import Decimal from 'decimal.js'
import TokenAvatar from '@/components/TokenAvatar'
import CLMMTokenInputGroup, { InputSide } from '@/features/Clmm/components/TokenInputGroup'
import { useAppStore, useClmmStore, useTokenAccountStore } from '@/store'
import { colors } from '@/theme/cssVariables'
import { debounce } from '@/utils/functionMethods'
import toPercentString from '@/utils/numberish/toPercentString'
import { formatCurrency, formatToRawLocaleStr, trimTrailZero } from '@/utils/numberish/formatter'
import { getMintSymbol, wSolToSol, wsolToSolToken } from '@/utils/token'
import useTokenPrice from '@/hooks/token/useTokenPrice'
import { calRatio } from '@/features/Clmm/utils/math'
import { TickData } from './type'

interface Props extends Required<TickData> {
  baseIn: boolean
  tempCreatedPool: ApiV3PoolInfoConcentratedItem
  onConfirm: (props: { inputA: boolean; amount1: string; amount2: string; liquidity: BN }) => void
}

export default function TokenAmountPairInputs({ tempCreatedPool, baseIn, onConfirm, ...tickData }: Props) {
  const isMobile = useAppStore((s) => s.isMobile)
  const computePairAmount = useClmmStore((s) => s.computePairAmount)
  const getTokenBalanceUiAmount = useTokenAccountStore((s) => s.getTokenBalanceUiAmount)
  const { t } = useTranslation()
  const [tokenAmount, setTokenAmount] = useState(['', ''])
  const focusPoolARef = useRef(true)
  const computeRef = useRef(false)
  const computeDataRef = useRef<Awaited<ReturnType<typeof computePairAmount>> | undefined>(undefined)

  const [mintA, mintB] = [tempCreatedPool![baseIn ? 'mintA' : 'mintB'], tempCreatedPool![baseIn ? 'mintB' : 'mintA']]
  const { data: tokenPrices } = useTokenPrice({
    mintList: [mintA.address, mintB.address]
  })

  const [priceLower, priceUpper] = baseIn
    ? [tickData.priceLower, tickData.priceUpper]
    : [new Decimal(1).div(tickData.priceUpper).toString(), new Decimal(1).div(tickData.priceLower).toString()]

  const disabledInput = useMemo(() => {
    const res = tempCreatedPool
      ? [new Decimal(tempCreatedPool.price || 0).gt(priceUpper || 0), new Decimal(tempCreatedPool.price || 0).lt(priceLower || 0)]
      : [false, false]
    return baseIn ? res : res.reverse()
  }, [baseIn, priceLower, priceUpper, tempCreatedPool])

  const debounceCompute = useCallback(
    debounce((props: Parameters<typeof computePairAmount>[0]) => {
      computePairAmount(props).then((res) => {
        computeRef.current = !!res
        computeDataRef.current = res
        if (res) {
          setTokenAmount((preValue) => {
            if (baseIn)
              return focusPoolARef.current
                ? [preValue[0], props.amount ? trimTrailZero(res.amountSlippageB.toFixed(mintB.decimals))! : '']
                : [props.amount ? trimTrailZero(res.amountSlippageA.toFixed(mintA.decimals))! : '', preValue[1]]
            return focusPoolARef.current
              ? [props.amount ? trimTrailZero(res.amountSlippageB.toFixed(mintB.decimals))! : '', preValue[1]]
              : [preValue[0], props.amount ? trimTrailZero(res.amountSlippageA.toFixed(mintA.decimals))! : '']
          })
        }
      })
    }, 100),
    [baseIn, mintA.decimals, mintB.decimals]
  )

  useEffect(() => {
    if (!tempCreatedPool.id) return
    if (computeRef.current) {
      computeRef.current = false
      return
    }
    const amount = (focusPoolARef.current && baseIn) || (!focusPoolARef.current && !baseIn) ? tokenAmount[0] : tokenAmount[1]

    debounceCompute({
      ...tickData,
      pool: tempCreatedPool,
      inputA: focusPoolARef.current,
      amount
    })
  }, [tempCreatedPool, baseIn, tokenAmount, debounceCompute, tickData])

  const handleAmountChange = useCallback(
    (val: string, side: string) => setTokenAmount((prevVal) => (side === InputSide.TokenA ? [val, prevVal[1]] : [prevVal[0], val])),
    []
  )
  const handleFocusChange = useCallback(
    (mint?: string) => {
      focusPoolARef.current = wSolToSol(mint) === wSolToSol(tempCreatedPool.mintA.address)
    },
    [tempCreatedPool.mintA.address]
  )

  const handleConfirm = useCallback(() => {
    onConfirm({
      inputA: focusPoolARef.current,
      amount1: tokenAmount[baseIn ? 0 : 1],
      amount2: tokenAmount[baseIn ? 1 : 0],
      liquidity: computeDataRef.current!.liquidity
    })
  }, [baseIn, onConfirm, tokenAmount])

  const balanceA = getTokenBalanceUiAmount({ mint: wSolToSol(mintA.address)!, decimals: mintA.decimals }).amount
  const balanceB = getTokenBalanceUiAmount({ mint: wSolToSol(mintB.address)!, decimals: mintB.decimals }).amount

  const error = useMemo(() => {
    if (!disabledInput[0]) {
      if (!tokenAmount[0] || new Decimal(tokenAmount[0] || 0).isZero()) return { key: 'Enter token amount' }
      if (new Decimal(tokenAmount[0]).gt(balanceA))
        return { key: 'Insufficient sub balance', props: { token: getMintSymbol({ mint: mintA, transformSol: true }) } }
    }
    if (!disabledInput[1] || new Decimal(tokenAmount[1] || 0).isZero()) {
      if (!tokenAmount[1]) return { key: 'Enter token amount' }
      if (new Decimal(tokenAmount[1]).gt(balanceB))
        return { key: 'Insufficient sub balance', props: { token: getMintSymbol({ mint: mintB, transformSol: true }) } }
    }
    return undefined
  }, [balanceA, balanceB, disabledInput, mintA, mintB, tokenAmount])

  const priceA = tokenPrices[mintA.address]?.value
  const priceB = tokenPrices[mintB.address]?.value
  const validPriceA = priceA !== undefined && priceA >= 0 ? priceA : 0
  const validPriceB = priceB !== undefined && priceB >= 0 ? priceB : 0
  const [mintAVolume, mintBVolume] = [new Decimal(tokenAmount[0] || 0).mul(validPriceA), new Decimal(tokenAmount[1] || 0).mul(validPriceB)]
  const totalVolume = mintAVolume.add(mintBVolume)
  const { ratioA, ratioB } = calRatio({
    price: baseIn ? tempCreatedPool.price : 1 / tempCreatedPool.price,
    amountA: tokenAmount[0],
    amountB: tokenAmount[1]
  })
  return (
    <>
      <CLMMTokenInputGroup
        pool={tempCreatedPool}
        baseIn={baseIn}
        tokenAmount={tokenAmount}
        disableSelectToken
        onAmountChange={handleAmountChange}
        onFocusChange={handleFocusChange}
        token1Disable={disabledInput[0]}
        token2Disable={disabledInput[1]}
        solReserveAmount={0.5}
      />
      <VStack mt={4} align="stretch" rounded="xl" p={3} gap={1}>
        <HStack justify="space-between">
          <Text fontSize="sm">{t('Total Deposit')}</Text>
          <Text fontSize="sm" color={colors.textPrimary}>
            {formatCurrency(totalVolume.toString(), { symbol: '$', decimalPlaces: 2 })}
          </Text>
        </HStack>

        <HStack justify="space-between">
          <Text fontSize="sm">{t('Deposit Ratio')}</Text>
          <HStack>
            <Text color={colors.positive60}>{formatToRawLocaleStr(toPercentString(ratioA, { decimals: 1 }))}</Text>
            <TokenAvatar token={wsolToSolToken(tempCreatedPool![baseIn ? 'mintA' : 'mintB'])} size="sm" />
            <Text>/</Text>
            <Text color={colors.positive60}>{formatToRawLocaleStr(toPercentString(ratioB, { decimals: 1 }))}</Text>
            <TokenAvatar token={wsolToSolToken(tempCreatedPool![baseIn ? 'mintB' : 'mintA'])} size="sm" />
          </HStack>
        </HStack>
      </VStack>
      <Button mt={isMobile ? '16px' : '24px'} disabled={!!error} onClick={handleConfirm}>
        {error ? t(error.key, error.props || {}) : t('Preview Pool')}
      </Button>
    </>
  )
}
