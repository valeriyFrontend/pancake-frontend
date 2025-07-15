import { PublicKey } from "@solana/web3.js";

import { PublicKeyish, SOLMint, validateAndParsePublicKey } from "../common/pubKey";
import { TOKEN_WSOL } from "../raydium/token/constant";

/**
 * A token is any fungible financial instrument on Solana, including SOL and all SPL tokens.
 */
export interface TokenProps {
  mint: PublicKeyish;
  decimals: number;
  symbol?: string;
  name?: string;
  skipMint?: boolean;
  isToken2022?: boolean;
}

export class Token {
  public readonly symbol?: string;
  public readonly name?: string;
  public readonly decimals: number;
  public readonly isToken2022: boolean;

  public readonly mint: PublicKey;
  public static readonly WSOL: Token = new Token({
    ...TOKEN_WSOL,
    mint: TOKEN_WSOL.address,
  });

  /**
   *
   * @param mint - pass "sol" as mint will auto generate wsol token config
   */
  public constructor({ mint, decimals, symbol, name, skipMint = false, isToken2022 = false }: TokenProps) {
    if (mint === SOLMint.toBase58() || (mint instanceof PublicKey && SOLMint.equals(mint))) {
      this.decimals = TOKEN_WSOL.decimals;
      this.symbol = TOKEN_WSOL.symbol;
      this.name = TOKEN_WSOL.name;
      this.mint = new PublicKey(TOKEN_WSOL.address);
      this.isToken2022 = false;
      return;
    }

    this.decimals = decimals;
    this.symbol = symbol || mint.toString().substring(0, 6);
    this.name = name || mint.toString().substring(0, 6);
    this.mint = skipMint ? PublicKey.default : validateAndParsePublicKey({ publicKey: mint });
    this.isToken2022 = isToken2022;
  }

  public equals(other: Token): boolean {
    // short circuit on reference equality
    if (this === other) {
      return true;
    }
    return this.mint.equals(other.mint);
  }
}
