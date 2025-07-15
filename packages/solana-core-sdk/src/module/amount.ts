import _Big from "big.js";
import BN from "bn.js";

import { BigNumberish, BN_TEN } from "../common/bignumber";
import { createLogger, Logger } from "../common/logger";

import { parseBigNumberish, Rounding } from "../common";
import { Currency } from "./currency";
import toFormat, { WrappedBig } from "./formatter";
import { Fraction } from "./fraction";
import { Token } from "./token";

const logger = createLogger("Raydium_amount");

const Big = toFormat(_Big);
type Big = WrappedBig;

export function splitNumber(num: string, decimals: number): [string, string] {
  let integral = "0";
  let fractional = "0";

  if (num.includes(".")) {
    const splited = num.split(".");
    if (splited.length === 2) {
      [integral, fractional] = splited;
      fractional = fractional.padEnd(decimals, "0");
    } else {
      logger.logWithError(`invalid number string, num: ${num}`);
    }
  } else {
    integral = num;
  }

  // fix decimals is 0
  return [integral, fractional.slice(0, decimals) || fractional];
}

export class TokenAmount extends Fraction {
  public readonly token: Token;
  protected logger: Logger;

  public constructor(token: Token, amount: BigNumberish, isRaw = true, name?: string) {
    let parsedAmount = new BN(0);
    const multiplier = BN_TEN.pow(new BN(token.decimals));

    if (isRaw) {
      parsedAmount = parseBigNumberish(amount);
    } else {
      let integralAmount = new BN(0);
      let fractionalAmount = new BN(0);

      // parse fractional string
      if (typeof amount === "string" || typeof amount === "number" || typeof amount === "bigint") {
        const [integral, fractional] = splitNumber(amount.toString(), token.decimals);
        integralAmount = parseBigNumberish(integral);
        fractionalAmount = parseBigNumberish(fractional);
      }

      integralAmount = integralAmount.mul(multiplier);
      parsedAmount = integralAmount.add(fractionalAmount);
    }

    super(parsedAmount, multiplier);
    this.logger = createLogger(name || "TokenAmount");
    this.token = token;
  }

  public get raw(): BN {
    return this.numerator;
  }
  public isZero(): boolean {
    return this.raw.isZero();
  }
  public gt(other: TokenAmount): boolean {
    if (!this.token.equals(other.token)) this.logger.logWithError("gt token not equals");
    return this.raw.gt(other.raw);
  }

  /**
   * a less than b
   */
  public lt(other: TokenAmount): boolean {
    if (!this.token.equals(other.token)) this.logger.logWithError("lt token not equals");
    return this.raw.lt(other.raw);
  }

  public add(other: TokenAmount): TokenAmount {
    if (!this.token.equals(other.token)) this.logger.logWithError("add token not equals");
    return new TokenAmount(this.token, this.raw.add(other.raw));
  }

  public subtract(other: TokenAmount): TokenAmount {
    if (!this.token.equals(other.token)) this.logger.logWithError("sub token not equals");
    return new TokenAmount(this.token, this.raw.sub(other.raw));
  }

  public toSignificant(
    significantDigits = this.token.decimals,
    format?: object,
    rounding: Rounding = Rounding.ROUND_DOWN,
  ): string {
    return super.toSignificant(significantDigits, format, rounding);
  }

  /**
   * To fixed
   *
   * @example
   * ```
   * 1 -> 1.000000000
   * 1.234 -> 1.234000000
   * 1.123456789876543 -> 1.123456789
   * ```
   */
  public toFixed(
    decimalPlaces = this.token.decimals,
    format?: object,
    rounding: Rounding = Rounding.ROUND_DOWN,
  ): string {
    if (decimalPlaces > this.token.decimals) this.logger.logWithError("decimals overflow");
    return super.toFixed(decimalPlaces, format, rounding);
  }

  /**
   * To exact
   *
   * @example
   * ```
   * 1 -> 1
   * 1.234 -> 1.234
   * 1.123456789876543 -> 1.123456789
   * ```
   */
  public toExact(format: object = { groupSeparator: "" }): string {
    Big.DP = this.token.decimals;
    return new Big(this.numerator.toString()).div(this.denominator.toString()).toFormat(format);
  }
}

export class CurrencyAmount extends Fraction {
  public readonly currency: Currency;
  protected logger: Logger;

  public constructor(currency: Currency, amount: BigNumberish, isRaw = true, name?: string) {
    let parsedAmount = new BN(0);
    const multiplier = BN_TEN.pow(new BN(currency.decimals));

    if (isRaw) {
      parsedAmount = parseBigNumberish(amount);
    } else {
      let integralAmount = new BN(0);
      let fractionalAmount = new BN(0);

      // parse fractional string
      if (typeof amount === "string" || typeof amount === "number" || typeof amount === "bigint") {
        const [integral, fractional] = splitNumber(amount.toString(), currency.decimals);
        integralAmount = parseBigNumberish(integral);
        fractionalAmount = parseBigNumberish(fractional);
      }

      integralAmount = integralAmount.mul(multiplier);
      parsedAmount = integralAmount.add(fractionalAmount);
    }

    super(parsedAmount, multiplier);
    this.logger = createLogger(name || "TokenAmount");
    this.currency = currency;
  }

  public get raw(): BN {
    return this.numerator;
  }

  public isZero(): boolean {
    return this.raw.isZero();
  }

  /**
   * a greater than b
   */
  public gt(other: CurrencyAmount): boolean {
    if (!this.currency.equals(other.currency)) this.logger.logWithError("gt currency not equals");
    return this.raw.gt(other.raw);
  }

  /**
   * a less than b
   */
  public lt(other: CurrencyAmount): boolean {
    if (!this.currency.equals(other.currency)) this.logger.logWithError("lt currency not equals");
    return this.raw.lt(other.raw);
  }

  public add(other: CurrencyAmount): CurrencyAmount {
    if (!this.currency.equals(other.currency)) this.logger.logWithError("add currency not equals");
    return new CurrencyAmount(this.currency, this.raw.add(other.raw));
  }

  public sub(other: CurrencyAmount): CurrencyAmount {
    if (!this.currency.equals(other.currency)) this.logger.logWithError("sub currency not equals");
    return new CurrencyAmount(this.currency, this.raw.sub(other.raw));
  }

  public toSignificant(
    significantDigits = this.currency.decimals,
    format?: object,
    rounding: Rounding = Rounding.ROUND_DOWN,
  ): string {
    return super.toSignificant(significantDigits, format, rounding);
  }

  /**
   * To fixed
   *
   * @example
   * ```
   * 1 -> 1.000000000
   * 1.234 -> 1.234000000
   * 1.123456789876543 -> 1.123456789
   * ```
   */
  public toFixed(
    decimalPlaces = this.currency.decimals,
    format?: object,
    rounding: Rounding = Rounding.ROUND_DOWN,
  ): string {
    if (decimalPlaces > this.currency.decimals) this.logger.logWithError("decimals overflow");

    return super.toFixed(decimalPlaces, format, rounding);
  }

  /**
   * To exact
   *
   * @example
   * ```
   * 1 -> 1
   * 1.234 -> 1.234
   * 1.123456789876543 -> 1.123456789
   * ```
   */
  public toExact(format: object = { groupSeparator: "" }): string {
    Big.DP = this.currency.decimals;
    return new Big(this.numerator.toString()).div(this.denominator.toString()).toFormat(format);
  }
}
