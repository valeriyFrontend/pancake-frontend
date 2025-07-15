import { useTranslation } from '@pancakeswap/localization'
import { Currency, CurrencyAmount } from '@pancakeswap/sdk'
import { Column, Text, useMatchBreakpoints } from '@pancakeswap/uikit'
import { formatAmount } from '@pancakeswap/utils/formatFractions'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'

import CurrencyInputPanelSimplify from 'components/CurrencyInputPanelSimplify'
import { CommonBasesType } from 'components/SearchModal/types'
import { useCurrency } from 'hooks/Tokens'
import { Field, replaceSwapState } from 'state/swap/actions'
import { queryParametersToSwapState, useSwapState } from 'state/swap/hooks'
import { useSwapActionHandlers } from 'state/swap/useSwapActionHandlers'

import { SwapUIV2 } from '@pancakeswap/widgets-internal'
import { useActiveChainId } from 'hooks/useActiveChainId'
import useNativeCurrency from 'hooks/useNativeCurrency'
import { useSwitchNetwork } from 'hooks/useSwitchNetwork'
import { useAtom } from 'jotai'
import { useRouter } from 'next/router'
import { swapReducerAtom } from 'state/swap/reducer'
import { useBridgeAvailableRoutes } from 'views/Swap/Bridge/hooks/useBridgeAvailableRoutes'
import { getDefaultToken } from 'views/Swap/utils'
import { useIsWrapping } from '../../Swap/V3Swap/hooks'
import useWarningImport from '../../Swap/hooks/useWarningImport'
import { FlipButton } from './FlipButton'

interface Props {
  inputAmount?: CurrencyAmount<Currency>
  outputAmount?: CurrencyAmount<Currency>
  tradeLoading?: boolean
  pricingAndSlippage?: ReactNode
  swapCommitButton?: ReactNode
  isUserInsufficientBalance?: boolean
}

export function FormMainForHomePage({ inputAmount, outputAmount, tradeLoading }: Props) {
  const { t } = useTranslation()
  const warningSwapHandler = useWarningImport()
  const { isMobile } = useMatchBreakpoints()
  const {
    independentField,
    typedValue,
    [Field.INPUT]: { currencyId: inputCurrencyId, chainId: inputChainId },
    [Field.OUTPUT]: { currencyId: outputCurrencyId, chainId: outputChainId },
  } = useSwapState()
  const isWrapping = useIsWrapping()
  const inputCurrency = useCurrency(inputCurrencyId, inputChainId)
  const outputCurrency = useCurrency(outputCurrencyId, outputChainId)
  const { onCurrencySelection, onUserInput } = useSwapActionHandlers()

  useDefaults()
  const handleTypeInput = useCallback((value: string) => onUserInput(Field.INPUT, value), [onUserInput])
  const handleTypeOutput = useCallback((value: string) => onUserInput(Field.OUTPUT, value), [onUserInput])

  const supportedBridgeChains = useBridgeAvailableRoutes()

  const { canSwitch, switchNetwork } = useSwitchNetwork()

  const handleCurrencySelect = useCallback(
    (newCurrency: Currency, field: Field) => {
      const isInput = field === Field.INPUT

      if (isInput) {
        const isOutputChainSupported =
          outputChainId &&
          supportedBridgeChains.data?.some(
            (route) => route.originChainId === newCurrency.chainId && route.destinationChainId === outputChainId,
          )

        if (!isOutputChainSupported) {
          // if output chain is not supported, reset output currency
          onCurrencySelection(Field.OUTPUT, {
            address: getDefaultToken(newCurrency.chainId),
            chainId: newCurrency.chainId,
          } as Currency)
        }

        if (canSwitch) {
          switchNetwork(newCurrency.chainId)
        }
      }

      onCurrencySelection(field, newCurrency)
      warningSwapHandler(newCurrency)
    },
    [onCurrencySelection, warningSwapHandler, outputChainId, supportedBridgeChains.data, canSwitch, switchNetwork],
  )
  const handleInputSelect = useCallback(
    (newCurrency: Currency) => handleCurrencySelect(newCurrency, Field.INPUT),
    [handleCurrencySelect],
  )
  const handleOutputSelect = useCallback(
    (newCurrency: Currency) => handleCurrencySelect(newCurrency, Field.OUTPUT),
    [handleCurrencySelect],
  )

  const isTypingInput = independentField === Field.INPUT
  const inputValue = useMemo(
    () => typedValue && (isTypingInput ? typedValue : formatAmount(inputAmount) || ''),
    [typedValue, isTypingInput, inputAmount],
  )
  const outputValue = useMemo(
    () => typedValue && (isTypingInput ? formatAmount(outputAmount) || '' : typedValue),
    [typedValue, isTypingInput, outputAmount],
  )
  const inputLoading = typedValue ? !isTypingInput && tradeLoading : false
  const outputLoading = typedValue ? isTypingInput && tradeLoading : false

  return (
    <SwapUIV2.InputPanelWrapper id="swap-page">
      <Column gap={isMobile ? '0px' : 'sm'}>
        <CurrencyInputPanelSimplify
          id="swap-currency-input"
          showUSDPrice
          showMaxButton
          showCommonBases
          topOptions={{
            show: !isMobile,
            walletDisplay: false,
          }}
          inputLoading={!isWrapping && inputLoading}
          defaultValue={isWrapping ? typedValue : inputValue}
          currency={inputCurrency}
          onUserInput={handleTypeInput}
          onCurrencySelect={handleInputSelect}
          otherCurrency={outputCurrency}
          commonBasesType={CommonBasesType.SWAP_LIMITORDER}
          title={
            <Text color="textSubtle" fontSize={12} bold>
              {t('From')}
            </Text>
          }
          showSearchHeader
          modalTitle={t('From')}
        />
        <FlipButton compact={isMobile} replaceBrowser={false} />
        <CurrencyInputPanelSimplify
          id="swap-currency-output"
          showUSDPrice
          showCommonBases
          showMaxButton={false}
          inputLoading={!isWrapping && outputLoading}
          defaultValue={isWrapping ? typedValue : outputValue}
          currency={outputCurrency}
          onUserInput={handleTypeOutput}
          onCurrencySelect={handleOutputSelect}
          otherCurrency={inputCurrency}
          commonBasesType={CommonBasesType.SWAP_LIMITORDER}
          topOptions={{
            show: !isMobile,
            walletDisplay: false,
          }}
          title={
            <Text color="textSubtle" fontSize={12} bold>
              {t('To')}
            </Text>
          }
          showSearchHeader
          modalTitle={t('To')}
        />
      </Column>
    </SwapUIV2.InputPanelWrapper>
  )
}

function useDefaults(): { inputCurrencyId: string | undefined; outputCurrencyId: string | undefined } | undefined {
  const { chainId } = useActiveChainId()
  const [, dispatch] = useAtom(swapReducerAtom)
  const native = useNativeCurrency()
  const { isReady } = useRouter()
  const [result, setResult] = useState<
    { inputCurrencyId: string | undefined; outputCurrencyId: string | undefined } | undefined
  >()

  useEffect(() => {
    if (!chainId || !native || !isReady) return

    const parsed = queryParametersToSwapState({}, native.symbol, getDefaultToken(chainId))

    dispatch(
      replaceSwapState({
        typedValue: parsed.typedValue,
        field: parsed.independentField,
        inputCurrencyId: parsed[Field.INPUT].currencyId,
        outputCurrencyId: parsed[Field.OUTPUT].currencyId,
        inputChainId: parsed[Field.INPUT].chainId || chainId,
        outputChainId: parsed[Field.OUTPUT].chainId || chainId,
        recipient: null,
      }),
    )
    setResult({ inputCurrencyId: parsed[Field.INPUT].currencyId, outputCurrencyId: parsed[Field.OUTPUT].currencyId })
  }, [dispatch, chainId, native, isReady])

  return result
}
