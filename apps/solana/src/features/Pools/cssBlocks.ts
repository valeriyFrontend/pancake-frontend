import { SystemStyleObject } from '@chakra-ui/react'

export const poolListGrid: SystemStyleObject = {
  display: 'grid',
  gridTemplateColumns: [
    '2fr 1fr',
    'minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(170px, 1fr)',
    'minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(170px, 1fr)'
  ],
  columnGap: ['max(1rem, 2%)', 'max(1rem, 1%)', '2.5%'],
  alignItems: 'center'
}
