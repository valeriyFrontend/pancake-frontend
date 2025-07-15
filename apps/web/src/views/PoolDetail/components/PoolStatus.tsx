import { ChainId } from '@pancakeswap/chains'
import { Protocol } from '@pancakeswap/farms'
import { useTranslation } from '@pancakeswap/localization'
import { AutoColumn, AutoRow, Button, Card, CardBody, CardProps, Column, Flex, Text } from '@pancakeswap/uikit'
import BigNumber from 'bignumber.js'
import { CHAIN_QUERY_NAME } from 'config/chains'
import { PERSIST_CHAIN_KEY } from 'config/constants'
import { getAddInfinityLiquidityURL } from 'config/constants/liquidity'
import { useMemo } from 'react'
import { useStableSwapPairsByChainId } from 'state/farmsV4/state/accountPositions/hooks'
import { InfinityPoolInfo, PoolInfo } from 'state/farmsV4/state/type'
import { isAddressEqual } from 'utils'
import { addQueryToPath } from 'utils/addQueryToPath'
import { getLpFeesAndApr } from 'utils/getLpFeesAndApr'
import { getPercentChange } from 'utils/infoDataHelpers'
import { isInfinityProtocol } from 'utils/protocols'
import { Address } from 'viem'
import { formatDollarAmount } from 'views/V3Info/utils/numbers'
import { ChangePercent } from './ChangePercent'
import { PoolTokens } from './PoolTokens'

type PoolStatusProps = {
  poolInfo?: PoolInfo | null
} & CardProps
export const PoolStatus: React.FC<PoolStatusProps> = ({ poolInfo, ...props }) => {
  const { t } = useTranslation()
  const pairs = useStableSwapPairsByChainId(poolInfo?.chainId ?? ChainId.BSC, poolInfo?.protocol === 'stable')

  const tvlChange = useMemo(() => {
    if (!poolInfo) return null
    const tvlUsd = Number(poolInfo.tvlUsd ?? 0)
    const tvlUsd24h = Number(poolInfo.tvlUsd24h ?? 0)
    return getPercentChange(tvlUsd, tvlUsd24h)
  }, [poolInfo])

  const volChange = useMemo(() => {
    if (!poolInfo) return null
    const volNow = poolInfo.vol24hUsd ? parseFloat(poolInfo.vol24hUsd) : 0
    const volBefore = poolInfo.vol48hUsd ? parseFloat(poolInfo.vol48hUsd) - volNow : 0
    return getPercentChange(volNow, volBefore)
  }, [poolInfo])

  const fee24hUsd = useMemo(() => {
    if (!poolInfo) return 0
    if (isInfinityProtocol(poolInfo.protocol) && poolInfo.lpFee24hUsd) {
      return parseFloat(poolInfo.lpFee24hUsd)
    }
    if (poolInfo.protocol === Protocol.V3 && poolInfo.fee24hUsd) {
      return parseFloat(poolInfo.fee24hUsd)
    }
    if (poolInfo.protocol === Protocol.V2) {
      const { lpFees24h } = getLpFeesAndApr(
        parseFloat(poolInfo.vol24hUsd ?? '0'),
        parseFloat(poolInfo.vol7dUsd ?? '0'),
        parseFloat(poolInfo.tvlUsd ?? '0'),
      )
      return lpFees24h
    }

    const stablePair = pairs.find((pair) => {
      return isAddressEqual(pair.stableSwapAddress, poolInfo?.stableSwapAddress as Address)
    })

    if (!stablePair) return 0

    return new BigNumber(stablePair.stableTotalFee).times(poolInfo.vol24hUsd ?? 0).toNumber()
  }, [pairs, poolInfo])

  const addLiquidityLink = useMemo(() => {
    if (!poolInfo) return ''

    const { protocol, feeTier } = poolInfo

    const token0Token1 = `${poolInfo.token0.wrapped.address}/${poolInfo.token1.wrapped.address}`

    let link = ''
    if (protocol === 'v3') {
      link = `/add/${token0Token1}/${feeTier}`
    }
    if (protocol === 'v2') {
      link = `/v2/add/${token0Token1}`
    }
    if (protocol === 'stable') {
      link = `/stable/add/${token0Token1}`
    }
    if (isInfinityProtocol(protocol)) {
      link = getAddInfinityLiquidityURL({
        chainId: poolInfo.chainId,
        poolId: (poolInfo as InfinityPoolInfo).poolId,
      })
    }
    return addQueryToPath(link, {
      chain: CHAIN_QUERY_NAME[poolInfo.chainId],
      [PERSIST_CHAIN_KEY]: '1',
    })
  }, [poolInfo])

  if (!poolInfo) {
    return null
  }

  return (
    <Card {...props}>
      <CardBody style={{ height: '100%' }}>
        <Flex flexDirection="column" justifyContent="space-between" height="100%">
          <AutoColumn gap="lg">
            <Column>
              <Text color="textSubtle" textTransform="uppercase" small bold>
                {t('Total Value Locked (TVL)')}
              </Text>
              <AutoRow gap="sm" mt="1px">
                <Text as="h3" fontSize="24px" fontWeight={600}>
                  {formatDollarAmount(Number(poolInfo.tvlUsd ?? 0))}
                </Text>
                {tvlChange ? <ChangePercent percent={tvlChange} /> : null}
              </AutoRow>
            </Column>
            <PoolTokens poolInfo={poolInfo} />
            <Column>
              <Text color="textSubtle" textTransform="uppercase" small bold>
                {t('volume 24h')}
              </Text>
              <AutoRow gap="sm" mt="1px">
                <Text as="h3" fontSize="24px" fontWeight={600}>
                  {formatDollarAmount(Number(poolInfo.vol24hUsd ?? 0))}
                </Text>
                {volChange ? <ChangePercent percent={volChange} /> : null}
              </AutoRow>
            </Column>
            <Column>
              <Text color="textSubtle" textTransform="uppercase" small bold>
                {t('fee 24h')}
              </Text>
              <Text as="h3" fontSize="24px" fontWeight={600} mt="1px">
                {formatDollarAmount(Number(fee24hUsd ?? 0))}
              </Text>
            </Column>
          </AutoColumn>
          <Button as="a" href={addLiquidityLink} width="100%">
            {t('Add Liquidity')}
          </Button>
        </Flex>
      </CardBody>
    </Card>
  )
}
