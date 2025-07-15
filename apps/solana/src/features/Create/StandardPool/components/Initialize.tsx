import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { Box, Flex, HStack, Text, VStack, useDisclosure, Skeleton } from '@chakra-ui/react'
import { shallow } from 'zustand/shallow'
import FocusTrap from 'focus-trap-react'
import { usePopper } from 'react-popper'
import { useTranslation } from '@pancakeswap/localization'
import { PublicKey } from '@solana/web3.js'
import {
  ApiV3Token,
  RAYMint,
  TokenInfo,
  solToWSolToken,
  ApiCpmmConfigInfo,
  PoolFetchType,
  solToWSol,
  CREATE_CPMM_POOL_PROGRAM,
  ApiV3PoolInfoStandardItemCpmm
} from '@pancakeswap/solana-core-sdk'
import { ChevronDown, ChevronUp } from 'react-feather'
import Decimal from 'decimal.js'
import dayjs from 'dayjs'
import { DatePick, HourPick, MinutePick } from '@/components/DateTimePicker'
import DecimalInput from '@/components/DecimalInput'
import Button from '@/components/Button'
import TokenInput from '@/components/TokenInput'
import Tabs from '@/components/Tabs'
import { QuestionToolTip } from '@/components/QuestionToolTip'
import { Select } from '@/components/Select'
import HorizontalSwitchSmallIcon from '@/icons/misc/HorizontalSwitchSmallIcon'
import AddLiquidityPlus from '@/icons/misc/AddLiquidityPlus'
import SubtractIcon from '@/icons/misc/SubtractIcon'
import { useLiquidityStore, useTokenStore, useCreateMarketStore } from '@/store'
import { colors } from '@/theme/cssVariables'
import { wSolToSolString, wsolToSolToken } from '@/utils/token'
import { TxErrorModal } from '@/components/Modal/TxErrorModal'
import { percentFormatter } from '@/utils/numberish/formatter'
import useFetchPoolByMint from '@/hooks/pool/useFetchPoolByMint'
import useBirdeyeTokenPrice from '@/hooks/token/useBirdeyeTokenPrice'
import CreateSuccessModal from './CreateSuccessModal'
import useInitPoolSchema from '../hooks/useInitPoolSchema'

export default function Initialize({ isAmmV4 }: { isAmmV4: boolean }) {
  const { t } = useTranslation()
  const tokenMap = useTokenStore((s) => s.tokenMap)
  const [inputMint, setInputMint] = useState<string>(PublicKey.default.toBase58())
  const [outputMint, setOutputMint] = useState<string>(RAYMint.toBase58())
  const [baseToken, quoteToken] = [tokenMap.get(inputMint), tokenMap.get(outputMint)]

  const [createPoolAct, newCreatedPool] = useLiquidityStore((s) => [s.createPoolAct, s.newCreatedPool], shallow)
  const createMarketAndPoolAct = useCreateMarketStore((s) => s.createMarketAndPoolAct)

  const [baseIn, setBaeIn] = useState(true)
  const [startDate, setStartDate] = useState<Date | undefined>()
  const { isOpen: isTxError, onOpen: onTxError, onClose: offTxError } = useDisclosure()
  const { isOpen: isLoading, onOpen: onLoading, onClose: offLoading } = useDisclosure()

  const { isOpen: isPopperOpen, onOpen: onPopperOpen, onClose: closePopper } = useDisclosure()
  const popperRef = useRef<HTMLDivElement>(null)
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
  const popper = usePopper(popperRef.current, popperElement, {
    placement: 'top-start'
  })
  const [tokenAmount, setTokenAmount] = useState<{ base: string; quote: string }>({ base: '', quote: '' })
  const [baseSymbol, quoteSymbol] = [wSolToSolString(baseToken?.symbol), wSolToSolString(quoteToken?.symbol)]

  const cpmmFeeConfigs = useLiquidityStore((s) => s.cpmmFeeConfigs)
  const clmmFeeOptions = Object.values(cpmmFeeConfigs)
  const poolKey = `${baseSymbol}-${quoteSymbol}`
  const [currentConfig, setCurrentConfig] = useState<ApiCpmmConfigInfo | undefined>()
  const [newPoolId, setNewPoolId] = useState<string | undefined>()

  const { data: tokenPrices = {}, isLoading: isPriceLoading } = useBirdeyeTokenPrice({
    mintList: [inputMint, outputMint]
  })

  const { data } = useFetchPoolByMint({
    shouldFetch: !!inputMint && !!outputMint,
    mint1: inputMint ? solToWSol(inputMint).toString() : '',
    mint2: outputMint ? solToWSol(outputMint || '').toString() : '',
    type: PoolFetchType.Standard
  })

  const existingPools: Map<string, string> = useMemo(
    () =>
      (data || [])
        .filter((pool) => {
          const [token1Mint, token2Mint] = [
            inputMint ? solToWSol(inputMint).toString() : '',
            outputMint ? solToWSol(outputMint || '').toString() : ''
          ]
          return (
            pool.programId === CREATE_CPMM_POOL_PROGRAM.toBase58() &&
            ((pool.mintA?.address === token1Mint && pool.mintB?.address === token2Mint) ||
              (pool.mintA?.address === token2Mint && pool.mintB?.address === token1Mint))
          )
        })
        .reduce((acc, cur) => acc.set(cur.id, (cur as unknown as ApiV3PoolInfoStandardItemCpmm).config.id), new Map()),
    [inputMint, outputMint, data]
  )

  const isSelectedExisted = !!currentConfig && new Set(existingPools.values()).has(currentConfig.id)
  useEffect(() => () => setCurrentConfig(undefined), [poolKey, isSelectedExisted])
  useEffect(() => {
    const defaultConfig = Object.values(cpmmFeeConfigs || {}).find((c) => c.tradeFeeRate === 2500)
    if (!new Set(existingPools.values()).has(defaultConfig?.id || '')) {
      if (defaultConfig) setCurrentConfig(defaultConfig)
    }
  }, [poolKey, existingPools, cpmmFeeConfigs])

  const [startDateMode, setStartDateMode] = useState<'now' | 'custom'>('now')
  const isStartNow = startDateMode === 'now'

  const initialPrice =
    new Decimal(tokenAmount.base || 0).lte(0) || new Decimal(tokenAmount.quote || 0).lte(0)
      ? ''
      : new Decimal(tokenAmount[baseIn ? 'quote' : 'base'] || 0)
          .div(tokenAmount[baseIn ? 'base' : 'quote'] || 1)
          .toDecimalPlaces(baseToken?.decimals ?? 6)
          .toString()

  const currentPrice =
    !tokenPrices[inputMint] || !tokenPrices[outputMint]
      ? ''
      : new Decimal(tokenPrices[baseIn ? inputMint : outputMint].value || 0)
          .div(tokenPrices[baseIn ? outputMint : inputMint].value || 1)
          .toDecimalPlaces(baseToken?.decimals ?? 6)
          .toString()

  const error = useInitPoolSchema({ baseToken, quoteToken, tokenAmount, startTime: startDate, feeConfig: currentConfig, isAmmV4 })

  useEffect(
    () => () => {
      useLiquidityStore.setState({ newCreatedPool: undefined })
      setNewPoolId(undefined)
    },
    []
  )

  const handleSelectToken = useCallback(
    (token: TokenInfo | ApiV3Token, side?: 'input' | 'output') => {
      if (side === 'input') {
        setInputMint(token.address)
        setOutputMint((mint) => (token.address === mint ? '' : mint))
      }
      if (side === 'output') {
        setOutputMint(token.address)
        setInputMint((mint) => (token.address === mint ? '' : mint))
      }
    },
    [inputMint, outputMint]
  )

  const onInitializeClick = () => {
    onLoading()
    if (isAmmV4) {
      let poolId = ''
      createMarketAndPoolAct({
        t,
        baseToken: solToWSolToken(baseToken!),
        quoteToken: solToWSolToken(quoteToken!),
        baseAmount: new Decimal(tokenAmount.base).mul(10 ** baseToken!.decimals).toFixed(0),
        quoteAmount: new Decimal(tokenAmount.quote).mul(10 ** quoteToken!.decimals).toFixed(0),
        startTime: startDate,
        onSent: (data) => {
          poolId = data.ammId.toBase58()
          return poolId
        },
        onConfirmed: () => setNewPoolId(poolId),
        onError: onTxError,
        onFinally: offLoading
      })
      return
    }
    createPoolAct({
      pool: {
        mintA: solToWSolToken(baseToken!),
        mintB: solToWSolToken(quoteToken!),
        feeConfig: currentConfig!
      },
      baseAmount: new Decimal(tokenAmount.base).mul(10 ** baseToken!.decimals).toFixed(0),
      quoteAmount: new Decimal(tokenAmount.quote).mul(10 ** quoteToken!.decimals).toFixed(0),
      startTime: startDate,
      onError: onTxError,
      onFinally: offLoading
    })
  }

  return (
    <VStack borderRadius="20px" w="full" bg={colors.backgroundLight} p={6} spacing={5}>
      {/* initial liquidity */}
      <Flex direction="column" w="full" align="flex-start" gap={4}>
        <Text fontWeight="medium" fontSize="sm">
          {t('Initial liquidity')}
        </Text>
        <Flex direction="column" w="full" align="center">
          <TokenInput
            ctrSx={{ w: '100%', textColor: colors.textTertiary }}
            topLeftLabel={t('Base token')}
            token={baseToken ? wsolToSolToken(baseToken) : undefined}
            value={tokenAmount.base}
            onChange={(val) => setTokenAmount((prev) => ({ ...prev, base: val }))}
            onTokenChange={(token) => handleSelectToken(token, 'input')}
          />
          <Box my="-10px" zIndex={1}>
            <AddLiquidityPlus />
          </Box>
          <TokenInput
            ctrSx={{ w: '100%', textColor: colors.textTertiary }}
            topLeftLabel={t('Quote token')}
            token={quoteToken ? wsolToSolToken(quoteToken) : undefined}
            value={tokenAmount.quote}
            onChange={(val) => setTokenAmount((prev) => ({ ...prev, quote: val }))}
            onTokenChange={(token) => handleSelectToken(token, 'output')}
          />
        </Flex>
      </Flex>

      <Flex direction="column" w="full" align="flex-start" gap={3}>
        <HStack gap={1}>
          <Text fontWeight="medium" fontSize="sm">
            {t('Initial price')}
          </Text>
          <QuestionToolTip
            iconType="question"
            label={t(
              'Initial price is set by the ratio of tokens deposited for initial liquidity. If the token is already trading on PancakeSwap, initial price will be auto-filled with the current price.'
            )}
          />
        </HStack>
        <DecimalInput
          postFixInField
          variant="filledDark"
          readonly
          value={initialPrice}
          inputSx={{ pl: '4px', fontWeight: 500, fontSize: ['md', 'xl'] }}
          ctrSx={{ bg: colors.backgroundDark, borderRadius: 'xl', pr: '14px', py: '6px' }}
          inputGroupSx={{ w: '100%', bg: colors.backgroundDark, alignItems: 'center', borderRadius: 'xl' }}
          postfix={
            <Text variant="label" size="sm" whiteSpace="nowrap" color={colors.textTertiary}>
              {baseIn ? quoteSymbol : baseSymbol}/{baseIn ? baseSymbol : quoteSymbol}
            </Text>
          }
        />
        <HStack spacing={1}>
          <Text fontWeight="400" fontSize="sm" color={colors.textTertiary}>
            {t('Current price')}:
          </Text>
          <Text pl={1} fontSize="sm" color={colors.textSecondary} fontWeight="medium" display="flex" alignItems="center" gap={1}>
            1 {baseIn ? baseSymbol : quoteSymbol} ≈ {isPriceLoading ? <Skeleton width={14} height={4} /> : currentPrice || '-'}{' '}
            {baseIn ? quoteSymbol : baseSymbol}
          </Text>
          <Box
            padding="1px"
            border={`1px solid ${colors.secondary}`}
            borderRadius="2px"
            width="fit-content"
            height="fit-content"
            lineHeight={0}
          >
            <HorizontalSwitchSmallIcon fill={colors.secondary} cursor="pointer" onClick={() => setBaeIn((val) => !val)} />
          </Box>
        </HStack>
      </Flex>
      {isAmmV4 ? null : (
        <Flex direction="column" w="full" align="flex-start" gap={3}>
          <Text fontWeight="medium" fontSize="sm">
            {t('Fee Tier')}
          </Text>
          <Flex w="full" gap="2">
            <Select
              variant="filledDark"
              items={clmmFeeOptions}
              value={currentConfig}
              renderItem={(v, idx) => {
                if (v) {
                  const existed = new Set(existingPools.values()).has(v.id)
                  const selected = currentConfig?.id === v.id
                  const isLastItem = idx === clmmFeeOptions.length - 1
                  return (
                    <HStack
                      color={colors.textPrimary}
                      opacity={existed ? 0.5 : 1}
                      cursor={existed ? 'not-allowed' : 'pointer'}
                      justifyContent="space-between"
                      mx={4}
                      py={2.5}
                      fontSize="sm"
                      borderBottom={isLastItem ? 'none' : `1px solid ${colors.buttonBg01}`}
                      _hover={{
                        borderBottom: '1px solid transparent'
                      }}
                    >
                      <Text>{percentFormatter.format(v.tradeFeeRate / 1000000)}</Text>
                      {selected && <SubtractIcon />}
                    </HStack>
                  )
                }
                return null
              }}
              renderTriggerItem={(v) => (v ? <Text fontSize="sm">{percentFormatter.format(v.tradeFeeRate / 1000000)}</Text> : null)}
              onChange={(val) => {
                setCurrentConfig(val)
                const existed = new Set(existingPools.values()).has(val.id)
                const selected = currentConfig?.id === val.id
                !existed && !selected && setCurrentConfig(val)
              }}
              sx={{
                w: 'full',
                height: '42px'
              }}
              popoverContentSx={{
                border: `1px solid ${colors.selectInactive}`,
                py: 0
              }}
              popoverItemSx={{
                p: 0,
                lineHeight: '18px',
                _hover: {
                  bg: colors.modalContainerBg
                }
              }}
              icons={{
                open: <ChevronUp color={colors.textSecondary} opacity="0.5" />,
                close: <ChevronDown color={colors.textSecondary} opacity="0.5" />
              }}
            />
          </Flex>
        </Flex>
      )}
      {/* start time */}
      <Flex direction="column" w="full" gap={3}>
        <Text fontWeight="medium" textAlign="left" fontSize="sm">
          {t('Start time')}:
        </Text>
        <Tabs
          tabListSX={{ display: 'flex' }}
          tabItemSX={{ flex: 1, fontWeight: 400, fontSize: '12px', py: '4px' } as any}
          variant="subtle"
          value={startDateMode}
          onChange={(val) => {
            setStartDateMode(val)
            if (val === 'now') setStartDate(undefined)
            else setStartDate(dayjs().add(10, 'minutes').toDate())
          }}
          items={[
            {
              value: 'now',
              label: t('Start Now')
            },
            {
              value: 'custom',
              label: t('Custom')
            }
          ]}
        />
        {isStartNow ? null : (
          <div ref={popperRef}>
            <DecimalInput
              postFixInField
              readonly
              onClick={onPopperOpen}
              variant="filledDark"
              value={startDate ? dayjs(startDate).format('YYYY/MM/DD') : ''}
              ctrSx={{ bg: colors.backgroundDark, borderRadius: 'xl', pr: '14px', py: '6px' }}
              inputGroupSx={{ w: 'fit-content', bg: colors.backgroundDark, alignItems: 'center', borderRadius: 'xl' }}
              inputSx={{ pl: '4px', fontWeight: 500, fontSize: ['md', 'xl'] }}
              postfix={
                <Text variant="label" size="sm" whiteSpace="nowrap" fontSize="xl" color={colors.textSecondary}>
                  {startDate ? dayjs(startDate).utc().format('HH:mm (UTC)') : ''}
                </Text>
              }
            />
            {isPopperOpen && (
              <FocusTrap
                active
                focusTrapOptions={{
                  initialFocus: false,
                  allowOutsideClick: true,
                  clickOutsideDeactivates: true,
                  onDeactivate: closePopper
                }}
              >
                <Box
                  tabIndex={-1}
                  style={{
                    ...popper.styles.popper,
                    zIndex: 3
                  }}
                  className="dialog-sheet"
                  {...popper.attributes.popper}
                  ref={setPopperElement}
                  role="dialog"
                  aria-label="DayPicker calendar"
                  bg={colors.backgroundDark}
                  rounded="xl"
                >
                  <DatePick
                    initialFocus={isPopperOpen}
                    mode="single"
                    selected={startDate || new Date()}
                    onSelect={(val) =>
                      setStartDate((preVal) =>
                        dayjs(val)
                          .set('hour', dayjs(preVal).hour())
                          .set(
                            'minute',
                            dayjs(preVal)
                              .add(preVal ? 0 : 10, 'minutes')
                              .minute()
                          )
                          .toDate()
                      )
                    }
                  />
                  <Flex>
                    <HourPick
                      sx={{ w: '100%', borderRadius: '0', fontSize: 'md', px: '20px' }}
                      value={dayjs(startDate).hour()}
                      onChange={(h) => setStartDate((val) => dayjs(val).set('h', h).toDate())}
                    />
                    <MinutePick
                      sx={{ w: '100%', borderRadius: '0', fontSize: 'md', px: '20px' }}
                      value={dayjs(startDate).minute()}
                      onChange={(m) => setStartDate((val) => dayjs(val).set('m', m).toDate())}
                    />
                  </Flex>
                  <Flex bg={colors.backgroundDark} px="10px" justifyContent="flex-end" borderRadius="0 0 10px 10px">
                    <Button variant="outline" size="sm" onClick={closePopper}>
                      {t('Confirm')}
                    </Button>
                  </Flex>
                </Box>
              </FocusTrap>
            )}
          </div>
        )}
        <HStack color={colors.semanticWarning}>
          <Text fontWeight="medium" fontSize="sm" my="-2">
            {isAmmV4
              ? t('Note: A creation fee of %subject% SOL is required for new pools.', { subject: '~0.45' })
              : t('Note: A creation fee of %subject% SOL is required for new pools.', { subject: '~0.2' })}
          </Text>
          <QuestionToolTip
            iconType="question"
            label={
              isAmmV4
                ? t(
                    'A pool creation fee of 0.15 SOL is currently reserved to support front and backend infrastructure. Approximately 0.3 SOL is required for OpenBook Market rent and program account creation.'
                  )
                : t(
                    'A pool creation fee of 0.15 SOL is currently reserved to support front and backend infrastructure. Approximately 0.05 SOL is required for program account creation and network fees.'
                  )
            }
          />
        </HStack>
        <Text color="red" my="-2">
          {tokenAmount.base || tokenAmount.quote ? error : ''}
        </Text>
      </Flex>
      <HStack w="full" spacing={4} mt={2}>
        <Button w="full" isLoading={isLoading} isDisabled={!!error} onClick={onInitializeClick}>
          {t('Initialize Liquidity Pool')}
        </Button>
      </HStack>
      {newCreatedPool || newPoolId ? <CreateSuccessModal ammId={newCreatedPool ? newCreatedPool.poolId.toString() : newPoolId!} /> : null}
      <TxErrorModal description="Failed to create pool. Please try again later." isOpen={isTxError} onClose={offTxError} />
    </VStack>
  )
}
