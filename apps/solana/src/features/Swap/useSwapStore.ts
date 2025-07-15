import { PublicKey, VersionedTransaction, Transaction, SignatureResult } from '@solana/web3.js'
import { TxVersion, txToBase64, SOL_INFO } from '@pancakeswap/solana-core-sdk'
import Decimal from 'decimal.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token-0.4'
import { TranslateFunction } from '@pancakeswap/localization'
import { createStore, useAppStore, useTokenAccountStore, useTokenStore } from '@/store'
import { toastSubject } from '@/hooks/toast/useGlobalToast'
import { txStatusSubject, TOAST_DURATION } from '@/hooks/toast/useTxStatus'
import { isSolWSol, getMintSymbol } from '@/utils/token'
import axios from '@/api/axios'
import { formatLocaleStr, trimTailingZero } from '@/utils/numberish/formatter'
import { TxCallbackProps } from '@/types/tx'
import { fetchComputePrice } from '@/utils/tx/computeBudget'
import { getDefaultToastData, handleMultiTxToast, transformProcessData } from '@/hooks/toast/multiToastUtil'
import { handleMultiTxRetry } from '@/hooks/toast/retryTx'
import { isSwapSlippageError } from '@/utils/tx/swapError'
import { quoteApi } from '@/utils/config/endpoint'
import { getTxMeta } from './swapMeta'
import { ApiSuccessResponse, QuoteResponseData } from './type'

const getSwapComputePrice = async () => {
  const transactionFee = useAppStore.getState().getPriorityFee()
  if (Number.isNaN(parseFloat(String(transactionFee) || ''))) {
    const json = await fetchComputePrice()
    const { avg } = json?.[15] ?? {}
    if (!avg) return undefined
    return {
      units: 600000,
      microLamports: avg
    }
  }
  return {
    units: 600000,
    microLamports: new Decimal(transactionFee as string)
      .mul(10 ** SOL_INFO.decimals)
      .toDecimalPlaces(0)
      .toNumber()
  }
}

interface SwapStore {
  slippage: number
  swapTokenAct: (
    props: {
      t: TranslateFunction
      swapResponse: ApiSuccessResponse<QuoteResponseData>
      wrapSol?: boolean
      unwrapSol?: boolean
      onCloseToast?: () => void
    } & TxCallbackProps
  ) => Promise<string | string[] | undefined>
  unWrapSolAct: (props: {
    t: TranslateFunction
    amount: string
    onClose?: () => void
    onSent?: () => void
    onError?: () => void
  }) => Promise<string | undefined>
  wrapSolAct: (amount: string) => Promise<string | undefined>
}

export interface ComputeParams {
  inputMint: string
  outputMint: string
  amount: string
}

export const SWAP_SLIPPAGE_KEY = '_r_swap_slippage_'
const initSwapState = {
  slippage: 0.005
}

export const useSwapStore = createStore<SwapStore>(
  () => ({
    ...initSwapState,

    swapTokenAct: async ({ t, swapResponse, wrapSol, unwrapSol = false, onCloseToast, ...txProps }) => {
      const { publicKey, raydium, txVersion, connection, signAllTransactions, urlConfigs } = useAppStore.getState()
      if (!raydium || !connection) {
        console.error('no connection')
        return
      }
      if (!publicKey || !signAllTransactions) {
        console.error('no wallet')
        return
      }

      try {
        const { tokenMap } = useTokenStore.getState()
        const [inputToken, outputToken] = [tokenMap.get(swapResponse.data.inputMint)!, tokenMap.get(swapResponse.data.outputMint)!]
        const [isInputSol, isOutputSol] = [wrapSol && isSolWSol(swapResponse.data.inputMint), isSolWSol(swapResponse.data.outputMint)]

        const inputTokenAcc = await raydium.account.getCreatedTokenAccount({
          programId: new PublicKey(inputToken.programId ?? TOKEN_PROGRAM_ID),
          mint: new PublicKey(inputToken.address),
          associatedOnly: false
        })

        if (!inputTokenAcc && !isInputSol) {
          console.error('no input token acc')
          return
        }

        const outputTokenAcc = await raydium.account.getCreatedTokenAccount({
          programId: new PublicKey(outputToken.programId ?? TOKEN_PROGRAM_ID),
          mint: new PublicKey(outputToken.address)
        })

        const computeData = await getSwapComputePrice()

        const {
          data,
          success
        }: {
          // id: string
          success: true
          // version: 'V1'
          message?: string
          data?: [{ transaction: string }]
        } = await axios.post(`${quoteApi}/api/swap`, {
          wallet: publicKey.toBase58(),
          computeUnitPriceMicroLamports: new Decimal(computeData?.microLamports || 0).toNumber(),
          swapResponse: swapResponse.data,
          wrapSol: isInputSol,
          unwrapSol,
          inputAccount: isInputSol ? undefined : inputTokenAcc?.toBase58(),
          outputAccount: isOutputSol ? undefined : outputTokenAcc?.toBase58()
        })
        if (!success) {
          toastSubject.next({
            title: 'Make Transaction Error',
            description: 'Please try again, or contact us on discord',
            status: 'error'
          })
          onCloseToast && onCloseToast()
          txProps?.onError?.('Make Transaction Error from swap api')
          return
        }

        const swapTransactions = data || []
        const allTxBuf = swapTransactions.map((tx) => Buffer.from(tx.transaction, 'base64'))
        // const allTx = allTxBuf.map((txBuf) => Transaction.from(txBuf))
        const allTx = allTxBuf.map((txBuf) => VersionedTransaction.deserialize(txBuf as any))

        const signedTxs = await signAllTransactions(allTx)

        console.log('simulate tx string:', signedTxs.map(txToBase64))

        const txLength = signedTxs.length
        const { toastId, handler } = getDefaultToastData({
          txLength,
          ...txProps
        })

        const swapMeta = getTxMeta({
          t,
          // action: 'swap',
          values: {
            amountA: formatLocaleStr(
              new Decimal(swapResponse.data.inputAmount).div(10 ** (inputToken.decimals || 0)).toString(),
              inputToken.decimals
            )!,
            symbolA: getMintSymbol({ mint: inputToken, transformSol: wrapSol }),
            amountB: formatLocaleStr(
              new Decimal(swapResponse.data.outputAmount).div(10 ** (outputToken.decimals || 0)).toString(),
              outputToken.decimals
            )!,
            symbolB: getMintSymbol({ mint: outputToken, transformSol: unwrapSol })
          }
        })

        const processedId: {
          txId: string
          status: 'success' | 'error' | 'sent'
          signedTx: Transaction | VersionedTransaction
        }[] = []

        const getSubTxTitle = (idx: number) => {
          return idx === 0 ? t('Setup') : idx === processedId.length - 1 && processedId.length > 2 ? t('Cleanup') : t('Swap')
        }

        let i = 0
        const checkSendTx = async (): Promise<void> => {
          if (!signedTxs[i]) return
          const tx = signedTxs[i]

          const txId = await connection.sendTransaction(tx as VersionedTransaction, { skipPreflight: true, maxRetries: 0 })
          processedId.push({ txId, signedTx: tx, status: 'sent' })

          if (signedTxs.length === 1) {
            txStatusSubject.next({
              txId,
              ...swapMeta,
              signedTx: tx,
              onClose: onCloseToast,
              isSwap: true,
              mintInfo: [inputToken, outputToken],
              ...txProps
            })
            return
          }
          let timeout = 0
          let intervalId = 0
          let intervalCount = 0

          const cbk = (signatureResult: SignatureResult) => {
            window.clearTimeout(timeout)
            window.clearInterval(intervalId)
            const targetTxIdx = processedId.findIndex((tx) => tx.txId === txId)
            if (targetTxIdx > -1) processedId[targetTxIdx].status = signatureResult.err ? 'error' : 'success'
            handleMultiTxRetry(processedId)
            const isSlippageError = isSwapSlippageError(signatureResult)
            handleMultiTxToast({
              t,
              toastId,
              processedId: processedId.map((p) => ({ ...p, status: p.status === 'sent' ? 'info' : p.status })),
              txLength,
              meta: {
                ...swapMeta,
                title: isSlippageError ? t('Swap failed due to slippage error!')! : swapMeta.title,
                description: isSlippageError
                  ? t('Slippage has exceeded user settings. Try again or adjust your slippage tolerance.')!
                  : swapMeta.description
              },
              isSwap: true,
              handler,
              getSubTxTitle,
              onCloseToast
            })
            if (!signatureResult.err) checkSendTx()
          }

          const subId = connection.onSignature(txId, cbk, 'processed')
          connection.getSignatureStatuses([txId])

          intervalId = window.setInterval(async () => {
            const targetTxIdx = processedId.findIndex((tx) => tx.txId === txId)
            if (intervalCount++ > TOAST_DURATION / 2000 || processedId[targetTxIdx].status !== 'sent') {
              window.clearInterval(intervalId)
              return
            }
            try {
              const r = await connection.getTransaction(txId, { commitment: 'confirmed', maxSupportedTransactionVersion: TxVersion.V0 })
              if (r) {
                console.log('tx status from getTransaction:', txId)
                cbk({ err: r.meta?.err || null })
                window.clearInterval(intervalId)
                useTokenAccountStore.getState().fetchTokenAccountAct({ commitment: useAppStore.getState().commitment })
              }
            } catch (e) {
              console.error('getTransaction timeout:', e, txId)
              window.clearInterval(intervalId)
            }
          }, 2000)

          handleMultiTxRetry(processedId)
          handleMultiTxToast({
            t,
            toastId,
            processedId: processedId.map((p) => ({ ...p, status: p.status === 'sent' ? 'info' : p.status })),
            txLength,
            meta: swapMeta,
            isSwap: true,
            handler,
            getSubTxTitle,
            onCloseToast
          })

          timeout = window.setTimeout(() => {
            connection.removeSignatureListener(subId)
          }, TOAST_DURATION)

          i++
        }
        checkSendTx()
      } catch (e: any) {
        txProps.onError?.(e)
        if (e.message !== 'tx failed')
          toastSubject.next({ txError: typeof e === 'string' ? new Error(e) : e, title: 'Swap', description: 'Send transaction failed' })
      } finally {
        txProps.onFinally?.()
      }
      return ''
    },

    unWrapSolAct: async ({ t, amount, onSent, onError, ...txProps }): Promise<string | undefined> => {
      const { raydium } = useAppStore.getState()
      const { txVersion } = useAppStore.getState()
      if (!raydium) return
      const { execute, builder } = await raydium.tradeV2.unWrapWSol({
        amount
        // computeBudgetConfig: await getComputeBudgetConfig()
      })

      if (builder.allInstructions.length > 12) {
        const { execute: multiExecute, transactions } =
          txVersion === TxVersion.LEGACY ? await builder.sizeCheckBuild() : await builder.sizeCheckBuildV0()

        const txLength = transactions.length
        const { toastId, processedId, handler } = getDefaultToastData({
          txLength,
          ...txProps
        })

        const meta = {
          title: t('Unwrapped all WSOL'),
          description: t('Unwrapped WSOL to SOL'),
          txHistoryTitle: t('Unwrapped all WSOL'),
          txHistoryDesc: t('Unwrapped WSOL to SOL'),
          txValues: {}
        }

        const getSubTxTitle = () => t('Unwrapped WSOL to SOL')
        multiExecute({
          sequentially: true,
          onTxUpdate: (data) => {
            handleMultiTxRetry(data)
            handleMultiTxToast({
              t,
              toastId,
              processedId: transformProcessData({ processedId, data }),
              txLength,
              meta,
              handler,
              getSubTxTitle
            })
          }
        })
          .then(() => {
            handleMultiTxToast({
              t,
              toastId,
              processedId: transformProcessData({ processedId, data: [] }),
              txLength,
              meta,
              handler,
              getSubTxTitle
            })
            return { txId: '' }
          })
          .catch((e) => {
            toastSubject.next({ txError: e, ...meta })
            onError?.()
            return { txId: '' }
          })

        return ''
      }

      const values = { amount: trimTailingZero(new Decimal(amount).div(10 ** SOL_INFO.decimals).toFixed(SOL_INFO.decimals)) }
      const meta = {
        title: t('Unwrapped all WSOL'),
        description: t('Unwrapped total %amount% WSOL', values),
        txHistoryTitle: t('Unwrapped all WSOL'),
        txHistoryDesc: t('Unwrapped total %amount% WSOL', values),
        txValues: values
      }

      return execute()
        .then(({ txId, signedTx }) => {
          onSent?.()
          txStatusSubject.next({ txId, signedTx, ...meta, ...txProps })
          return txId
        })
        .catch((e) => {
          onError?.()
          toastSubject.next({ txError: e, ...meta })
          return ''
        })
    },

    wrapSolAct: async (amount: string): Promise<string | undefined> => {
      const { raydium } = useAppStore.getState()
      if (!raydium) return
      const { execute } = await raydium.tradeV2.wrapWSol(new Decimal(amount).mul(10 ** SOL_INFO.decimals).toFixed(0))
      return execute()
        .then(({ txId, signedTx }) => {
          txStatusSubject.next({ txId, signedTx })
          return txId
        })
        .catch((e) => {
          toastSubject.next({ txError: e, title: 'Wrap Sol' })
          return ''
        })
    }
  }),
  'useSwapStore'
)
