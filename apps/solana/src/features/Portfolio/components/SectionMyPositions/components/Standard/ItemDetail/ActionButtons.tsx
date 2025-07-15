import { Flex } from '@chakra-ui/react'
import { useTranslation } from '@pancakeswap/localization'
import Button from '@/components/Button'
import FullExpandIcon from '@/icons/misc/FullExpandIcon'
import MinusIcon from '@/icons/misc/MinusIcon'
import PlusIcon from '@/icons/misc/PlusIcon'
import { colors } from '@/theme/cssVariables'
import { routeToPage } from '@/utils/routeTools'
import useResponsive from '@/hooks/useResponsive'

type ActionButtonsProps = {
  variant?: 'drawer-face'
  poolId: string
  farmId?: string
  hasFarmLp: boolean
  canMigrate: boolean
  canStake: boolean
  canViewMore: boolean
  isLocked?: boolean
  onClickViewMore?(): void
  onMigrateOpen?(): void
}

export default function ActionButtons({
  variant,
  poolId,
  farmId,
  hasFarmLp,
  canMigrate,
  canViewMore,
  canStake,
  isLocked,
  onClickViewMore,
  onMigrateOpen
}: ActionButtonsProps) {
  const { t } = useTranslation()
  const { isMobile } = useResponsive()
  const onUnstaking = () => {
    routeToPage('decrease-liquidity', {
      queryProps: {
        mode: 'unstake',
        pool_id: poolId,
        farm_id: farmId
      }
    })
  }
  const onRemoveLiquidity = () => {
    routeToPage('decrease-liquidity', {
      queryProps: {
        mode: 'remove',
        pool_id: poolId
      }
    })
  }

  const onStake = () => {
    routeToPage('increase-liquidity', {
      queryProps: {
        mode: 'stake',
        pool_id: poolId
      }
    })
  }

  const onAddLiquidity = () => {
    routeToPage('increase-liquidity', {
      queryProps: {
        mode: 'add',
        pool_id: poolId
      }
    })
  }

  return (
    <Flex mt={[2, 0]} direction={variant === 'drawer-face' ? 'column' : 'row'} wrap="wrap" gap={[variant === 'drawer-face' ? 4 : 2, 3]}>
      {variant !== 'drawer-face' && canViewMore && (
        <Button
          mr="auto"
          leftIcon={<FullExpandIcon />}
          variant="ghost"
          size="sm"
          flex={isMobile ? undefined : '1 1 auto'}
          onClick={onClickViewMore}
        >
          {t('View more')}
        </Button>
      )}
      <Flex gap={[variant === 'drawer-face' ? 1 : 2, 3]} flex={1} justifyContent={variant === 'drawer-face' ? 'space-between' : 'flex-end'}>
        {!isLocked && (
          <Button
            variant="outline"
            size={variant === 'drawer-face' ? 'sm' : 'xs'}
            w={variant === 'drawer-face' ? undefined : 9}
            h={variant === 'drawer-face' ? undefined : '30px'}
            px={0}
            onClick={hasFarmLp ? onUnstaking : onRemoveLiquidity}
          >
            <MinusIcon color={colors.secondary} />
          </Button>
        )}
        <Button
          variant="solid"
          size={variant === 'drawer-face' ? 'sm' : 'xs'}
          w={variant === 'drawer-face' ? undefined : 9}
          h={variant === 'drawer-face' ? undefined : '30px'}
          px={0}
          onClick={onAddLiquidity}
        >
          <PlusIcon color={colors.buttonSolidText} />
        </Button>
        {!isLocked ? (
          canMigrate ? (
            <Button size="sm" onClick={onMigrateOpen}>
              {t('Migrate')}
            </Button>
          ) : (
            <Button size="sm" isDisabled={!canStake} onClick={onStake}>
              {t('Stake')}
            </Button>
          )
        ) : null}
      </Flex>
    </Flex>
  )
}
