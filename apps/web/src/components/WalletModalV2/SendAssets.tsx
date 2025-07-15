import { useTranslation } from '@pancakeswap/localization'
import { Box, FlexGap, SearchInput, Text } from '@pancakeswap/uikit'

import { NetworkFilter } from '@pancakeswap/widgets-internal'
import { BalanceData } from 'hooks/useAddressBalance'
import { useCallback, useMemo, useState } from 'react'
import { useAllChainsOpts } from 'views/universalFarms/hooks/useMultiChains'
import { ActionButton } from './ActionButton'
import { AssetsList } from './AssetsList'
import { SendAssetForm } from './SendAssetForm'
import { ViewState } from './type'

interface SendAssetsProps {
  assets: BalanceData[]
  isLoading: boolean
  onBack: () => void
  viewState: ViewState
  onViewStateChange: (viewState: ViewState) => void
}

// Convert balances to Asset type for AssetsList component

export const SendAssets: React.FC<SendAssetsProps> = ({ assets, isLoading, onBack, viewState, onViewStateChange }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNetworks, setSelectedNetworks] = useState<number[]>([])
  const [selectedAsset, setSelectedAsset] = useState<BalanceData | null>(null)
  const { t } = useTranslation()

  const convertBalancesToAssets = useCallback((balanceItems): BalanceData[] => {
    return balanceItems.map((item) => ({
      id: item.id,
      chainId: item.chainId,
      token: item.token,
      quantity: item.quantity,
      price:
        item.price && item.price.totalUsd !== null
          ? { totalUsd: item.price.totalUsd || 0, usd: item.price.usd, usd24h: item.price.usd24h }
          : undefined,
    }))
  }, [])

  // Get unique networks from assets
  const allChainsOpts = useAllChainsOpts()
  const networkFilterData = useMemo(() => {
    if (assets.length === 0) return []
    const uniqueChain = [...new Set(assets.map((asset) => asset.chainId))]
    return allChainsOpts.filter((chain) => uniqueChain.includes(chain.value))
  }, [assets])

  const filteredTokens = useMemo(() => {
    // First filter by networks if any are selected
    const networkFilteredBalances =
      selectedNetworks.length === 0 ? assets : assets.filter((asset) => selectedNetworks.includes(asset.chainId))

    // Then filter by search query if provided
    const searchFilteredBalances = searchQuery
      ? networkFilteredBalances.filter(
          (asset) =>
            asset.token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            asset.token.address.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : networkFilteredBalances

    return convertBalancesToAssets(searchFilteredBalances)
  }, [assets, selectedNetworks, searchQuery, convertBalancesToAssets])
  if (viewState >= ViewState.SEND_FORM && selectedAsset)
    return <SendAssetForm asset={selectedAsset} onViewStateChange={onViewStateChange} viewState={viewState} />
  return (
    <>
      <Text fontSize="20px" fontWeight="bold" mb="16px">
        {t('Send Assets')}
      </Text>
      <FlexGap gap="16px" flexDirection="column" mb="16px">
        <Box>
          <NetworkFilter
            data={allChainsOpts}
            value={selectedNetworks}
            onChange={(value) => setSelectedNetworks(value)}
            multiple
          />
        </Box>
        <Box>
          <SearchInput
            placeholder="Search by name or paste address"
            onChange={(e) => setSearchQuery(e.target.value)}
            initialValue={searchQuery}
          />
        </Box>
      </FlexGap>
      <AssetsList
        assets={filteredTokens}
        isLoading={isLoading}
        onRowClick={(asset) => {
          setSelectedAsset(asset)
          onViewStateChange(ViewState.SEND_FORM)
        }}
      />
      <FlexGap gap="16px" mt="16px">
        <ActionButton
          onClick={() => {
            onBack()
          }}
          variant="tertiary"
        >
          {t('Cancel')}
        </ActionButton>
      </FlexGap>
    </>
  )
}
