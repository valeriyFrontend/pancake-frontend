import { Currency, ERC20Token, Price, Token } from "@pancakeswap/sdk";
import { formatPrice } from "@pancakeswap/utils/formatFractions";
import { TickMath, nearestUsableTick, priceToClosestTick, tickToPrice } from "@pancakeswap/v3-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Bound } from "../../swap/LiquidityChartRangeInput";
import { tryParsePrice, tryParseTick } from "../utils";

interface Params {
  baseCurrency?: Currency | null;
  quoteCurrency?: Currency | null;
  priceLower?: Price<Currency, Currency>;
  priceUpper?: Price<Currency, Currency>;
  tickSpacing?: number;
}

export interface PriceRangeInfo {
  tickLower?: number;
  tickUpper?: number;
  priceLower?: Price<Currency, Currency>;
  priceUpper?: Price<Currency, Currency>;
  onLeftRangeInput: (leftRangeValue: string) => void;
  onRightRangeInput: (rightRangeValue: string) => void;
  onBothRangeInput: (leftRangeValue: string, rightRangeValue: string) => void;
  toggleFullRange: () => void;
  fullRange?: boolean;
  ticksAtLimit: { [bound in Bound]?: boolean };
}

export function usePriceRange({
  baseCurrency,
  quoteCurrency,
  priceLower: initialPriceLower,
  priceUpper: initialPriceUpper,
  tickSpacing,
}: Params): PriceRangeInfo | null {
  const [fullRange, setFullRange] = useState(false);
  const [priceLower, setPriceLower] = useState<Price<Currency, Currency> | undefined>(initialPriceLower);
  const [priceUpper, setPriceUpper] = useState<Price<Currency, Currency> | undefined>(initialPriceUpper);

  const invertPrice = Boolean(baseCurrency && quoteCurrency && quoteCurrency.wrapped.sortsBefore(baseCurrency.wrapped));

  // lower and upper limits in the tick space for `feeAmount`
  const tickSpaceLimits: {
    [bound in Bound]: number | undefined;
  } = useMemo(
    () => ({
      [Bound.LOWER]: tickSpacing ? nearestUsableTick(TickMath.MIN_TICK, tickSpacing) : undefined,
      [Bound.UPPER]: tickSpacing ? nearestUsableTick(TickMath.MAX_TICK, tickSpacing) : undefined,
    }),
    [tickSpacing]
  );

  const priceLimits: {
    [bound in Bound]: Price<Token, Token> | undefined;
  } = useMemo(() => {
    const token0 = invertPrice ? quoteCurrency?.wrapped : baseCurrency?.wrapped;
    const token1 = invertPrice ? baseCurrency?.wrapped : quoteCurrency?.wrapped;
    return {
      [Bound.LOWER]:
        token0 && token1 && tickSpaceLimits[Bound.LOWER]
          ? tickToPrice(token0, token1, tickSpaceLimits[Bound.LOWER])
          : undefined,
      [Bound.UPPER]:
        token0 && token1 && tickSpaceLimits[Bound.UPPER]
          ? tickToPrice(token0, token1, tickSpaceLimits[Bound.UPPER])
          : undefined,
    };
  }, [tickSpaceLimits, invertPrice, quoteCurrency, baseCurrency]);

  const rightRangeTypedValue = useMemo(
    () => (invertPrice ? formatPrice(priceLower, 18) : formatPrice(priceUpper, 18)),
    [priceLower, priceUpper, invertPrice]
  );

  const leftRangeTypedValue = useMemo(
    () => (invertPrice ? formatPrice(priceUpper, 18) : formatPrice(priceLower, 18)),
    [priceLower, priceUpper, invertPrice]
  );

  // parse typed range values and determine closest ticks
  // lower should always be a smaller tick
  const tickLower = useMemo(
    () =>
      fullRange
        ? tickSpaceLimits[Bound.LOWER]
        : priceLower && initialPriceLower?.equalTo(priceLower.asFraction) // price is the same as initial lower price, use initial price instead of parse from input
        ? priceToClosestTick(priceLower as Price<ERC20Token, ERC20Token>)
        : invertPrice
        ? tryParseTick(quoteCurrency?.wrapped, baseCurrency?.wrapped, tickSpacing, rightRangeTypedValue)
        : tryParseTick(baseCurrency?.wrapped, quoteCurrency?.wrapped, tickSpacing, leftRangeTypedValue),
    [
      priceLower,
      initialPriceLower,
      fullRange,
      tickSpaceLimits,
      invertPrice,
      quoteCurrency?.wrapped,
      baseCurrency?.wrapped,
      tickSpacing,
      rightRangeTypedValue,
      leftRangeTypedValue,
    ]
  );

  const tickUpper = useMemo(
    () =>
      fullRange
        ? tickSpaceLimits[Bound.UPPER]
        : priceUpper && initialPriceUpper?.equalTo(priceUpper.asFraction)
        ? priceToClosestTick(priceUpper as Price<ERC20Token, ERC20Token>)
        : invertPrice
        ? tryParseTick(quoteCurrency?.wrapped, baseCurrency?.wrapped, tickSpacing, leftRangeTypedValue)
        : tryParseTick(baseCurrency?.wrapped, quoteCurrency?.wrapped, tickSpacing, rightRangeTypedValue),
    [
      priceUpper,
      initialPriceUpper,
      fullRange,
      tickSpaceLimits,
      invertPrice,
      quoteCurrency?.wrapped,
      baseCurrency?.wrapped,
      tickSpacing,
      leftRangeTypedValue,
      rightRangeTypedValue,
    ]
  );

  const ticksAtLimit = useMemo(
    () => ({
      [Bound.LOWER]: tickLower === tickSpaceLimits[Bound.LOWER],
      [Bound.UPPER]: tickUpper === tickSpaceLimits[Bound.UPPER],
    }),
    [tickUpper, tickLower, tickSpaceLimits]
  );

  const saveSetPriceUpper = useCallback(
    (price?: Price<Token, Token>) => {
      if (!price || !priceLimits.UPPER) {
        return;
      }
      const priceToSet = price.greaterThan(priceLimits.UPPER) ? priceLimits.UPPER : price;
      setPriceUpper(priceToSet);
    },
    [priceLimits]
  );

  const saveSetPriceLower = useCallback(
    (price?: Price<Token, Token>) => {
      if (!price || !priceLimits.LOWER) {
        return;
      }
      const priceToSet = price.lessThan(priceLimits.LOWER) ? priceLimits.LOWER : price;
      setPriceLower(priceToSet);
    },
    [priceLimits]
  );

  const onLeftRangeInput = useCallback(
    (leftRangeValue: string) => {
      const price = tryParsePrice(baseCurrency?.wrapped, quoteCurrency?.wrapped, leftRangeValue);
      if (!invertPrice) {
        return saveSetPriceLower(price);
      }
      return saveSetPriceUpper(price?.invert());
    },
    [baseCurrency, quoteCurrency, invertPrice, saveSetPriceUpper, saveSetPriceLower]
  );

  const onRightRangeInput = useCallback(
    (rightRangeValue: string) => {
      const price = tryParsePrice(baseCurrency?.wrapped, quoteCurrency?.wrapped, rightRangeValue);
      if (!invertPrice) {
        return saveSetPriceUpper(price);
      }
      return saveSetPriceLower(price?.invert());
    },
    [baseCurrency, quoteCurrency, invertPrice, saveSetPriceUpper, saveSetPriceLower]
  );

  const onBothRangeInput = useCallback(
    (leftRangeValue: string, rightRangeValue: string) => {
      onLeftRangeInput(leftRangeValue);
      onRightRangeInput(rightRangeValue);
    },
    [onLeftRangeInput, onRightRangeInput]
  );

  const toggleFullRange = useCallback(() => setFullRange(!fullRange), [fullRange]);

  useEffect(() => setPriceLower(initialPriceLower), [initialPriceLower]);

  useEffect(() => setPriceUpper(initialPriceUpper), [initialPriceUpper]);

  return useMemo(
    () => ({
      ticksAtLimit,
      tickUpper,
      tickLower,
      priceLower: fullRange ? priceLimits[Bound.LOWER] : priceLower,
      priceUpper: fullRange ? priceLimits[Bound.UPPER] : priceUpper,
      onRightRangeInput,
      onLeftRangeInput,
      onBothRangeInput,
      toggleFullRange,
      fullRange,
    }),
    [
      ticksAtLimit,
      tickUpper,
      tickLower,
      priceLower,
      priceUpper,
      fullRange,
      onRightRangeInput,
      onLeftRangeInput,
      onBothRangeInput,
      toggleFullRange,
    ]
  );
}
