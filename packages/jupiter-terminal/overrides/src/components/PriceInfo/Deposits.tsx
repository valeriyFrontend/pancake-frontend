import React from 'react'
import { TransactionFeeInfo } from '@jup-ag/react-hook'
import Tooltip from 'src/components/Tooltip'
import { formatNumber } from 'src/misc/utils'
import Decimal from 'decimal.js'

const Deposits = ({
  hasSerumDeposit,
  hasAtaDeposit,
  feeInformation,
}: {
  hasSerumDeposit: boolean
  hasAtaDeposit: boolean
  feeInformation: TransactionFeeInfo | undefined
}) => {
  if (hasSerumDeposit || hasAtaDeposit) {
    return (
      <div className="flex items-start justify-between text-xs">
        <div className="flex w-[50%] pcs-info-label">
          <span>Deposit</span>
          <Tooltip
            variant="dark"
            className="pcs-tooltip"
            content={
              <div className="max-w-xs rounded-lg text-white-75">
                <ul>
                  {hasSerumDeposit && (
                    <li>
                      <p>
                        <span>Open serum require an OpenOrders account but it can be closed later on.</span>{' '}
                        <a
                          className="underline"
                          target="_blank"
                          rel="noopener noreferrer"
                          href="https://docs.google.com/document/d/1qEWc_Bmc1aAxyCUcilKB4ZYpOu3B0BxIbe__dRYmVns"
                        >
                          <span>Check here</span>
                        </a>
                        .
                      </p>
                    </li>
                  )}
                  {hasAtaDeposit && (
                    <li>
                      <p>
                        <span>
                          On your first swap on SOL with this wallet, a small amount of SOL is needed to create an
                          associated token account (ATA) to hold your tokens.
                        </span>
                      </p>
                    </li>
                  )}
                </ul>
              </div>
            }
          >
            <span className="ml-1 cursor-pointer">[?]</span>
          </Tooltip>
        </div>
        <div className="w-[50%] text-xs text-right pcs-info-content">
          {(() => {
            if (!feeInformation) {
              return 'Unable to determine fees'
            }

            const content = [
              hasAtaDeposit && (
                <p key="ata">
                  <span>
                    {formatNumber.format(
                      feeInformation?.ataDeposits
                        .reduce<Decimal>((s, deposit) => {
                          return s.add(deposit)
                        }, new Decimal(0))
                        .div(10 ** 9),
                    )}{' '}
                    SOL for {feeInformation?.ataDeposits?.length}{' '}
                    {(feeInformation?.ataDeposits?.length || 0) > 0 ? 'ATA account' : 'ATA accounts'}
                  </span>
                </p>
              ),
              hasSerumDeposit && (
                <p key="serum">
                  <span>
                    {formatNumber.format(
                      feeInformation?.openOrdersDeposits
                        .reduce((s, deposit) => {
                          return s.add(deposit)
                        }, new Decimal(9))
                        .div(10 ** 9),
                    )}{' '}
                    SOL for {feeInformation?.openOrdersDeposits.length}{' '}
                    {(feeInformation?.openOrdersDeposits?.length || 0) > 0
                      ? 'Serum OpenOrders account'
                      : 'Serum OpenOrders accounts'}
                  </span>
                </p>
              ),
            ].filter(Boolean)

            if (content.length) {
              return content
            }

            return '-'
          })()}
        </div>
      </div>
    )
  }

  return null
}

export default Deposits
