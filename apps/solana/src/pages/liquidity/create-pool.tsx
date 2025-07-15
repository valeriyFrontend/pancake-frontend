import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useLiquidityStore, useAppStore } from '@/store'

const CreatePool = dynamic(() => import('@/features/Create/StandardPool'), { ssr: false })

function CreatePoolPage() {
  const raydium = useAppStore((s) => s.raydium)
  const fetchCpmmConfigsAct = useLiquidityStore((s) => s.fetchCpmmConfigsAct)

  useEffect(() => {
    if (!raydium) return
    fetchCpmmConfigsAct()
  }, [raydium, fetchCpmmConfigsAct])

  return <CreatePool />
}

export default CreatePoolPage

export async function getStaticProps() {
  return {
    props: { title: 'Create Pool' }
  }
}
