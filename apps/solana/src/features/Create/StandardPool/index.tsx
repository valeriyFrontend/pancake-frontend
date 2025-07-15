import { Box, Flex, Grid, GridItem, HStack, Link, Text, VStack } from '@chakra-ui/react'
import { useRouter } from 'next/router'
import { useTranslation } from '@pancakeswap/localization'
import { colors } from '@/theme/cssVariables'
import PanelCard from '@/components/PanelCard'
import ChevronLeftIcon from '@/icons/misc/ChevronLeftIcon'
import { useAppStore } from '@/store'
import { genCSS2GridTemplateColumns, genCSS3GridTemplateColumns } from '@/theme/detailConfig'
import { useRouteQuery } from '@/utils/routeTools'
import Initialize from './components/Initialize'
import { SubPageNote } from '../../../components/SubPageNote'

export default function CreatePool() {
  const isMobile = useAppStore((s) => s.isMobile)
  const { t } = useTranslation()
  const router = useRouter()
  const { type: poolType } = useRouteQuery<{
    type?: string
  }>()
  const isAmmV4 = poolType === 'legacy-amm'

  return (
    <Grid
      gridTemplate={[
        `
            "back  " auto
            "panel " auto
            "note  " minmax(80px, 1fr) / 1fr
          `,
        `
            "back word " auto
            "note panel" 1fr / ${genCSS2GridTemplateColumns({ rightLeft: 344, center: 468 })}
          `,
        `
            "back word  ." auto
            "note panel ." 1fr / ${genCSS3GridTemplateColumns({ rightLeft: 344, center: 468 })}
          `
      ]}
      columnGap={[0, 24]}
      rowGap={[4, 4]}
      mt={[2, 8]}
    >
      {/* left */}
      <GridItem area="back">
        <Flex>
          <HStack
            cursor="pointer"
            onClick={() => {
              router.push({
                pathname: '/liquidity-pools'
              })
            }}
            color={colors.textTertiary}
            fontWeight="500"
            fontSize={['md', 'xl']}
          >
            <ChevronLeftIcon />
            <Text>{t('Back')}</Text>
          </HStack>
        </Flex>
      </GridItem>

      <GridItem area="note">
        <Box w={['unset', 'clamp(300px, 100%, 500px)']}>
          <SubPageNote
            title={t('Please Note')}
            description={
              <Text fontSize="sm" color={isMobile ? colors.textSecondary : colors.textTertiary}>
                {t('This tool is for advanced users. For detailed instructions, read the guide for Standard pools.')}
              </Text>
            }
          />
        </Box>
      </GridItem>

      <GridItem area="word" display={['none', 'unset']}>
        <Flex justify="left">
          <Text whiteSpace="pre-line" w="fit-content" cursor="pointer" color={colors.textSecondary} fontWeight="500" fontSize="xl">
            {isAmmV4 ? t('Initialize AMM v4 pool') : t('Initialize CPMM pool')}
          </Text>
        </Flex>
      </GridItem>

      <GridItem area="panel">
        <PanelCard bg="transparent" overflow="hidden">
          <VStack spacing={4}>
            <Initialize isAmmV4={isAmmV4} />
          </VStack>
        </PanelCard>
      </GridItem>
    </Grid>
  )
}
