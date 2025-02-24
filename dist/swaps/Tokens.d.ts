import * as BN from 'bn.js';
import { ISwapPrice } from "../prices/abstract/ISwapPrice";
export type BtcToken<L = boolean> = {
    chain: "BTC";
    lightning: L;
    ticker: L extends true ? "BTCLN" : "BTC";
    decimals: 8;
    name: L extends true ? "Bitcoin (lightning L2)" : "Bitcoin (on-chain L1)";
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
    name: string;
};
export declare function isSCToken(obj: any): obj is SCToken;
export type Token<ChainIdentifier extends string = string> = BtcToken | SCToken<ChainIdentifier>;
export declare function isToken(obj: any): obj is Token;
export type TokenAmount<ChainIdentifier extends string = string, T extends Token<ChainIdentifier> = Token<ChainIdentifier>> = {
    rawAmount: BN;
    amount: string;
    _amount: number;
    token: T;
    usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>;
};
export declare function fromDecimal(amount: string, decimalCount: number): BN;
export declare function toDecimal(amount: BN, decimalCount: number, cut?: boolean): string;
export declare function toTokenAmount<ChainIdentifier extends string = string, T extends Token<ChainIdentifier> = Token<ChainIdentifier>>(amount: BN, token: T, prices: ISwapPrice): TokenAmount<ChainIdentifier, T>;
