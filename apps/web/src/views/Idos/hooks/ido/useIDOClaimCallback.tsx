import { useTranslation } from '@pancakeswap/localization'
import { useToast } from '@pancakeswap/uikit'
import { ToastDescriptionWithTx } from 'components/Toast'
import useAccountActiveChain from 'hooks/useAccountActiveChain'
import useCatchTxError from 'hooks/useCatchTxError'
import { useCallback } from 'react'
import { useLatestTxReceipt } from 'state/farmsV4/state/accountPositions/hooks/useLatestTxReceipt'
import { isUserRejected } from 'utils/sentry'
import { useIDOContract } from './useIDOContract'
import { useIDOUserInfo } from './useIDOUserInfo'

export const useIDOClaimCallback = () => {
  const idoContract = useIDOContract()
  const { t } = useTranslation()
  const { account } = useAccountActiveChain()
  const { toastSuccess, toastWarning } = useToast()
  const { fetchWithCatchTxError, loading: isPending } = useCatchTxError({ throwUserRejectError: true })
  const { refetch } = useIDOUserInfo()
  const [, setLatestTxReceipt] = useLatestTxReceipt()

  const claim = useCallback(
    async (pid: number, onFinish?: () => void) => {
      if (!account || !idoContract || (!pid && pid !== 0)) return
      try {
        const receipt = await fetchWithCatchTxError(() =>
          idoContract.write.harvestPool([pid], {
            account,
            chain: idoContract.chain,
          }),
        )
        if (receipt?.status) {
          setLatestTxReceipt(receipt)
          toastSuccess(t('Claim successful'), <ToastDescriptionWithTx txHash={receipt.transactionHash} />)
        }
      } catch (error) {
        if (isUserRejected(error)) {
          toastWarning(t('You canceled claim'))
        }
      } finally {
        refetch()
        onFinish?.()
      }
    },
    [account, idoContract, fetchWithCatchTxError, setLatestTxReceipt, toastSuccess, t, toastWarning, refetch],
  )

  return { claim, isPending }
}
