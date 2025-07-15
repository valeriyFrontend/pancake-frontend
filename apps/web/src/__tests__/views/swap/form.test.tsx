import { describe, it, expect, vi } from 'vitest'
import { handleCurrencySelectFn } from 'views/SwapSimplify/InfinitySwap/FormMainInfinity'
import { Field } from 'state/swap/actions'
import { baseTokens, bscTokens } from '@pancakeswap/tokens'
import { ChainId } from '@pancakeswap/chains'
import { CHAIN_QUERY_NAME } from 'config/chains'

describe('handleCurrencySelect', () => {
  it('switches network and updates router when isInput && canSwitch', async () => {
    const switchNetworkAsync = vi.fn().mockResolvedValue(undefined)
    const replace = vi.fn()
    const replaceBrowserHistoryMultiple = vi.fn()

    const newCurrency = baseTokens.usdt

    const mockContext = {
      onCurrencySelection: vi.fn(),
      warningSwapHandler: vi.fn(),
      canSwitch: true,
      switchNetworkAsync,
      outputChainId: ChainId.BSC,
      supportedBridgeChains: { data: [] },
      inputChainId: ChainId.BSC,
      inputCurrencyId: bscTokens.cake.address,
      outputCurrencyId: bscTokens.usdt.address,
      router: {
        query: { inputCurrency: bscTokens.cake.address, outputCurrency: bscTokens.usdt.address },
        replace,
      },
      replaceBrowserHistoryMultiple,
      newCurrency,
      field: Field.INPUT,
    }

    await handleCurrencySelectFn(mockContext)

    expect(switchNetworkAsync).toHaveBeenCalledWith(ChainId.BASE, true)
    expect(replace).toHaveBeenCalledWith(
      {
        query: expect.objectContaining({
          inputCurrency: newCurrency.address,
          chain: CHAIN_QUERY_NAME[ChainId.BASE],
          outputCurrency: bscTokens.usdt.address,
          chainOut: CHAIN_QUERY_NAME[ChainId.BSC],
        }),
      },
      undefined,
      { shallow: true },
    )
  })
})
