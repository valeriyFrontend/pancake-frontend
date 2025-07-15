import { SystemCSSProperties, Text } from '@chakra-ui/react'
import styled from '@emotion/styled'
import { format } from 'd3'
import { CSSProperties, ReactNode, useCallback, useMemo, useRef } from 'react'
import { BarChart2, CloudOff, Inbox } from 'react-feather'
import { useTranslation } from '@pancakeswap/localization'

import Loader from '@/components/Loader'
import useElementSizeRectDetector from '@/hooks/useElementSizeRectDetector'
import { colors } from '@/theme/cssVariables'
import { formatToRawLocaleStr } from '@/utils/numberish/formatter'
import { Bound } from './Bound'
import { Chart } from './Chart'
import { FeeAmount } from './FeeAmount'
import { useDensityChartData } from './hooks'
import { ZoomLevels } from './types'

const theme = {
  brushHandle: colors.primary,
  selectedArea: '#2B6AFF',
  selectedAreaOutOfRange: '#FF4EA3',
  deprecated_text1: '#0D111C',
  deprecated_text4: '#98A1C0',
  deprecated_blue1: '#1B365F',
  deprecated_red1: '#FA2B39'
}

export const AutoColumn = styled.div<{
  gap?: 'sm' | 'md' | 'lg' | string
  justify?: 'stretch' | 'center' | 'start' | 'end' | 'flex-start' | 'flex-end' | 'space-between'
}>`
  display: grid;
  grid-auto-rows: auto;
  grid-row-gap: ${({ gap }) => (gap === 'sm' && '8px') || (gap === 'md' && '12px') || (gap === 'lg' && '24px') || gap};
  justify-items: ${({ justify }) => justify && justify};
`
const Column = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
`
export const ColumnCenter = styled(Column)`
  width: 100%;
  align-items: center;
`

const ZOOM_LEVELS: Record<number, ZoomLevels> = {
  [FeeAmount.LOWEST]: {
    initialMin: 0.99,
    initialMax: 1.01,
    min: 0.00001,
    max: 1.5
  },
  [FeeAmount.LOW]: {
    initialMin: 0.5,
    initialMax: 1.5,
    min: 0.00001,
    max: 20
  },
  [FeeAmount.MEDIUM]: {
    initialMin: 0.5,
    initialMax: 1.5,
    min: 0.00001,
    max: 20
  },
  [FeeAmount.HIGH]: {
    initialMin: 0.5,
    initialMax: 1.5,
    min: 0.00001,
    max: 20
  }
}

const ChartWrapper = styled.div`
  justify-content: center;
  align-content: center;
`

function InfoBox({ message, icon }: { message?: ReactNode; icon: ReactNode }) {
  return (
    <ColumnCenter style={{ height: '100%', justifyContent: 'center' }}>
      {icon}
      {message && (
        <Text padding={10} marginTop="20px" textAlign="center">
          {message}
        </Text>
      )}
    </ColumnCenter>
  )
}

export default function LiquidityChartRangeInput({
  poolId,
  feeAmount,
  ticksAtLimit,
  price,
  priceLower,
  priceUpper,
  timePriceMin,
  timePriceMax,
  onLeftRangeInput,
  onRightRangeInput,
  interactive: interactive_,
  baseIn,
  autoZoom,
  outOfRange,
  containerStyle = {},
  zoomBlockStyle,
  chartHeight,
  defaultRange
}: {
  poolId: string
  feeAmount?: FeeAmount
  ticksAtLimit: { [bound in Bound]?: boolean | undefined }
  price: number | undefined
  priceLower?: number | string
  priceUpper?: number | string
  timePriceMin?: number
  timePriceMax?: number
  onLeftRangeInput?: (typedValue: string, skip?: boolean) => void
  onRightRangeInput?: (typedValue: string, skip?: boolean) => void
  interactive: boolean
  baseIn: boolean
  autoZoom?: boolean
  outOfRange?: boolean
  containerStyle?: CSSProperties
  zoomBlockStyle?: SystemCSSProperties
  chartHeight?: number
  defaultRange?: number
}) {
  const { t } = useTranslation()
  const chartBoxRef = useRef<HTMLDivElement>(null)
  const chartParentRef = useRef<HTMLDivElement>(null)
  const { width, height } = useElementSizeRectDetector(chartBoxRef)
  const { isLoading, error, formattedData } = useDensityChartData({ poolId, baseIn })

  const onBrushDomainChangeEnded = useCallback(
    (domain: [number, number], mode: string | undefined, side: string) => {
      let leftRangeValue = Number(domain[0])
      const rightRangeValue = Number(domain[1])
      if (leftRangeValue <= 0) {
        leftRangeValue = 1 / 10 ** 6
      }

      // batch(() => {
      // simulate user input for auto-formatting and other validations
      if ((mode === 'drag' || mode === 'handle' || mode === 'reset') && leftRangeValue > 0) {
        onLeftRangeInput?.(leftRangeValue.toFixed(20), side === 'right')
      }

      if ((mode === 'drag' || mode === 'handle' || mode === 'reset') && rightRangeValue > 0) {
        // todo: remove this check. Upper bound for large numbers
        // sometimes fails to parse to tick.
        if (rightRangeValue < 1e35) {
          onRightRangeInput?.(rightRangeValue.toFixed(20), side === 'left')
        }
      }
      // })
    },
    [onLeftRangeInput, onRightRangeInput]
  )

  const interactive = interactive_ && Boolean(formattedData?.length)

  const brushDomain: [number, number] | undefined = useMemo(() => {
    return priceLower && priceUpper ? [parseFloat(Number(priceLower).toFixed(20)), parseFloat(Number(priceUpper).toFixed(20))] : undefined
  }, [priceLower, priceUpper])

  const brushLabelValue = useCallback(
    (d: 'w' | 'e', x: number) => {
      if (!price) return ''

      if (d === 'w' && ticksAtLimit[baseIn ? Bound.LOWER : Bound.UPPER]) return '0'
      if (d === 'e' && ticksAtLimit[baseIn ? Bound.UPPER : Bound.LOWER]) return '∞'

      const percent = (x < price ? -1 : 1) * ((Math.max(x, price) - Math.min(x, price)) / price) * 100
      return price ? `${formatToRawLocaleStr(format(Math.abs(percent) > 1 ? '.2~s' : '.2~f')(percent))}%` : ''
    },
    [baseIn, price, ticksAtLimit]
  )
  // if (error) {
  //   sendEvent('exception', { description: error.toString(), fatal: false })
  // }
  const isUninitialized = !formattedData.length && !isLoading
  const chartParentWidth = chartParentRef.current?.getBoundingClientRect().width

  const zoomLevels = useMemo(() => {
    const defaultZoomConfig = ZOOM_LEVELS[feeAmount ?? FeeAmount.MEDIUM] || ZOOM_LEVELS[FeeAmount.MEDIUM]
    if (defaultRange) {
      const isLowFee = feeAmount && feeAmount <= FeeAmount.LOWEST
      const zoomRate = isLowFee ? 1.5 : 2
      return {
        ...defaultZoomConfig,
        initialMin: 1 - defaultRange * zoomRate,
        initialMax: 1 + defaultRange * zoomRate
      }
    }
    return defaultZoomConfig
  }, [feeAmount, defaultRange])

  return (
    <AutoColumn ref={chartParentRef} gap="md" style={{ ...containerStyle, minHeight: chartHeight || '200px' }}>
      {isUninitialized ? (
        <InfoBox message={t('Pool liquidity will appear here.')} icon={<Inbox size={56} stroke={theme.deprecated_text1} />} />
      ) : isLoading ? (
        <InfoBox icon={<Loader size="40px" stroke={theme.deprecated_text4} />} />
      ) : error ? (
        <InfoBox message={t('Liquidity data not available.')} icon={<CloudOff size={56} stroke={theme.deprecated_text4} />} />
      ) : !formattedData || formattedData.length === 0 || !price ? (
        <InfoBox message={t('There is no liquidity data.')} icon={<BarChart2 size={56} stroke={theme.deprecated_text4} />} />
      ) : (
        <ChartWrapper ref={chartBoxRef}>
          <Chart
            data={{
              series: formattedData,
              current: price,
              poolId,
              priceMin: timePriceMin,
              priceMax: timePriceMax,
              baseIn
            }}
            dimensions={{
              width: interactive ? width ?? 400 : chartParentWidth ?? 400,
              height: chartHeight || (height ?? 200)
            }}
            margins={{ top: 10, right: 2, bottom: interactive ? 30 : 0, left: 0 }}
            styles={{
              area: {
                selection: outOfRange ? theme.selectedAreaOutOfRange : theme.selectedArea,
                opacity: outOfRange ? '0.5' : '0.3'
              },
              brush: {
                handle: {
                  west: theme.brushHandle,
                  east: theme.brushHandle
                }
              }
            }}
            interactive={interactive}
            brushLabels={brushLabelValue}
            brushDomain={brushDomain}
            onBrushDomainChange={onBrushDomainChangeEnded}
            feeAmount={feeAmount}
            zoomLevels={zoomLevels}
            ticksAtLimit={ticksAtLimit}
            autoZoom={autoZoom}
            zoomBlockStyle={zoomBlockStyle}
          />
        </ChartWrapper>
      )}
    </AutoColumn>
  )
}
