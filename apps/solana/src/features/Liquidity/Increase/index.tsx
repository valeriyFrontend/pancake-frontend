import { ReactNode, useCallback, useEffect, useState, useMemo } from 'react'
import { useTranslation } from '@pancakeswap/localization'
import { Box, Flex, Grid, GridItem, HStack, Text, TooltipProps, VStack, useDisclosure } from '@chakra-ui/react'
import { ApiV3PoolInfoStandardItem, ApiV3Token, TokenInfo, CREATE_CPMM_POOL_PROGRAM } from '@pancakeswap/solana-core-sdk'
import Decimal from 'decimal.js'

import Tabs, { TabItem } from '@/components/Tabs'
import { Desktop, Mobile } from '@/components/MobileDesktop'
import useFetchPoolById from '@/hooks/pool/useFetchPoolById'
import useFarmPositions from '@/hooks/portfolio/farm/useFarmPositions'
import { useEvent } from '@/hooks/useEvent'
import ChevronLeftIcon from '@/icons/misc/ChevronLeftIcon'
import LockIcon from '@/icons/misc/LockIcon'
import ExpandLeftTopIcon from '@/icons/misc/ExpandLeftTopIcon'
import { useTokenAccountStore } from '@/store/useTokenAccountStore'
import { panelCard } from '@/theme/cssBlocks'
import { colors } from '@/theme/cssVariables'
import { routeBack, setUrlQuery, useRouteQuery } from '@/utils/routeTools'
import { wsolToSolToken } from '@/utils/token'
import useFetchRpcPoolData from '@/hooks/pool/amm/useFetchRpcPoolData'
import useFetchCpmmRpcPoolData from '@/hooks/pool/amm/useFetchCpmmRpcPoolData'
import useFetchFarmByLpMint from '@/hooks/farm/useFetchFarmByLpMint'
import { formatCurrency, formatToRawLocaleStr } from '@/utils/numberish/formatter'
import toPercentString from '@/utils/numberish/toPercentString'
import { PoolListItemAprLine } from '@/features/Pools/components/PoolListItemAprLine'
import AddLiquidity from './Add'
import Stake from './Stake'
import PoolInfo from './components/PoolInfo'
import PoolInfoMobileDrawer from './components/PoolInfoMobileDrawer'
import PositionBalance from './components/PositionBalance'
import StakeableHint from './components/StakeableHint'
import {
  IncreaseLiquidityPageQuery,
  IncreaseTabOptionType,
  LiquidityActionModeType,
  LiquidityTabOptionType
} from '../Decrease/components/type'
import { tabValueModeMapping } from '../utils'

export default function Increase() {
  const { pool_id: urlPoolId, mode: urlMode } = useRouteQuery<IncreaseLiquidityPageQuery>()
  const { t } = useTranslation()

  const increaseTabOptions: IncreaseTabOptionType[] = [
    { value: 'Add Liquidity', label: t('Add Liquidity') },
    { value: 'Stake Liquidity', label: t('Stake Liquidity') }
  ]
  const getTokenBalanceUiAmount = useTokenAccountStore((s) => s.getTokenBalanceUiAmount)
  const fetchTokenAccountAct = useTokenAccountStore((s) => s.fetchTokenAccountAct)
  const { lpBasedData } = useFarmPositions({})

  const [tokenPair, setTokenPair] = useState<{ base?: ApiV3Token; quote?: ApiV3Token }>({})
  const { isOpen, onOpen, onClose } = useDisclosure()

  const { formattedData, isLoading, mutate } = useFetchPoolById<ApiV3PoolInfoStandardItem>({
    shouldFetch: Boolean(urlPoolId),
    idList: [urlPoolId]
  })
  const pool = formattedData?.[0]

  const isCpmm = pool && pool.programId === CREATE_CPMM_POOL_PROGRAM.toBase58()
  const { data: rpcAmmData, mutate: mutateAmm } = useFetchRpcPoolData({
    shouldFetch: !isCpmm,
    poolId: pool?.id
  })

  const { data: rpcCpmmData, mutate: mutateCpmm } = useFetchCpmmRpcPoolData({
    shouldFetch: isCpmm,
    poolId: pool?.id
  })

  const rpcData = isCpmm ? rpcCpmmData : rpcAmmData
  const mutateRpc = isCpmm ? mutateCpmm : mutateAmm

  const { formattedData: farms } = useFetchFarmByLpMint({
    shouldFetch: !!pool && pool.farmOngoingCount === 0,
    poolLp: pool?.lpMint.address
  })
  const isPoolNotFound = !!tokenPair.base && !!tokenPair.quote && !isLoading && !pool

  const lpBalance = getTokenBalanceUiAmount({
    mint: pool?.lpMint.address || '',
    decimals: pool?.lpMint.decimals
  })

  const stakedData = new Decimal(pool ? lpBasedData.get(pool.lpMint.address)?.totalLpAmount || '0' : '0')
    .div(10 ** (pool?.lpMint.decimals ?? 0))
    .toString()
  const hasFarmInfo = pool ? pool.farmOngoingCount > 0 || pool.farmUpcomingCount > 0 || !!farms.find((f) => f.isOngoing) : false

  increaseTabOptions[1].disabled = !hasFarmInfo
  increaseTabOptions[1].tooltipProps = !hasFarmInfo ? { label: t('There is no active farm for this pool.'), hasArrow: false } : undefined

  const [tabOptions, setTabOptions] = useState<TabItem[]>([])
  const [tabValue, setTabValue] = useState<LiquidityTabOptionType | undefined>(undefined)

  const [mode, setMode] = useState<LiquidityActionModeType>('add')

  const feeApr = pool?.allApr.week.find((s) => s.isTradingFee)
  const rewardApr = pool?.allApr.week.filter((s) => !s.isTradingFee && !!s.token) || []
  const hasLockedLiquidity = pool && pool.burnPercent > 0
  const aprData = useMemo(
    () => ({
      fee: {
        apr: feeApr?.apr || 0,
        percentInTotal: feeApr?.percent || 0
      },
      rewards:
        rewardApr.map((r) => ({
          apr: r.apr,
          percentInTotal: r.percent,
          mint: r.token!
        })) || [],
      apr: rewardApr.reduce((acc, cur) => acc + cur.apr, 0)
    }),
    [pool]
  )

  const handleRefresh = useEvent(() => {
    mutate()
    fetchTokenAccountAct({})
  })

  const handleSelectToken = useCallback((token: TokenInfo | ApiV3Token, side: 'base' | 'quote') => {
    setTokenPair((pair) => {
      const anotherSide = side === 'base' ? 'quote' : 'base'

      return {
        [anotherSide]: pair[anotherSide]?.address === token.address ? undefined : pair[anotherSide],
        [side]: token.address
      }
    })
  }, [])

  useEffect(() => {
    if (!urlMode) {
      setUrlQuery({ mode: 'add' })
      return
    }
    setTabValue(urlMode === 'stake' ? 'Stake Liquidity' : 'Add Liquidity')
    if (urlMode !== mode) {
      setMode(urlMode)
    }
  }, [urlMode])

  useEffect(() => {
    setTabOptions(increaseTabOptions)
  }, [hasFarmInfo])

  /** set default token pair onMount */
  useEffect(() => {
    if (!pool) return
    setTokenPair({
      base: wsolToSolToken(pool.mintA),
      quote: wsolToSolToken(pool.mintB)
    })
  }, [pool])

  useEffect(() => {
    if (!urlPoolId) setUrlQuery({ pool_id: 'AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA' })
  }, [urlPoolId])

  const handleTabChange = useEvent((value: LiquidityTabOptionType) => {
    setTabValue(value)
    setUrlQuery({ mode: tabValueModeMapping[value] })
  })

  return (
    <>
      <Grid templateColumns={['unset', '.5fr .8fr .6fr']} gap="clamp(16px, 1.5vw, 64px)" mt={8}>
        {/* left */}
        <GridItem>
          <HStack
            onClick={() => {
              routeBack()
            }}
            cursor="pointer"
            color={colors.textTertiary}
            _hover={{ color: colors.textSecondary }}
          >
            <ChevronLeftIcon />
            <Text fontWeight="500" fontSize={['md', 'xl']}>
              {t('Back')}
            </Text>
          </HStack>
        </GridItem>
        {/* main */}
        <GridItem>
          <VStack spacing={4}>
            {!increaseTabOptions[1].disabled && !lpBalance.isZero ? <StakeableHint /> : undefined}
            <Box {...panelCard} bg={colors.backgroundLight30} borderRadius="20px" overflow="hidden" w="full">
              {/*
              <Tabs isFitted items={tabOptions} size="md" variant="folder" value={tabValue} onChange={handleTabChange} />
*/}
              {mode === 'add' ? (
                <AddLiquidity
                  pool={pool}
                  isLoading={isLoading}
                  poolNotFound={isPoolNotFound}
                  rpcData={rpcData}
                  mutate={mutateRpc}
                  onSelectToken={handleSelectToken}
                  onRefresh={handleRefresh}
                  tokenPair={{
                    base: tokenPair.base,
                    quote: tokenPair.quote
                  }}
                />
              ) : null}

              {mode === 'stake' ? <Stake poolInfo={pool} disabled={!isLoading && !hasFarmInfo} onRefresh={handleRefresh} /> : null}
            </Box>
          </VStack>
        </GridItem>
        {/* right */}
        <GridItem>
          <Desktop>
            <VStack maxW={['revert', '400px']} justify="flex-start" align="stretch" spacing={4}>
              <PoolInfo
                pool={
                  pool && rpcData
                    ? {
                        ...pool,
                        mintAmountA: new Decimal(rpcData.baseReserve.toString()).div(10 ** pool.mintA.decimals).toNumber(),
                        mintAmountB: new Decimal(rpcData.quoteReserve.toString()).div(10 ** pool.mintB.decimals).toNumber()
                      }
                    : pool
                }
                aprData={aprData}
              />
              <PositionBalance
                myPosition={Number(lpBalance.amount.mul(pool?.lpPrice ?? 0).toFixed(pool?.lpMint.decimals ?? 6))}
                staked={stakedData}
                unstaked={lpBalance.isZero ? '--' : lpBalance.text}
              />
            </VStack>
          </Desktop>
          <Mobile>
            <Flex bg={colors.backgroundLight} borderRadius="20px" py={3} px={6} direction="column" gap={2} mb={1} onClick={onOpen}>
              <Flex justify="space-between">
                <Box>
                  <Text fontSize="sm" color={colors.textSecondary} opacity={0.5}>
                    {t('Total APR 7D')}
                  </Text>
                  <HStack mt={1}>
                    <Text fontSize="lg" fontWeight={500} color={colors.textPrimary}>
                      {formatToRawLocaleStr(toPercentString(pool?.week.apr))}
                    </Text>
                    <PoolListItemAprLine aprData={aprData} />
                  </HStack>
                </Box>
                <Box>
                  <Text color={colors.textSecondary} fontSize="sm" opacity={0.5}>
                    {t('Pool Liquidity')}
                  </Text>
                  <Text color={colors.textSecondary} fontSize="sm" textAlign="right" mt={1}>
                    {pool ? `$${formatCurrency(new Decimal(pool.lpAmount).mul(pool.lpPrice).toString())}` : '-'}
                  </Text>
                </Box>
              </Flex>
              {hasLockedLiquidity && (
                <HStack gap={1}>
                  <LockIcon color={colors.textSecondary} />
                  <Text color={colors.textSecondary} opacity={0.6} fontSize="xs">
                    {t('%percent% permanently locked', {
                      percent: formatToRawLocaleStr(toPercentString(pool.burnPercent || 0, { alreadyPercented: true }))
                    })}
                  </Text>
                </HStack>
              )}
              <HStack justify="center">
                <Text fontWeight="medium" fontSize="xs" color={colors.lightPurple}>
                  {t('Show more')}
                </Text>
                <ExpandLeftTopIcon />
              </HStack>
            </Flex>
            <PoolInfoMobileDrawer
              isOpen={isOpen}
              onClose={onClose}
              pool={
                pool && rpcData
                  ? {
                      ...pool,
                      mintAmountA: new Decimal(rpcData.baseReserve.toString()).div(10 ** pool.mintA.decimals).toNumber(),
                      mintAmountB: new Decimal(rpcData.quoteReserve.toString()).div(10 ** pool.mintB.decimals).toNumber()
                    }
                  : pool
              }
              aprData={aprData}
              myPosition={Number(lpBalance.amount.mul(pool?.lpPrice ?? 0).toFixed(pool?.lpMint.decimals ?? 6))}
              staked={stakedData}
              unstaked={lpBalance.isZero ? '--' : lpBalance.text}
            />
          </Mobile>
        </GridItem>
      </Grid>
    </>
  )
}
