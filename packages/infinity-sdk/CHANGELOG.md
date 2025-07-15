# @pancakeswap/infinity-sdk

## 1.0.2

### Patch Changes

- 5b4135c: Added `account` support for multicall, quote will mutlicall quote hooked pool with account, added whitelist hooks

## 1.0.1

### Patch Changes

- 10acda5: Remove internal dependencies out of `infinity-sdk`.
- Updated dependencies [3de0443]
  - @pancakeswap/chains@0.5.2
  - @pancakeswap/permit2-sdk@1.1.3
  - @pancakeswap/v3-sdk@3.9.3

## 1.0.0

### Major Changes

- cb44715: [Major Updates]
  **@pancakeswap/routing-sdk-addon-infinity**
  **@pancakeswap/routing-sdk-addon-quoter**
  **@pancakeswap/infinity-sdk**

  3 packages added for support infinity(CL & Bin) pools and dynamic hooks path finding and liquidity management.

  [Minor Updates]
  **@pancakeswap/universal-router-sdk**: This update implements Infinity CL/BIN route planning, merges and restructures code for stable, V2, V3, and Infinity pools, refactors commands into a RoutePlanner, and removes legacy ABIs. It adds new decode logic for universal calldata, reorganizes input token permits, and updates addresses in constants, improving flexibility and reducing complexity.

  **@pancakeswap/widgets-internal** : Add Infinity modules, "PriceRangeChartWithPeriodAndLiquidity," new "ProtocolMenu," "PoolTypeFilter," and "Tips," and remove "PoolTagFilter," "PoolTypeMenu." We update "FeatureStack" (folding/info icons), "FeeTierTooltip," "NetworkFilter," "TokenFilter," "TokenOverview," and ROI logic. We also revise Infinity liquidity features with new chart components and hooks.

  **@pancakeswap/swap-sdk-core**: Reduce rounding errors and improve quote accuracy, with refined type definitions ensuring a smoother developer experience.

  **@pancakeswap/smart-router**: Refactored some references to Infinity and introduced InfinityRouter with Infinity CL and BIN pools. Removed V4 code, updated on-chain quote providers, route encoders, logging, and aggregator logic. Enhanced route handling performance and ensured compatibility with Infinity SDK for improved quoting.

  **@pancakeswap/routing-sdk**: Add Infinity CL and Bin pool support to the routing SDK. Introduce new constants, math utilities, and route encoding for Infinity mixed routes. Integrate Infinity quoter logic, including bin and CL quote calls, gas cost estimation, and logging improvements for better debugging.

  **@pancakeswap/farms**: Added InfinityBIN and InfinityCLAMM protocols, introduced BSC testnet support, updated fetch logic to handle zeroAddress with Native tokens, and included new V4 farm format in utilities. Also updated test exports, chain arrays, and support lists to incorporate these changes and ensure robust universal farm configuration.

  **@pancakeswap/uikit**
  '@pancakeswap/utils': Added forwardRef support to Breadcrumbs, new Button variant "textPrimary60," a noButtonMargin prop in ButtonMenu, children rendering in CopyButton, itemKey in DropdownMenu, new icons (CurveGraph, CurvedChart, HookFeature, SpotGraph), updated color tokens and styles, refined useModal logic.

  [Patch Updates]

  Added support for infinity by introducing internal types and updating unit tests to improve code maintainability and logging accuracy.

### Patch Changes

- Updated dependencies [cb44715]
  - @pancakeswap/swap-sdk-core@1.4.0
  - @pancakeswap/utils@6.1.0
  - @pancakeswap/v3-sdk@3.9.2
  - @pancakeswap/permit2-sdk@1.1.2

## 0.1.8

### Patch Changes

- @pancakeswap/v3-sdk@3.9.1

## 0.1.7

### Patch Changes

- Updated dependencies [6a6acdb]
  - @pancakeswap/v3-sdk@3.9.0

## 0.1.6

### Patch Changes

- @pancakeswap/v3-sdk@3.8.13

## 0.1.5

### Patch Changes

- 6a9fd57: Publish Infinity SDK

## 0.1.4

### Patch Changes

- Updated dependencies [176eb10]
- Updated dependencies [176eb10]
  - @pancakeswap/swap-sdk-core@1.3.0
  - @pancakeswap/v3-sdk@3.8.12

## 0.1.3

### Patch Changes

- Updated dependencies [f551e5e]
  - @pancakeswap/swap-sdk-core@1.2.0
  - @pancakeswap/v3-sdk@3.8.11

## 0.1.2

### Patch Changes

- Updated dependencies [911d107]
  - @pancakeswap/v3-sdk@3.8.10

## 0.1.1

### Patch Changes

- Updated dependencies [fe96bb1]
  - @pancakeswap/v3-sdk@3.8.9
