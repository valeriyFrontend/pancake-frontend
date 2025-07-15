import { useTranslation } from '@pancakeswap/localization'
import { getCurrencyAddress, Percent } from '@pancakeswap/swap-sdk-core'
import { Box, Grid, IColumnsType, ITableViewProps, Skeleton, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { FeeTierTooltip, FiatNumberDisplay, Liquidity, TokenOverview } from '@pancakeswap/widgets-internal'
import { InfinityFeeTierBreakdown } from 'components/FeeTierBreakdown'
import { TokenPairLogo } from 'components/TokenImage'
import { useMemo } from 'react'
import type { PoolInfo } from 'state/farmsV4/state/type'
import { getHookByAddress } from 'utils/getHookByAddress'
import { isInfinityProtocol } from 'utils/protocols'
import { Address } from 'viem'

import { useHookByPoolId } from 'hooks/infinity/useHooksList'
import { useTokenByChainId } from 'hooks/Tokens'
import { getFarmAprInfo, getFarmHookData } from 'state/farmsV4/search/farm.util'
import { getCurrencySymbol } from 'utils/getTokenAlias'
import { getChainFullName } from '../utils'
import { RewardStatusDisplay } from './FarmStatusDisplay'
import { checkHasReward, getRewardProvider } from './FarmStatusDisplay/hooks'
import { PoolGlobalAprButton } from './PoolAprButton'
import { PoolListItemAction } from './PoolListItemAction'

export const FeeTierComponent = <T extends PoolInfo>({
  dynamic,
  fee,
  item,
}: {
  dynamic?: boolean
  fee: number
  item: T
}) => {
  const percent = useMemo(() => new Percent(fee ?? 0, item.feeTierBase || 1), [fee, item.feeTierBase])
  const farmHookData = getFarmHookData(item.farm)
  const hookData_ = useHookByPoolId(
    item.chainId,
    isInfinityProtocol(item.protocol) ? (item as { poolId?: `0x${string}` })?.poolId : undefined,
  )
  const hookData = farmHookData || hookData_

  if (isInfinityProtocol(item.protocol)) {
    // @ts-ignore
    const id = item.farm?.id || item.poolId
    return (
      <InfinityFeeTierBreakdown
        poolInfo={item as any as PoolInfo}
        poolId={id}
        chainId={item.chainId}
        hookData={hookData}
        infoIconVisible={false}
      />
    )
  }
  return <FeeTierTooltip type={item.protocol} percent={percent} dynamic={dynamic} />
}

export const useAPRConfig = () => {
  const { t } = useTranslation()
  return useMemo(
    () =>
      ({
        title: t('APR'),
        dataIndex: 'lpApr',
        key: 'apr',
        minWidth: '160px',
        render: (value, info) => {
          return value ? (
            <Box style={{ maxWidth: '220px', overflow: 'hidden' }}>
              <PoolGlobalAprButton pool={info} aprInfo={getFarmAprInfo(info.farm)} />
            </Box>
          ) : (
            <Skeleton width={60} />
          )
        },
      } as IColumnsType<PoolInfo>),
    [t],
  )
}

export const useFeeConfig = () => {
  const { t } = useTranslation()
  return useMemo(
    () =>
      ({
        title: t('Fee Tier'),
        dataIndex: 'feeTier',
        key: 'feeTier',
        render: (fee, item) => <FeeTierComponent dynamic={item?.isDynamicFee ?? false} fee={fee} item={item} />,
      } as IColumnsType<PoolInfo>),
    [t],
  )
}

export const useVol24Config = () => {
  const { t } = useTranslation()
  return useMemo(
    () =>
      ({
        title: t('Volume 24H'),
        dataIndex: 'vol24hUsd',
        key: 'vol',
        minWidth: '125px',
        render: (value) =>
          value ? <FiatNumberDisplay value={value} showFullDigitsTooltip={false} /> : <Skeleton width={60} />,
      } as IColumnsType<PoolInfo>),
    [t],
  )
}

export const useTVLConfig = () => {
  const { t } = useTranslation()
  return useMemo(
    () =>
      ({
        title: t('TVL'),
        dataIndex: 'tvlUsd',
        key: 'tvl',
        minWidth: '125px',
        render: (value) =>
          value ? <FiatNumberDisplay value={value} showFullDigitsTooltip={false} /> : <Skeleton width={60} />,
      } as IColumnsType<PoolInfo>),
    [t],
  )
}

export const usePoolTypeConfig = () => {
  const { t } = useTranslation()
  return useMemo(
    () =>
      ({
        title: t('pool type'),
        dataIndex: 'protocol',
        key: 'protocol',
        render: (value) => (
          <Box style={{ width: 'max-content' }}>
            <Liquidity.PoolFeaturesBadge showPoolType showLabel={false} poolType={value} short />
          </Box>
        ),
      } as IColumnsType<PoolInfo>),
    [t],
  )
}

export const usePoolFeatureConfig = (showPoolType = true) => {
  const { t } = useTranslation()
  return useMemo(
    () =>
      ({
        title: t('Pool Feature'),
        dataIndex: 'hookAddress',
        key: 'hookAddress',
        minWidth: '140px',
        render: (value: Address, item: PoolInfo) => {
          const hookData = getHookByAddress(item.chainId, value)
          return (
            <Grid gridGap="4px">
              {hookData ? (
                <Liquidity.PoolFeaturesBadge showPoolType={showPoolType} showLabel={false} hookData={hookData} />
              ) : showPoolType ? (
                <Liquidity.PoolFeaturesBadge showPoolType showLabel={false} poolType={item.protocol} />
              ) : (
                <Text color="textSubtle" textAlign="center">
                  -
                </Text>
              )}
            </Grid>
          )
        },
      } as unknown as IColumnsType<PoolInfo>),
    [t, showPoolType],
  )
}

export const PoolTokenOverview = <T extends PoolInfo = PoolInfo>({ data }: { data: T }) => {
  const token0 = useTokenByChainId(getCurrencyAddress(data.token0), data.chainId) || data.token0
  const token1 = useTokenByChainId(getCurrencyAddress(data.token1), data.chainId) || data.token1

  const provider = getRewardProvider(data.chainId, data.lpAddress)
  const showReward = !!provider

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <TokenOverview
        isReady
        token={token0}
        quoteToken={token1}
        iconWidth="48px"
        getChainName={getChainFullName}
        getCurrencySymbol={getCurrencySymbol}
        icon={<TokenPairLogo width={44} height={44} variant="inverted" primaryToken={token0} secondaryToken={token1} />}
      />
      {showReward && <RewardStatusDisplay provider={provider} />}
    </div>
  )
}

export const useColumnConfig = <T extends PoolInfo = PoolInfo>(): ITableViewProps<T>['columns'] => {
  const { t } = useTranslation()
  const mediaQueries = useMatchBreakpoints()
  const vol24hUsdConf = useVol24Config()
  const TVLUsdConf = useTVLConfig()
  const feeTierConf = useFeeConfig()
  const APRConf = useAPRConfig()
  const poolTypeConf = usePoolTypeConfig()
  const poolFeatureConf = usePoolFeatureConfig(false)

  return useMemo(
    () => [
      {
        title: t('All Pools'),
        dataIndex: null,
        key: 'name',
        minWidth: '210px',
        render: (_, item) => <PoolTokenOverview data={item} />,
      },
      {
        ...feeTierConf,
        display: mediaQueries.isXl || mediaQueries.isXxl,
      },
      {
        ...APRConf,
        sorter: true,
      },
      {
        ...TVLUsdConf,
        sorter: true,
        display: mediaQueries.isXl || mediaQueries.isXxl,
      },
      {
        ...vol24hUsdConf,
        sorter: true,
        display: mediaQueries.isXl || mediaQueries.isXxl || mediaQueries.isLg,
      },
      {
        ...poolTypeConf,
        display: mediaQueries.isXxl,
      },
      {
        ...poolFeatureConf,
        display: mediaQueries.isXxl,
      },
      {
        title: '',
        render: (value) => <PoolListItemAction pool={value} />,
        dataIndex: null,
        key: 'action',
        clickable: false,
      },
    ],
    [t, mediaQueries, APRConf, feeTierConf, vol24hUsdConf, TVLUsdConf, poolFeatureConf, poolTypeConf],
  )
}

export const useColumnMobileConfig = (): ITableViewProps<PoolInfo>['columns'] => {
  const vol24hUsdConf = useVol24Config()
  const TVLUsdConf = useTVLConfig()
  const feeTierConf = useFeeConfig()
  const APRConf = useAPRConfig()
  const poolTypeConf = usePoolTypeConfig()
  const poolFeatureConf = usePoolFeatureConfig(false)
  return useMemo(
    () => [APRConf, feeTierConf, TVLUsdConf, vol24hUsdConf, poolTypeConf, poolFeatureConf],
    [APRConf, feeTierConf, vol24hUsdConf, TVLUsdConf, poolTypeConf, poolFeatureConf],
  )
}
