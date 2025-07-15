import { useEffect, useMemo } from 'react'
import { Badge, Box, Button, Divider, Flex, Grid, GridItem, HStack, SimpleGrid, Text } from '@chakra-ui/react'
import { useTranslation } from '@pancakeswap/localization'
import Decimal from 'decimal.js'
import { ApiV3Token, ApiV3PoolInfoConcentratedItem, PoolFetchType } from '@pancakeswap/solana-core-sdk'
import TokenAvatar from '@/components/TokenAvatar'
import useFetchFarmInfoById from '@/hooks/farm/useFetchFarmInfoById'
import useFetchPoolById from '@/hooks/pool/useFetchPoolById'
import FarmRewardIcon from '@/icons/pool/FarmRewardIcon'
import { colors } from '@/theme/cssVariables'
import { formatCurrency, formatToRawLocaleStr } from '@/utils/numberish/formatter'
import { routeToPage } from '@/utils/routeTools'
import { toAPRPercent } from '@/features/Pools/util'
import useTokenPrice from '@/hooks/token/useTokenPrice'
import { FarmBalanceInfo } from '@/hooks/farm/type'
import { Desktop, Mobile } from '@/components/MobileDesktop'

/** subItem of standard Pool */
export default function StandardPoolRowStakeFarmItem({
  poolId,
  farmId,
  lpPrice,
  balanceInfo,
  onUpdatePendingReward
}: {
  poolId: string
  farmId: string
  lpPrice: number
  balanceInfo?: FarmBalanceInfo
  onUpdatePendingReward: (params: {
    farmId: string
    reward: { mint: ApiV3Token[]; usd: string; amount: string[]; rewardTokenUsd: string[] }
  }) => void
}) {
  const { t } = useTranslation()
  const { data } = useFetchFarmInfoById({ idList: [farmId] })
  const { formattedData } = useFetchPoolById<ApiV3PoolInfoConcentratedItem>({
    idList: [poolId],
    type: PoolFetchType.Standard
  })
  const farm = data?.[0]
  const pool = formattedData?.[0]
  const { data: tokenPrices } = useTokenPrice({
    mintList: farm?.rewardInfos.map((r) => r.mint.address) || []
  })
  const { deposited = '0', pendingRewards = [] } = balanceInfo || {}

  const { pendingReward, rewardTokenUsd } = useMemo(() => {
    const rewardTokenUsd: string[] = []
    const all = pendingRewards
      .reduce((acc, cur, idx) => {
        if (!farm?.rewardInfos[idx]) return acc
        const usd = new Decimal(cur).mul(tokenPrices[farm?.rewardInfos[idx].mint.address || '']?.value ?? 0) // reward in usd
        rewardTokenUsd.push(usd.toFixed(4))
        return acc.add(usd)
      }, new Decimal(0))
      .toDecimalPlaces(6)
      .toString()

    return { pendingReward: all, rewardTokenUsd }
  }, [pendingRewards])

  useEffect(() => {
    if (!farm?.id) return
    onUpdatePendingReward({
      farmId: farm.id,
      reward: {
        mint: farm.rewardInfos.map((r) => r.mint),
        usd: pendingReward,
        amount: pendingRewards,
        rewardTokenUsd
      }
    })
  }, [farm?.id, pendingReward, onUpdatePendingReward])
  if (!farm) return null

  return (
    <>
      <Mobile>
        <Box py={3} px={4} bg={colors.backgroundDark} borderRadius="xl" w="full">
          <Flex justifyContent="space-between" mb={3}>
            <HStack spacing={3}>
              <HStack py={1} px={2} bg={colors.backgroundTransparent12} gap={1} borderRadius="md">
                <Box color={colors.textSecondary}>
                  <FarmRewardIcon />
                </Box>
                {farm.rewardInfos.map((r, idx) => (
                  <TokenAvatar key={`${farmId}-${r.mint.address}`} token={r.mint} ml={-1 * idx * 2} size="smi" />
                ))}
              </HStack>
              {pool?.rewardDefaultPoolInfos === 'Ecosystem' && <Badge variant="crooked">{t('Ecosystem')}</Badge>}
            </HStack>
            <Button
              variant="outline"
              size="sm"
              onClick={() => routeToPage('decrease-liquidity', { queryProps: { mode: 'unstake', pool_id: poolId, farm_id: farm.id } })}
            >
              {t('Unstake')}
            </Button>
          </Flex>
          <HStack height={6} mb={3}>
            <HStack>
              <Text color={colors.textSecondary}>{t('Staked')}</Text>
              <Text>{formatCurrency(new Decimal(deposited).mul(lpPrice).toString(), { symbol: '$', decimalPlaces: 2 })}</Text>
            </HStack>
            <Divider orientation="vertical" alignSelf="stretch" />
            <HStack>
              <Text color={colors.textSecondary}>{t('APR')}</Text>
              <Text>{formatToRawLocaleStr(toAPRPercent(farm.apr * 100))}</Text>
            </HStack>
            <Divider orientation="vertical" alignSelf="stretch" />
          </HStack>
          <HStack>
            <Text color={colors.textSecondary}>{t('Pending rewards')}</Text>
            <Text>{formatCurrency(pendingReward, { symbol: '$', decimalPlaces: 2 })}</Text>
          </HStack>
        </Box>
      </Mobile>
      <Desktop>
        <Grid
          gridAutoFlow="column"
          gridTemplate={[
            `
            "face  face action" auto
            "infos infos infos " auto / auto auto 1fr
            `,
            `
            "face  infos action" auto / 1fr 3fr 1fr
          `
          ]}
          py={[3, 2]}
          px={[4, 8]}
          bg={colors.backgroundDark}
          columnGap={4}
          rowGap={3}
          borderRadius="xl"
          w="full"
          alignItems="center"
          justifyItems="left"
          flexWrap="wrap"
        >
          <GridItem area="face">
            <HStack spacing={3}>
              <HStack py={1} px={2} bg={colors.backgroundTransparent12} gap={1} borderRadius="md">
                <Box color={colors.textSecondary}>
                  <FarmRewardIcon />
                </Box>
                {farm.rewardInfos.map((r, idx) => (
                  <TokenAvatar key={`${farmId}-${r.mint.address}`} token={r.mint} ml={-1 * idx * 2} size="smi" />
                ))}
              </HStack>
              {pool?.rewardDefaultPoolInfos === 'Ecosystem' && <Badge variant="crooked">{t('Ecosystem')}</Badge>}
            </HStack>
          </GridItem>

          <GridItem area="infos" justifySelf="stretch" fontSize={['sm', 'md']}>
            <SimpleGrid columnGap={[2, 8]} templateColumns="1fr auto auto auto 1fr">
              <HStack justifyContent="right">
                <Text color={colors.textSecondary}>{t('Staked')}</Text>
                <Text>{formatCurrency(new Decimal(deposited).mul(lpPrice).toString(), { symbol: '$', decimalPlaces: 2 })}</Text>
              </HStack>

              <Divider orientation="vertical" alignSelf="stretch" />

              <HStack width={['84px', '100px']} justifyContent="center">
                <Text color={colors.textSecondary}>{t('APR')}</Text>
                <Text>{formatToRawLocaleStr(toAPRPercent(farm.apr * 100))}</Text>
              </HStack>

              <Divider orientation="vertical" alignSelf="stretch" />

              <HStack justifyContent="left">
                <Text color={colors.textSecondary}>{t('Pending rewards')}</Text>
                <Text>{formatCurrency(pendingReward, { symbol: '$', decimalPlaces: 2 })}</Text>
              </HStack>
            </SimpleGrid>
          </GridItem>

          <GridItem area="action" justifySelf="end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => routeToPage('decrease-liquidity', { queryProps: { mode: 'unstake', pool_id: poolId, farm_id: farm.id } })}
            >
              {t('Unstake')}
            </Button>
          </GridItem>
        </Grid>
      </Desktop>
    </>
  )
}
