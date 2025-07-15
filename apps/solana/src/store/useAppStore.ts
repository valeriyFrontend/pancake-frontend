import { PancakeClmmProgramId } from '@pancakeswap/solana-clmm-sdk'
import {
  ALL_PROGRAM_ID,
  API_URL_CONFIG,
  API_URLS,
  AvailabilityCheckAPI3,
  JupTokenType,
  ProgramIdConfig,
  Raydium,
  RaydiumLoadParams,
  TokenInfo,
  TxVersion
} from '@pancakeswap/solana-core-sdk'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { Wallet } from '@solana/wallet-adapter-react'
import { clusterApiUrl, Commitment, Connection, EpochInfo, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'

import axios from '@/api/axios'
import { toastSubject } from '@/hooks/toast/useGlobalToast'
import { isProdEnv, retry } from '@/utils/common'
import { rpcs } from '@/utils/config/endpoint'
import { getStorageItem, setStorageItem } from '@/utils/localStorage'
import { isValidUrl } from '@/utils/url'

import { urlConfigs } from './configs/urls'
import createStore from './createStore'
// eslint-disable-next-line import/no-cycle
import { blackJupMintSet, useTokenStore } from './useTokenStore'

export const defaultNetWork = WalletAdapterNetwork.Mainnet // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
export const defaultEndpoint = clusterApiUrl(defaultNetWork) // You can also provide a custom RPC endpoint
export const APR_MODE_KEY = '_r_apr_'
export const EXPLORER_KEY = '_r_explorer_'
export const supportedExplorers = [
  {
    name: 'Solscan',
    icon: '/images/explorer-solscan.png',
    host: 'https://solscan.io'
  },
  {
    name: 'Explorer',
    icon: '/images/explorer-solana.png',
    host: 'https://explorer.solana.com'
  },
  {
    name: 'SolanaFM',
    icon: '/images/explorer-solanaFM.png',
    host: 'https://solana.fm'
  }
]

const RPC_URL_KEY = '_r_rpc_dev_'
const RPC_URL_PROD_KEY = '_r_rpc_prod_'
let isRpcLoading = false
export const FEE_KEY = '_r_fee_'
export const PRIORITY_LEVEL_KEY = '_r_fee_level_'
export const PRIORITY_MODE_KEY = '_r_fee_mode_'
export const USER_ADDED_KEY = '_r_u_added_'
export enum PriorityLevel {
  Fast,
  Turbo,
  Ultra
}
export enum PriorityMode {
  MaxCap,
  Exact
}

interface RpcItem {
  url: string
  ws?: string
  weight: number
  batch: boolean
  name: string
}

interface AppState {
  raydium?: Raydium
  connection?: Connection
  signAllTransactions?: (<T extends Transaction | VersionedTransaction>(transaction: T[]) => Promise<T[]>) | undefined
  publicKey?: PublicKey
  explorerUrl: string
  isMobile: boolean
  isDesktop: boolean
  aprMode: 'M' | 'D'
  wallet?: Wallet
  initialing: boolean
  connected: boolean
  chainTimeOffset: number
  blockSlotCountForSecond: number
  commitment: Commitment

  rpcNodeUrl?: string
  wsNodeUrl?: string
  rpcs: RpcItem[]
  urlConfigs: typeof API_URLS & {
    SWAP_HOST: string
    SWAP_COMPUTE: string
    SWAP_TX: string
    BIRDEYE_TOKEN_PRICE: string
    POOL_TVL_LINE: string
  }
  programIdConfig: typeof ALL_PROGRAM_ID

  jupTokenType: JupTokenType
  displayTokenSettings: { official: boolean; raydium: boolean; jup: boolean; userAdded: boolean }

  featureDisabled: Partial<AvailabilityCheckAPI3>

  epochInfo?: EpochInfo
  txVersion: TxVersion
  tokenAccLoaded: boolean

  appVersion: string
  needRefresh: boolean

  priorityLevel: PriorityLevel
  priorityMode: PriorityMode
  transactionFee?: string
  feeConfig: Partial<Record<PriorityLevel, number>>

  getPriorityFee: () => string | undefined
  getEpochInfo: () => Promise<EpochInfo | undefined>
  initRaydiumAct: (payload: RaydiumLoadParams) => Promise<void>
  fetchChainTimeAct: () => void
  fetchRpcsAct: () => Promise<void>
  fetchBlockSlotCountAct: () => Promise<void>
  setUrlConfigAct: (urls: API_URL_CONFIG) => void
  setProgramIdConfigAct: (urls: ProgramIdConfig) => void
  setRpcUrlAct: (url: string, skipToast?: boolean, skipError?: boolean) => Promise<boolean>
  setAprModeAct: (mode: 'M' | 'D') => void
  checkAppVersionAct: () => Promise<void>
  fetchPriorityFeeAct: () => Promise<void>
}

const appInitState = {
  raydium: undefined,
  initialing: false,
  connected: false,
  chainTimeOffset: 0,
  blockSlotCountForSecond: 0,
  explorerUrl: supportedExplorers[0].host,
  isMobile: false,
  isDesktop: false,
  aprMode: 'M' as 'M' | 'D',
  rpcs: [],
  urlConfigs,
  programIdConfig: {
    ...ALL_PROGRAM_ID,
    CLMM_PROGRAM_ID: PancakeClmmProgramId['mainnet-beta']
  },
  jupTokenType: JupTokenType.Strict,
  displayTokenSettings: {
    official: true,
    raydium: true,
    jup: true,
    userAdded: true
  },
  featureDisabled: {},
  appVersion: 'V3.0.2',
  txVersion: TxVersion.V0,
  needRefresh: false,
  tokenAccLoaded: false,
  commitment: 'confirmed' as Commitment,

  priorityLevel: PriorityLevel.Turbo,
  priorityMode: PriorityMode.MaxCap,
  feeConfig: {},
  transactionFee: '0.01'
}

let epochInfoCache = {
  time: 0,
  loading: false
}

export const useAppStore = createStore<AppState>(
  (set, get) => ({
    ...appInitState,
    initRaydiumAct: async (payload) => {
      const action = { type: 'initRaydiumAct' }
      const { initialing, urlConfigs, rpcNodeUrl, jupTokenType, displayTokenSettings } = get()
      if (initialing || !rpcNodeUrl) return
      const connection = payload.connection || new Connection(rpcNodeUrl)
      set({ initialing: true }, false, action)
      const isDev = window.location.host.match(/^localhost:\d+/)

      const raydium = await Raydium.load({
        ...payload,
        connection,
        urlConfigs,
        jupTokenType,
        logRequests: !isDev,
        disableFeatureCheck: true,
        loopMultiTxStatus: true,
        // cluster: 'devnet',
        blockhashCommitment: 'finalized'
      })
      useTokenStore.getState().extraLoadedTokenList.forEach((t) => {
        const existed = raydium.token.tokenMap.has(t.address)
        if (!existed) {
          raydium.token.tokenList.push(t)
          raydium.token.tokenMap.set(t.address, t)
          raydium.token.mintGroup.raydium.add(t.address)
        }
      })
      const tokenMap = new Map(Array.from(raydium.token.tokenMap))
      const tokenList = (JSON.parse(JSON.stringify(raydium.token.tokenList)) as TokenInfo[])
        .filter((t) => {
          if (blackJupMintSet.has(t.address)) {
            tokenMap.delete(t.address)
            raydium.token.tokenMap.delete(t.address)
            raydium.token.mintGroup.jup.delete(t.address)
            return false
          }
          return true
        })
        .map((t) => {
          if (t.type === 'jupiter') {
            const newInfo = { ...t, logoURI: t.logoURI ? `https://wsrv.nl/?fit=cover&w=48&h=48&url=${t.logoURI}` : t.logoURI }
            tokenMap.set(t.address, newInfo)
            return newInfo
          }
          return t
        })
      useTokenStore.setState(
        {
          tokenList,
          displayTokenList: tokenList.filter((token) => {
            return (
              (displayTokenSettings.official && raydium.token.mintGroup.official.has(token.address)) ||
              (displayTokenSettings.raydium && raydium.token.mintGroup.raydium.has(token.address)) ||
              (displayTokenSettings.jup && raydium.token.mintGroup.jup.has(token.address))
            )
          }),
          tokenMap,
          mintGroup: raydium.token.mintGroup,
          whiteListMap: new Set(Array.from(raydium.token.whiteListMap))
        },
        false,
        action
      )
      set({ raydium, initialing: false, connected: !!(payload.owner || get().publicKey) }, false, action)
      set(
        {
          featureDisabled: {
            swap: raydium.availability.swap === false,
            createConcentratedPosition: raydium.availability.createConcentratedPosition === false,
            addConcentratedPosition: raydium.availability.addConcentratedPosition === false,
            addStandardPosition: raydium.availability.addStandardPosition === false,
            removeConcentratedPosition: raydium.availability.removeConcentratedPosition === false,
            removeStandardPosition: raydium.availability.removeStandardPosition === false,
            addFarm: raydium.availability.addFarm === false,
            removeFarm: raydium.availability.removeFarm === false
          }
        },
        false,
        action
      )

      /* setTimeout(() => {
        get().fetchChainTimeAct()
      }, 1000) */
    },
    fetchChainTimeAct: () => {
      const { urlConfigs } = get()
      axios
        .get<{ offset: number }>(`${urlConfigs.BASE_HOST}${urlConfigs.CHAIN_TIME}`)
        .then((data) => {
          set({ chainTimeOffset: Number.isNaN(data?.data.offset) ? 0 : data.data.offset * 1000 }, false, { type: 'fetchChainTimeAct' })
        })
        .catch(() => {
          set({ chainTimeOffset: 0 }, false, { type: 'fetchChainTimeAct' })
        })
    },
    fetchBlockSlotCountAct: async () => {
      const { raydium, connection } = get()
      if (!raydium || !connection) return
      const res: {
        id: string
        jsonrpc: string
        result: { numSlots: number; numTransactions: number; samplePeriodSecs: number; slot: number }[]
      } = await axios.post(connection.rpcEndpoint, {
        id: 'getRecentPerformanceSamples',
        jsonrpc: '2.0',
        method: 'getRecentPerformanceSamples',
        params: [4]
      })
      const slotList = res.result.map((data) => data.numSlots)
      set({ blockSlotCountForSecond: slotList.reduce((a, b) => a + b, 0) / slotList.length / 60 }, false, {
        type: 'fetchBlockSlotCountAct'
      })
    },
    setUrlConfigAct: (urls) => {
      set({ urlConfigs: { ...get().urlConfigs, ...urls } }, false, { type: 'setUrlConfigAct' })
    },
    setProgramIdConfigAct: (urls) => {
      set({ programIdConfig: { ...get().programIdConfig, ...urls } }, false, { type: 'setProgramIdConfigAct' })
    },
    fetchRpcsAct: async () => {
      const { setRpcUrlAct } = get()
      try {
        set({ rpcs }, false, { type: 'fetchRpcsAct' })
        const localRpcNode: { rpcNode?: RpcItem; url?: string } = JSON.parse(
          getStorageItem(isProdEnv() ? RPC_URL_PROD_KEY : RPC_URL_KEY) || '{}'
        )

        let i = 0
        const checkAndSetRpcNode = async () => {
          const readyRpcs = [...rpcs]
          if (localRpcNode?.rpcNode) readyRpcs.sort((a) => (a.name === localRpcNode.rpcNode!.name ? -1 : 1))
          const success = await setRpcUrlAct(readyRpcs[i].url, true, i !== readyRpcs.length - 1)
          if (!success) {
            i++
            if (i < readyRpcs.length) {
              checkAndSetRpcNode()
            } else {
              console.error('All RPCs failed.')
            }
          }
        }

        if (localRpcNode && !localRpcNode.rpcNode && isValidUrl(localRpcNode.url)) {
          const success = await setRpcUrlAct(localRpcNode.url!, true, true)
          if (!success) checkAndSetRpcNode()
        } else {
          checkAndSetRpcNode()
        }
      } catch (e) {
        /**/
      }
    },
    setRpcUrlAct: async (url, skipToast, skipError) => {
      if (url === get().rpcNodeUrl) {
        toastSubject.next({
          status: 'info',
          title: 'Switch Rpc Node',
          description: 'Rpc node already in use'
        })
        return true
      }
      try {
        if (!isValidUrl(url)) throw new Error('invalid url')
        if (isRpcLoading) {
          toastSubject.next({
            status: 'warning',
            title: 'Switch Rpc Node',
            description: 'Validating Rpc node..'
          })
          return false
        }
        isRpcLoading = true
        await retry<Promise<EpochInfo>>(() => axios.post(url, { method: 'getEpochInfo' }, { skipError: true }), {
          retryCount: 3,
          onError: () => {
            isRpcLoading = false
          }
        })
        isRpcLoading = false
        const rpcNode = get().rpcs.find((r) => r.url === url)
        set({ rpcNodeUrl: url, wsNodeUrl: rpcNode?.ws, tokenAccLoaded: false }, false, { type: 'setRpcUrlAct' })
        setStorageItem(
          isProdEnv() ? RPC_URL_PROD_KEY : RPC_URL_KEY,
          JSON.stringify({
            rpcNode: rpcNode ? { ...rpcNode, url: '' } : undefined,
            url
          })
        )
        if (!skipToast)
          toastSubject.next({
            status: 'success',
            title: 'Switch Rpc Node Success',
            description: 'Rpc node switched'
          })
        return true
      } catch {
        if (!skipError)
          toastSubject.next({
            status: 'error',
            title: 'Switch Rpc Node error',
            description: 'Invalid rpc node'
          })
        return false
      }
    },
    setAprModeAct: (mode) => {
      setStorageItem(APR_MODE_KEY, mode)
      set({ aprMode: mode })
    },
    checkAppVersionAct: async () => {
      // const { urlConfigs, appVersion } = get()
      // const res = await axios.get<{
      //   latest: string
      //   least: string
      // }>(`${urlConfigs.BASE_HOST}${urlConfigs.VERSION}`)
      // set({ needRefresh: compare(appVersion, res.data.latest, '<') })
    },

    fetchPriorityFeeAct: async () => {
      const { urlConfigs } = get()
      const { data } = await axios.get<{
        default: {
          h: number
          m: number
          vh: number
        }
      }>(`${API_URLS.BASE_HOST}${urlConfigs.PRIORITY_FEE}`)
      set({
        feeConfig: {
          [PriorityLevel.Fast]: data.default.m / 10 ** 9,
          [PriorityLevel.Turbo]: data.default.h / 10 ** 9,
          [PriorityLevel.Ultra]: data.default.vh / 10 ** 9
        }
      })
    },

    getPriorityFee: () => {
      const { priorityMode, priorityLevel, transactionFee, feeConfig } = get()
      if (priorityMode === PriorityMode.Exact) return transactionFee ? String(transactionFee) : transactionFee
      if (feeConfig[priorityLevel] === undefined || transactionFee === undefined) return String(feeConfig[PriorityLevel.Turbo] ?? 0)
      return String(Math.min(Number(transactionFee), feeConfig[priorityLevel]!))
    },

    getEpochInfo: async () => {
      const [connection, epochInfo] = [get().connection, get().epochInfo]
      if (!connection) return undefined
      if (epochInfo && Date.now() - epochInfoCache.time <= 30 * 1000) return epochInfo
      if (epochInfoCache.loading) return epochInfo
      epochInfoCache.loading = true
      const newEpochInfo = await retry<Promise<EpochInfo>>(() => connection.getEpochInfo())
      epochInfoCache = { time: Date.now(), loading: false }
      set({ epochInfo: newEpochInfo }, false, { type: 'useAppStore.getEpochInfo' })
      return newEpochInfo
    },
    reset: () => set(appInitState)
  }),
  'useAppStore'
)
