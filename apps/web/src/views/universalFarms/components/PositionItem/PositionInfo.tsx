import { Protocol } from '@pancakeswap/farms'
import { useTheme } from '@pancakeswap/hooks'
import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount, Token } from '@pancakeswap/swap-sdk-core'
import { FeeTier, FlexGap, Row, Skeleton, Tag, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { formatNumber as formatBalance } from '@pancakeswap/utils/formatBalance'
import { formatNumber } from '@pancakeswap/utils/formatNumber'
import { DoubleCurrencyLogo, FiatNumberDisplay } from '@pancakeswap/widgets-internal'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { MerklTag } from 'components/Merkl/MerklTag'
import { RangeTag } from 'components/RangeTag'
import dayjs from 'dayjs'
import { useUnclaimedFarmRewardsUSDByPoolId, useUnclaimedFarmRewardsUSDByTokenId } from 'hooks/infinity/useFarmReward'
import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import React, { memo, useEffect, useMemo } from 'react'
import {
  InfinityBinPositionDetail,
  InfinityCLPositionDetail,
  PositionDetail,
  StableLPDetail,
  V2LPDetail,
} from 'state/farmsV4/state/accountPositions/type'
import { InfinityPoolInfo, PoolInfo } from 'state/farmsV4/state/type'
import styled from 'styled-components'
import { isInfinityProtocol } from 'utils/protocols'
import { Address } from 'viem'
import { useV2CakeEarning, useV3CakeEarning } from 'views/universalFarms/hooks/useCakeEarning'
import { usePositionEarningAmount } from 'views/universalFarms/hooks/usePositionEarningAmount'
import { useAccount } from 'wagmi'
import {
  InfinityBinPoolPositionAprButton,
  InfinityCLPoolPositionAprButton,
  PoolGlobalAprButton,
  V2PoolPositionAprButton,
  V3PoolPositionAprButton,
} from '../PoolAprButton'
import { PositionDebugView } from './PositionDebugView'

export const formatPositionAmount = (amount?: CurrencyAmount<Token | Currency>) => {
  const minimumFractionDigits = Math.min(amount?.currency.decimals ?? 0, 6)
  return amount && !amount.equalTo(0) ? amount.toFixed(minimumFractionDigits) : '0'
}

const displayTokenReserve = (amount?: CurrencyAmount<Token | Currency>) => {
  const symbol = amount?.currency.symbol ?? '-'
  return `${formatNumber(formatPositionAmount(amount))} ${symbol}`
}

export type PositionInfoProps = {
  chainId: number
  currency0?: Currency
  currency1?: Currency
  removed: boolean
  outOfRange: boolean
  desc?: React.ReactNode
  link?: string
  tokenId?: bigint
  fee: number
  feeTierBase?: number
  isStaked?: boolean
  protocol: Protocol
  totalPriceUSD: number
  amount0?: CurrencyAmount<Token | Currency>
  amount1?: CurrencyAmount<Token | Currency>
  pool?: PoolInfo | null
  detailMode?: boolean
  userPosition?: PositionDetail | V2LPDetail | StableLPDetail | InfinityBinPositionDetail
  showAPR?: boolean
  miniMode?: boolean
  disableFixedTags?: boolean
}

export const PositionInfo = memo((props: PositionInfoProps) => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { isMobile, isTablet } = useMatchBreakpoints()
  const {
    currency0,
    currency1,
    removed,
    outOfRange,
    desc,
    tokenId,
    fee,
    feeTierBase,
    isStaked,
    protocol,
    totalPriceUSD,
    amount0,
    amount1,
    pool,
    userPosition,
    detailMode,
    showAPR = true,
    miniMode = isTablet || isMobile,
    chainId,
    disableFixedTags,
  } = props
  const hookData = useHookByPoolId(
    chainId,
    isInfinityProtocol(protocol) ? (pool as InfinityPoolInfo)?.poolId : undefined,
  )

  const tags = useMemo(() => {
    return (
      <>
        {(isInfinityProtocol(protocol) ? isStaked && !outOfRange && !removed : isStaked) && (
          <Tag variant="primary60">{t('Farming')}</Tag>
        )}
        {![Protocol.STABLE, Protocol.V2].includes(protocol) && (
          <RangeTag lowContrast removed={removed} outOfRange={outOfRange} protocol={protocol} />
        )}
        <MerklTag poolAddress={pool?.lpAddress} />
      </>
    )
  }, [t, protocol, isStaked, outOfRange, removed, pool?.lpAddress])

  const title = useMemo(
    () =>
      miniMode ? (
        <DetailInfoTitle $isMobile>
          <Row gap="8px" flexWrap="wrap">
            <DoubleCurrencyLogo size={24} currency0={currency0} currency1={currency1} showChainLogoCurrency1 />
            {isInfinityProtocol(protocol) ? (
              <InfinityFeeTierBreakdown
                poolId={(pool as InfinityPoolInfo)?.poolId}
                chainId={chainId}
                hookData={hookData}
                infoIconVisible={false}
              />
            ) : (
              <FeeTier type={protocol} fee={fee} dynamic={pool?.isDynamicFee} denominator={feeTierBase} />
            )}
            <Row>
              {(isInfinityProtocol(protocol) ? isStaked && !outOfRange && !removed : isStaked) && (
                <Tag variant="primary60" mr="8px">
                  {t('Farming')}
                </Tag>
              )}
              {![Protocol.STABLE, Protocol.V2].includes(protocol) && (
                <RangeTag lowContrast removed={removed} outOfRange={outOfRange} protocol={protocol} />
              )}
              <MerklTag poolAddress={pool?.lpAddress} />
            </Row>
          </Row>
          <Row>
            <Text bold>{`${currency0?.symbol} / ${currency1?.symbol} LP`}</Text>
            {tokenId ? <Text color="textSubtle">(#{tokenId.toString()})</Text> : null}
          </Row>
        </DetailInfoTitle>
      ) : (
        <DetailInfoTitle>
          <FlexGap flexWrap="wrap" gap="8px" justifyContent="space-between" width="100%">
            <FlexGap gap="8px" alignItems="center">
              <PositionDebugView json={props}>
                <Text bold>{`${currency0?.symbol} / ${currency1?.symbol} LP`}</Text>
              </PositionDebugView>
              {tokenId ? <Text color="textSubtle">(#{tokenId.toString()})</Text> : null}
              {isInfinityProtocol(protocol) ? (
                <InfinityFeeTierBreakdown
                  poolId={(pool as InfinityPoolInfo)?.poolId}
                  chainId={chainId}
                  hookData={hookData}
                />
              ) : (
                <FeeTier type={protocol} fee={fee} denominator={feeTierBase} />
              )}
            </FlexGap>

            {disableFixedTags ? (
              <FlexGap gap="8px" flexWrap="wrap">
                {tags}
              </FlexGap>
            ) : (
              <TagCell gap="8px">{tags}</TagCell>
            )}
          </FlexGap>
        </DetailInfoTitle>
      ),
    [
      isMobile,
      chainId,
      miniMode,
      feeTierBase,
      currency0,
      currency1,
      fee,
      isStaked,
      outOfRange,
      protocol,
      removed,
      t,
      tokenId,
      pool,
    ],
  )

  const AprButton = useMemo(() => {
    if (!pool) {
      return <Skeleton width={60} />
    }
    if (!userPosition) {
      return <PoolGlobalAprButton pool={pool} detailMode={detailMode} />
    }
    if (pool.protocol === Protocol.V3) {
      return <V3PoolPositionAprButton pool={pool} userPosition={userPosition as PositionDetail} />
    }
    if (pool.protocol === Protocol.InfinityCLAMM) {
      return <InfinityCLPoolPositionAprButton pool={pool} userPosition={userPosition as InfinityCLPositionDetail} />
    }
    if (pool.protocol === Protocol.InfinityBIN) {
      return <InfinityBinPoolPositionAprButton pool={pool} userPosition={userPosition as InfinityBinPositionDetail} />
    }
    return <V2PoolPositionAprButton pool={pool} userPosition={userPosition as V2LPDetail | StableLPDetail} />
  }, [detailMode, pool, userPosition])

  return (
    <>
      {title}
      <DetailInfoDesc>
        {desc}
        <Row gap="sm">
          <FiatNumberDisplay
            prefix="~"
            value={totalPriceUSD}
            style={{ color: theme.colors.textSubtle, fontSize: '12px' }}
            showFullDigitsTooltip={false}
          />
          ({displayTokenReserve(amount0)} / {displayTokenReserve(amount1)})
        </Row>
        {showAPR && (
          <Row gap="8px">
            <DetailInfoLabel>APR: </DetailInfoLabel>
            {AprButton}
          </Row>
        )}
        {isStaked ? (
          [Protocol.STABLE, Protocol.V2].includes(protocol) ? (
            <V2Earnings pool={pool} />
          ) : Protocol.V3 === protocol && pool?.chainId ? (
            <V3Earnings tokenId={tokenId} chainId={pool?.chainId} />
          ) : null
        ) : null}
        {Protocol.InfinityCLAMM === protocol ? (
          <InfinityCLEarnings tokenId={tokenId} chainId={pool?.chainId} poolId={pool?.lpAddress} />
        ) : Protocol.InfinityBIN === protocol ? (
          <InfinityBinEarnings chainId={pool?.chainId} poolId={pool?.lpAddress} />
        ) : null}
      </DetailInfoDesc>
    </>
  )
})

const Earnings: React.FC<{ earningsAmount?: number; earningsBusd?: number }> = ({
  earningsAmount = 0,
  earningsBusd = 0,
}) => {
  const { t } = useTranslation()
  return (
    earningsAmount > 0 && (
      <Row gap="8px">
        <DetailInfoLabel>
          {t('CAKE earned')}: {earningsAmount} (~${formatBalance(earningsBusd)})
        </DetailInfoLabel>
      </Row>
    )
  )
}

const V2Earnings = ({ pool }: { pool: PoolInfo | null | undefined }) => {
  const { earningsAmount, earningsBusd } = useV2CakeEarning(pool)
  return <Earnings earningsAmount={earningsAmount} earningsBusd={earningsBusd} />
}

const V3Earnings = ({ tokenId, chainId }: { tokenId?: bigint; chainId: number }) => {
  const { earningsAmount, earningsBusd } = useV3CakeEarning(
    useMemo(() => (tokenId ? [tokenId] : []), [tokenId]),
    chainId,
  )
  return <Earnings earningsAmount={earningsAmount} earningsBusd={earningsBusd} />
}

const InfinityBinEarnings = ({ chainId, poolId }: { chainId?: number; poolId?: Address }) => {
  const { address } = useAccount()
  const {
    data: { rewardsAmount, rewardsUSD },
    isLoading,
  } = useUnclaimedFarmRewardsUSDByPoolId({
    chainId,
    poolId,
    address,
    timestamp: dayjs().startOf('hour').unix(),
  })
  const amount = useMemo(() => {
    const decimal = Math.min(rewardsAmount?.currency.decimals ?? 18, 18)
    return Number(rewardsAmount?.toFixed(decimal) ?? 0)
  }, [rewardsAmount])

  const [, updatePositionEarningAmount] = usePositionEarningAmount()

  useEffect(() => {
    if (!(chainId && poolId && !isLoading)) {
      return
    }
    updatePositionEarningAmount(chainId, poolId, amount)
  }, [amount, chainId, poolId, isLoading, updatePositionEarningAmount])
  return <Earnings earningsAmount={amount} earningsBusd={rewardsUSD} />
}

const InfinityCLEarnings = ({ tokenId, chainId, poolId }: { tokenId?: bigint; chainId?: number; poolId?: Address }) => {
  const { address } = useAccount()
  const {
    data: { rewardsAmount, rewardsUSD },
    isLoading,
  } = useUnclaimedFarmRewardsUSDByTokenId({
    chainId,
    tokenId,
    poolId,
    address,
    timestamp: dayjs().startOf('hour').unix(),
  })
  const amount = useMemo(() => {
    const decimal = Math.min(rewardsAmount?.currency.decimals ?? 18, 18)
    return Number(rewardsAmount?.toFixed(decimal) ?? 0)
  }, [rewardsAmount])

  const [, updatePositionEarningAmount] = usePositionEarningAmount()

  useEffect(() => {
    if (!(chainId && poolId && tokenId && !isLoading)) {
      return
    }
    updatePositionEarningAmount(chainId, poolId, tokenId, amount)
  }, [amount, chainId, poolId, tokenId, isLoading, updatePositionEarningAmount])

  return <Earnings earningsAmount={amount} earningsBusd={rewardsUSD} />
}

const DetailInfoTitle = styled.div<{ $isMobile?: boolean }>`
  display: flex;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  flex-direction: ${({ $isMobile }) => ($isMobile ? 'column' : 'row')};
`

const DetailInfoDesc = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  font-weight: 400;
`

const DetailInfoLabel = styled(Text)`
  color: ${({ theme }) => theme.colors.textSubtle};
  font-weight: 600;
  font-size: 12px;
`

const TagCell = styled(FlexGap)`
  position: absolute;
  right: 0;
  top: 0;
  padding: 16px;
`
