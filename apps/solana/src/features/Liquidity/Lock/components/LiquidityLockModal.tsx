import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Text,
  Box,
  Flex,
  Input
} from '@chakra-ui/react'
import { useState } from 'react'
import Decimal from 'decimal.js'
import { useTranslation } from '@pancakeswap/localization'
import { ApiV3PoolInfoStandardItemCpmm } from '@pancakeswap/solana-core-sdk'
import BN from 'bn.js'
import { colors } from '@/theme/cssVariables'
import TokenAvatarPair from '@/components/TokenAvatarPair'
import AmountSlider from '@/components/AmountSlider'
import InfoCircleIcon from '@/icons/misc/InfoCircleIcon'
import WarningIcon from '@/icons/misc/WarningIcon'
import { LockCpmmPoolInfo } from '@/hooks/portfolio/cpmm/useLockableCpmmLp'
import { formatCurrency } from '@/utils/numberish/formatter'
import { useTokenAccountStore } from '@/store'

function LiquidityLockModal({
  isOpen,
  onClose,
  onConfirm,
  poolInfo
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: (params: { poolInfo: ApiV3PoolInfoStandardItemCpmm; lpAmount: BN }) => void
  poolInfo: LockCpmmPoolInfo
}) {
  const { t } = useTranslation()

  const [confirmText, setConfirmText] = useState('')
  const [percent, setPercent] = useState(100)

  const handleCloseModal = () => {
    setConfirmText('')
    onClose()
  }

  const getTokenBalanceUiAmount = useTokenAccountStore((s) => s.getTokenBalanceUiAmount)
  const lpBalance = new Decimal(getTokenBalanceUiAmount({ mint: poolInfo.lpMint.address, decimals: poolInfo.lpMint.decimals }).amount)
    .mul(percent)
    .div(100)
    .toString()
  const mintAmountA = new Decimal(lpBalance).mul(poolInfo.baseRatio).mul(percent).div(100)
  const mintAmountB = new Decimal(lpBalance).mul(poolInfo.quoteRatio).mul(percent).div(100)
  const lpValue = new Decimal(lpBalance).mul(poolInfo.lpPrice).toDecimalPlaces(6).toString()

  return (
    <Modal isOpen={isOpen} onClose={handleCloseModal} size={{ base: 'md', md: 'xl' }}>
      <ModalOverlay />
      <ModalContent bg={colors.backgroundLight} border={`1px solid ${colors.buttonSolidText}`} p={{ base: 4, md: 8 }}>
        <Flex flexDirection="column" justifyContent="center" alignItems="center" gap={5} mt={2}>
          <InfoCircleIcon width={32} height={32} color={colors.textPink} />
          <Text fontSize={['lg', 'xl']} fontWeight="medium">
            {t('Lock Liquidity Permanently?')}
          </Text>
        </Flex>
        <ModalCloseButton />
        <ModalBody mt={[5, 6]}>
          <Text color={colors.lightPurple} lineHeight="20px" fontSize={['sm', 'md']}>
            {t(
              'Are you sure you want to permanently lock/burn liquidity? You will be unable to access or withdraw underlying position assets, only trading fees earned will remain claimable.'
            )}
          </Text>
          <Box rounded="xl" border={`1px solid ${colors.selectInactive}`} bg={colors.modalContainerBg} px={[3, 4]} py={2} my={[5, 6]}>
            <Text color={colors.lightPurple} fontSize={['sm', 'md']} mb={2}>
              {t('Set amount of position to lock:')}
            </Text>
            <Flex bg={colors.backgroundDark} rounded="xl" align="center" justifyContent="space-between" px={4} py={2} gap={1} mb={2}>
              <Flex align="center" gap={3}>
                <TokenAvatarPair size="md" token1={poolInfo.mintA} token2={poolInfo.mintB} />
                <Flex flexDirection="column" gap={0.5}>
                  <Text color={colors.lightPurple} fontSize={['md', '20px']} fontWeight="500" lineHeight="24px">
                    {poolInfo.poolName.replace(' - ', '/')}
                  </Text>
                  <Text fontSize="sm">
                    {formatCurrency(mintAmountA, {
                      decimalPlaces: 2
                    })}{' '}
                    <Text as="span" color={colors.textSecondary}>
                      {poolInfo.mintA?.symbol}
                    </Text>
                    {' / '}
                    {formatCurrency(mintAmountB, {
                      decimalPlaces: 2
                    })}{' '}
                    <Text as="span" color={colors.textSecondary}>
                      {poolInfo.mintB?.symbol}
                    </Text>
                  </Text>
                </Flex>
              </Flex>
              <Box textAlign="right">
                <Text fontSize={['md', 'xl']} fontWeight="medium">
                  {formatCurrency(lpValue, {
                    symbol: '$',
                    decimalPlaces: 2
                  })}
                </Text>
                <Text fontSize="sm" color={colors.lightPurple}>
                  {formatCurrency(lpBalance, {
                    decimalPlaces: 2
                  })}{' '}
                  LP
                </Text>
              </Box>
            </Flex>
            <AmountSlider
              renderTopLeftLabel={() => 'Locked Amount'}
              percent={percent}
              isDisabled={false}
              onChange={setPercent}
              defaultValue={percent}
            />
          </Box>
          <Flex rounded="lg" bg={colors.background03} py={3} px={4} gap={3}>
            <Text pt={0.5}>
              <WarningIcon stroke={colors.textPink} width="16" height="16" />
            </Text>
            <Text color={colors.textPink} fontSize="sm" fontWeight="medium">
              {t(
                'By confirming below, I agree to permanently lock liquidity. I understand access to the underlying assets will be lost forever.'
              )}
            </Text>
          </Flex>
          <Flex
            flexDirection="column"
            alignItems={['flex-start', 'center']}
            rounded="xl"
            bg={colors.modalContainerBg}
            border={`1px solid ${colors.selectInactive}`}
            fontSize={['sm', 'md']}
            px={7}
            py={4}
            gap={2}
            mt={6}
          >
            <Text color={colors.lightPurple}>{t('To confirm, type the following:')}</Text>
            <Text color={colors.lightPurple} fontWeight="medium" userSelect="none">
              {t('I confirm, permanently lock my liquidity forever')}
            </Text>
            <Input
              variant="filledDark"
              w="full"
              rounded="lg"
              color={colors.lightPurple}
              fontSize="md"
              fontWeight="medium"
              textAlign="center"
              sx={{
                _placeholder: {
                  textAlign: 'center'
                }
              }}
              onChange={(e) => setConfirmText(e.currentTarget.value)}
              placeholder={t('Type confirmation text here') || ''}
            />
          </Flex>
        </ModalBody>
        <ModalFooter mt="8" flexDirection="column" gap="2">
          <Button
            variant="danger"
            w="full"
            loadingText={`${t('Lock Liquidity')}...`}
            isDisabled={confirmText !== t('I confirm, permanently lock my liquidity forever')}
            onClick={() => {
              onConfirm({
                poolInfo,
                lpAmount: new BN(new Decimal(lpBalance).mul(10 ** poolInfo.lpMint.decimals).toFixed(0))
              })
            }}
          >
            {t('Confirm, Lock Liquidity Permanently')}
          </Button>
          <Button w="full" variant="ghost" fontSize="sm" color={colors.buttonPrimary} onClick={handleCloseModal}>
            {t('Cancel')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default LiquidityLockModal
