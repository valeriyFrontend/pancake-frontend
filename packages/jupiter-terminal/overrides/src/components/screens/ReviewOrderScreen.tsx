import React, { useCallback } from 'react'
import { useScreenState } from 'src/contexts/ScreenProvider'
import { useSwapContext } from 'src/contexts/SwapContext'
import LeftArrowIcon from 'src/icons/LeftArrowIcon'
import useTimeDiff from '../useTimeDiff/useTimeDiff'
import PriceInfo from '../PriceInfo/index'
import JupButton from '../JupButton'
import V2SexyChameleonText from '../SexyChameleonText/V2SexyChameleonText'
import { cn } from 'src/misc/cn'

const ConfirmationScreen = () => {
  const {
    fromTokenInfo,
    toTokenInfo,
    onSubmit: onSubmitJupiter,
    quoteResponseMeta,
    loading,
    refresh,
  } = useSwapContext()

  const [hasExpired] = useTimeDiff()

  const { setScreen } = useScreenState()

  const onGoBack = () => {
    refresh()
    setScreen('Initial')
  }
  const onSubmit = useCallback(async () => {
    setScreen('Swapping')
    onSubmitJupiter()
  }, [onSubmitJupiter, setScreen])

  return (
    <div className="flex flex-col h-full w-full py-4 px-2">
      <div className="flex w-full justify-between">
        <div className="w-6 h-6 cursor-pointer" onClick={onGoBack}>
          <LeftArrowIcon width={24} height={24} />
        </div>

        <div className="">Review Order</div>

        <div className=" w-6 h-6" />
      </div>

      <div>
        {quoteResponseMeta && fromTokenInfo && toTokenInfo ? (
          <PriceInfo
            quoteResponse={quoteResponseMeta}
            fromTokenInfo={fromTokenInfo}
            toTokenInfo={toTokenInfo}
            loading={loading}
            showFullDetails
            containerClassName="border-none"
          />
        ) : null}
      </div>

      {hasExpired ? (
        <JupButton
          bgClass="pcs-refresh-button"
          size="lg"
          className="w-full mt-4 disabled:opacity-50 !p-0"
          type="button"
          onClick={onGoBack}
        >
          <span className="text-sm">Refresh</span>
        </JupButton>
      ) : (
        <JupButton
          bgClass="pcs-submit-button"
          size="lg"
          className={cn('w-full mt-4 disabled:opacity-50 leading-none !max-h-14 bg-gradient-to-r pcs-submit-button')}
          type="button"
          onClick={onSubmit}
        >
          <span>Confirm</span>
        </JupButton>
      )}
    </div>
  )
}

export default ConfirmationScreen
