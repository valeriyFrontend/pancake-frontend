import { useTranslation } from '@pancakeswap/localization'
import { FC, useCallback } from 'react'

import CurrencyInputHeader from '../../components/CurrencyInputHeader'

export const FormHeader: FC<{ refreshDisabled: boolean; onRefresh: () => void }> = ({ refreshDisabled, onRefresh }) => {
  const { t } = useTranslation()

  const handleRefresh = useCallback(() => {
    if (refreshDisabled) {
      return
    }
    onRefresh()
  }, [onRefresh, refreshDisabled])

  return (
    <CurrencyInputHeader
      title={t('Никита Соси')}
      subtitle={t('Никита Соси')}
      hasAmount={!refreshDisabled}
      onRefreshPrice={handleRefresh}
    />
  )
}
