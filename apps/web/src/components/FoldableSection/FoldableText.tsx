import { useTranslation } from '@pancakeswap/localization'
import { ButtonProps, ExpandableButtonProps, ExpandableLabel, Flex, FlexProps, Text } from '@pancakeswap/uikit'
import { ReactNode, useCallback, useMemo, useState } from 'react'
import { styled } from 'styled-components'

interface FoldableTextProps extends Omit<FlexProps, 'title'> {
  title?: ReactNode
  noBorder?: boolean
  hideExpandableLabel?: boolean
  wrapperProps?: FlexProps
  expandableLabelProps?: ButtonProps & ExpandableButtonProps
}

const Wrapper = styled(Flex)`
  cursor: pointer;
`

const StyledExpandableLabelWrapper = styled(Flex)`
  button {
    align-items: center;
    justify-content: flex-start;
  }
`

const StyledChildrenFlex = styled(Flex)<{ isExpanded?: boolean; noBorder?: boolean }>`
  overflow: hidden;
  height: ${({ isExpanded }) => (isExpanded ? '100%' : '0px')};
  padding-bottom: ${({ isExpanded }) => (isExpanded ? '16px' : '0px')};
  border-bottom: ${({ noBorder }) => (noBorder ? '' : `1px solid ${({ theme }) => theme.colors.inputSecondary}`)};
`

const FoldableText: React.FC<React.PropsWithChildren<FoldableTextProps>> = ({
  title,
  children,
  noBorder,
  hideExpandableLabel,
  wrapperProps,
  expandableLabelProps,
  ...props
}) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const handleClick = useCallback(() => setIsExpanded((s) => !s), [])
  const expandableText = useMemo(() => {
    return isExpanded ? t('Hide') : t('Details')
  }, [isExpanded, t])

  return (
    <Flex {...props} flexDirection="column">
      <Wrapper justifyContent="space-between" alignItems="center" pb="16px" onClick={handleClick} {...wrapperProps}>
        <Text fontWeight="lighter">{title}</Text>
        <StyledExpandableLabelWrapper>
          <ExpandableLabel expanded={isExpanded} {...expandableLabelProps}>
            {hideExpandableLabel ? '' : expandableText}
          </ExpandableLabel>
        </StyledExpandableLabelWrapper>
      </Wrapper>
      <StyledChildrenFlex noBorder={noBorder} isExpanded={isExpanded} flexDirection="column">
        {children}
      </StyledChildrenFlex>
    </Flex>
  )
}

export default FoldableText
