import { type Protocol } from '@pancakeswap/farms'
import { INFINITY_PROTOCOLS } from 'config/constants/protocols'

export const isInfinityProtocol = (protocol?: Protocol) => protocol && INFINITY_PROTOCOLS.includes(protocol)
