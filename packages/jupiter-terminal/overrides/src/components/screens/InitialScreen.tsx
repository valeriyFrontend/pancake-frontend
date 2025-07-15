import { TokenInfo } from '@solana/spl-token-registry'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { useScreenState } from 'src/contexts/ScreenProvider'
import { useSwapContext } from 'src/contexts/SwapContext'
import Form from '../../components/Form'
import FormPairSelector from '../../components/FormPairSelector'
import { useTokenContext } from '../../contexts/TokenContextProvider'
import { useAccounts } from '../../contexts/accounts'
import UnknownTokenModal from '../UnknownTokenModal/UnknownTokenModal'
import { WRAPPED_SOL_MINT } from 'src/constants'
import Decimal from 'decimal.js'
import { cn } from 'src/misc/cn'

type SelectorType = 'fromMint' | 'toMint' | null

interface Props {
  isWalletModalOpen: boolean
  setIsWalletModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  selectPairSelector: SelectorType
  setSelectPairSelector: (type: SelectorType) => void
}

const InitialScreen = ({
  setIsWalletModalOpen,
  isWalletModalOpen,
  selectPairSelector,
  setSelectPairSelector,
}: Props) => {
  const { accounts, nativeAccount } = useAccounts()
  const { tokenMap } = useTokenContext()
  const {
    form,
    setForm,
    setErrors,
    quoteResponseMeta,
    formProps: { initialOutputMint, fixedOutputMint },
    loading,
  } = useSwapContext()
  const { setScreen } = useScreenState()

  const balance = useMemo(() => {
    if (form.fromMint === WRAPPED_SOL_MINT.toString()) return nativeAccount?.balance || 0
    return form.fromMint ? accounts[form.fromMint]?.balance || 0 : 0
  }, [accounts, form.fromMint, nativeAccount?.balance])

  const [isDisabled, setIsDisabled] = useState(false)
  useEffect(() => {
    if (!form.fromValue || !form.fromMint || !form.toMint || !form.toValue || !quoteResponseMeta || loading) {
      setErrors({})
      setIsDisabled(true)
      return
    }

    if (new Decimal(form.fromValue).gt(balance)) {
      setErrors({
        fromValue: { title: 'Insufficient balance', message: '' },
      })
      setIsDisabled(true)
      return
    }

    setErrors({})
    setIsDisabled(false)
  }, [form, balance, quoteResponseMeta, loading, setErrors])

  const [showUnknownToken, setShowUnknownToken] = useState<TokenInfo | null>(null)

  const onSelectMint = useCallback(
    (tokenInfo: TokenInfo, approved: boolean = false) => {
      const isUnknown = tokenInfo.tags?.length === 0
      if (isUnknown && approved === false) {
        setShowUnknownToken(tokenInfo)
        return
      }

      if (selectPairSelector === 'fromMint') {
        setForm((prev) => ({
          ...prev,
          fromMint: tokenInfo.address,
          fromValue: '',

          // Prevent same token to same token;
          ...(prev.toMint === tokenInfo.address ? { toMint: prev.fromMint } : undefined),
        }))
      } else {
        setForm((prev) => ({
          ...prev,
          toMint: tokenInfo.address,
          toValue: '',

          // Prevent same token to same token;
          ...(prev.fromMint === tokenInfo.address ? { fromMint: prev.toMint } : undefined),
        }))
      }
      setSelectPairSelector(null)
    },
    [selectPairSelector, setForm],
  )

  const availableMints: TokenInfo[] = useMemo(() => {
    let result = [...tokenMap.values()]
    // On fixedOutputMint, prevent user from selecting the same token as output
    if (fixedOutputMint) {
      result = result.filter((item) => item.address !== initialOutputMint)
    }

    return result
  }, [tokenMap, fixedOutputMint, initialOutputMint])

  const onSubmitToConfirmation = useCallback(() => {
    setScreen('Confirmation')
  }, [setScreen])

  return (
    <>
      {/* Body */}
      <form
        onSubmit={onSubmitToConfirmation}
        className={cn({
          hidden: Boolean(selectPairSelector),
        })}
      >
        <Form
          onSubmit={onSubmitToConfirmation}
          isDisabled={isDisabled}
          setSelectPairSelector={setSelectPairSelector}
          setIsWalletModalOpen={setIsWalletModalOpen}
        />
      </form>

      {selectPairSelector !== null ? (
        <div className="absolute top-0 left-0 h-full w-full rounded-lg overflow-hidden pcs-pair-selector-wrapper">
          <FormPairSelector
            onSubmit={onSelectMint}
            tokenInfos={availableMints}
            onClose={() => setSelectPairSelector(null)}
          />
        </div>
      ) : null}

      {showUnknownToken ? (
        <div className="absolute top-0 h-full w-full flex justify-center items-center rounded-lg overflow-hidden">
          <UnknownTokenModal
            tokensInfo={[showUnknownToken]}
            onClickAccept={() => {
              onSelectMint(showUnknownToken, true)
              setShowUnknownToken(null)
            }}
            onClickReject={() => setShowUnknownToken(null)}
          />
        </div>
      ) : null}
    </>
  )
}

export default InitialScreen
