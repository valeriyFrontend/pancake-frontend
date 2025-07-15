import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { NextPageWithLayout } from 'utils/page.types'
import { CHAIN_IDS } from 'utils/wagmi'
import { LiquidityView } from 'views/Liquidity/LiquidityView'
import { PageWithoutFAQ } from 'views/Page'

const PoolPage = () => {
  const router = useRouter()
  const { tokenId } = router.query

  useEffect(() => {
    const isNumberReg = /^\d+$/

    if (tokenId && typeof tokenId === 'string' && !tokenId.match(isNumberReg)) {
      router.replace('/add')
    }
  }, [tokenId, router])
  if (!tokenId) {
    return null
  }

  return <LiquidityView />
}

const Page = dynamic(() => Promise.resolve(PoolPage), {
  ssr: false,
}) as NextPageWithLayout

Page.chains = CHAIN_IDS
Page.screen = true
Page.Layout = PageWithoutFAQ

export default Page
