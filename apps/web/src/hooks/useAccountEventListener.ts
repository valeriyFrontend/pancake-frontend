import { watchAccount } from '@wagmi/core'
import { useCallback, useEffect, useMemo } from 'react'
import { useAppDispatch } from 'state'
import { clearUserStates } from 'utils/clearUserStates'
import { useAccount, useAccountEffect, useConfig } from 'wagmi'
import { useSwitchNetworkLocal } from './useSwitchNetwork'

export const useChainIdListener = () => {
  const switchNetworkCallback = useSwitchNetworkLocal()
  const { chainId: oldChainId } = useAccount()
  const onChainChanged = useCallback(
    ({ chainId }: { chainId?: number }) => {
      if (chainId === undefined) return
      if (oldChainId === chainId) return
      switchNetworkCallback(chainId)
    },
    [switchNetworkCallback, oldChainId],
  )
  const { connector } = useAccount()

  useEffect(() => {
    connector?.emitter?.on('change', onChainChanged)

    return () => {
      connector?.emitter?.off('change', onChainChanged)
    }
  }, [connector, onChainChanged, oldChainId])
}

const useAddressListener = () => {
  const config = useConfig()
  const dispatch = useAppDispatch()
  const { chainId } = useAccount()

  useEffect(() => {
    return watchAccount(config as any, {
      onChange(data, prevData) {
        if (prevData.status === 'connected' && data.status === 'connected' && prevData.chainId === data.chainId) {
          clearUserStates(dispatch, { chainId })
        }
      },
    })
  }, [config, dispatch, chainId])
}

export const useAccountEventListener = () => {
  const dispatch = useAppDispatch()
  const { chainId } = useAccount()
  useChainIdListener()
  useAddressListener()

  useAccountEffect(
    useMemo(
      () => ({
        onDisconnect() {
          clearUserStates(dispatch, { chainId })
        },
      }),
      [chainId, dispatch],
    ),
  )
}
