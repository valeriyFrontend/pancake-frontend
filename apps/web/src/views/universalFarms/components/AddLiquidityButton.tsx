import { useTranslation } from '@pancakeswap/localization'
import { AddIcon, Box, BoxProps, Button, ButtonProps } from '@pancakeswap/uikit'
import { useRouter } from 'next/router'
import { useCallback } from 'react'

export const AddLiquidityButton: React.FC<ButtonProps & { wrapperProps?: BoxProps; to?: string }> = ({
  wrapperProps,
  to = '/liquidity/select',
  ...props
}) => {
  const { t } = useTranslation()
  const router = useRouter()
  const handleClick = useCallback(() => {
    router.push(to)
  }, [])
  return (
    <Box width="100%" {...wrapperProps}>
      <Button onClick={handleClick} endIcon={<AddIcon color="invertedContrast" />} {...props}>
        {t('Add Liquidity')}
      </Button>
    </Box>
  )
}
