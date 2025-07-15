export const Permit2ForwardAbi = [
  {
    type: 'constructor',
    inputs: [{ name: '_permit2', type: 'address', internalType: 'contract IAllowanceTransfer' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'permit',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      {
        name: 'permitSingle',
        type: 'tuple',
        internalType: 'struct IAllowanceTransfer.PermitSingle',
        components: [
          {
            name: 'details',
            type: 'tuple',
            internalType: 'struct IAllowanceTransfer.PermitDetails',
            components: [
              { name: 'token', type: 'address', internalType: 'address' },
              { name: 'amount', type: 'uint160', internalType: 'uint160' },
              { name: 'expiration', type: 'uint48', internalType: 'uint48' },
              { name: 'nonce', type: 'uint48', internalType: 'uint48' },
            ],
          },
          { name: 'spender', type: 'address', internalType: 'address' },
          { name: 'sigDeadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'err', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'permit2',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'contract IAllowanceTransfer' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'permitBatch',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      {
        name: '_permitBatch',
        type: 'tuple',
        internalType: 'struct IAllowanceTransfer.PermitBatch',
        components: [
          {
            name: 'details',
            type: 'tuple[]',
            internalType: 'struct IAllowanceTransfer.PermitDetails[]',
            components: [
              { name: 'token', type: 'address', internalType: 'address' },
              { name: 'amount', type: 'uint160', internalType: 'uint160' },
              { name: 'expiration', type: 'uint48', internalType: 'uint48' },
              { name: 'nonce', type: 'uint48', internalType: 'uint48' },
            ],
          },
          { name: 'spender', type: 'address', internalType: 'address' },
          { name: 'sigDeadline', type: 'uint256', internalType: 'uint256' },
        ],
      },
      { name: 'signature', type: 'bytes', internalType: 'bytes' },
    ],
    outputs: [{ name: 'err', type: 'bytes', internalType: 'bytes' }],
    stateMutability: 'payable',
  },
] as const
