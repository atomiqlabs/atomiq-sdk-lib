import { ISwapPrice, PriceInfoType } from "./prices/abstract/ISwapPrice";
export type BtcToken<L = boolean> = {
    chain: "BTC";
    lightning: L;
    ticker: "BTC";
    decimals: 8;
    name: L extends true ? "Bitcoin (lightning L2)" : "Bitcoin (on-chain L1)";
    displayDecimals?: number;
};
export declare function isBtcToken(obj: any): obj is BtcToken;
export declare const BitcoinTokens: {
    BTC: BtcToken<false>;
    BTCLN: BtcToken<true>;
};
export type SCToken<ChainIdentifier extends string = string> = {
    chain: "SC";
    chainId: ChainIdentifier;
    address: string;
    ticker: string;
    decimals: number;
    displayDecimals?: number;
    name: string;
};
export declare function isSCToken(obj: any): obj is SCToken;
export type Token<ChainIdentifier extends string = string> = BtcToken | SCToken<ChainIdentifier>;
export declare function isToken(obj: any): obj is Token;
/**
 * Represents a token amount along with its formatted values and USD valuation helpers
 */
export type TokenAmount<ChainIdentifier extends string = string, T extends Token<ChainIdentifier> = Token<ChainIdentifier>> = {
    /**
     * Raw amount in base units represented as bigint
     */
    rawAmount: bigint;
    /**
     * Human readable amount with decimal places
     */
    amount: string;
    /**
     * Number representation of the decimal token amount (can lose precision!)
     */
    _amount: number;
    /**
     * Token associated with this amount
     */
    token: T;
    /**
     * Fetches the current USD value of the amount
     *
     * @param abortSignal
     * @param preFetchedUsdPrice You can supply a pre-fetched usd price to the pricing function
     * @returns A promise resolving to the current USD value of the token amount
     */
    currentUsdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>;
    /**
     * Gets USD value of the amount, if this amount was returned from a swap it uses the USD value
     *  when the swap was created, otherwise fetches the usd value on-demand
     *
     * @param abortSignal
     * @param preFetchedUsdPrice You can supply a pre-fetched usd price to the pricing function
     * @returns A promise resolving to the current USD value of the token amount
     */
    usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>;
    /**
     * USD value of the amount when swap was created - only present for token amounts obtained
     *  from swaps, left for convenience only, use usdValue() instead, which automatically
     *  recognizes which pricing to use (either past value if available or fetches it on-demand)
     */
    pastUsdValue?: number;
    /**
     * Returns the string representation of the amount along with the token ticker in format: {amount} {ticker}
     */
    toString: () => string;
};
export declare function fromDecimal(amount: string, decimalCount: number): bigint;
export declare function toDecimal(amount: bigint, decimalCount: number, cut?: boolean, displayDecimals?: number): string;
export declare function toTokenAmount<ChainIdentifier extends string = string, T extends Token<ChainIdentifier> = Token<ChainIdentifier>>(amount: bigint, token: T, prices: ISwapPrice, pricingInfo?: PriceInfoType): TokenAmount<ChainIdentifier, T>;
