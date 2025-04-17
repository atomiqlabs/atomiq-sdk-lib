import {Token, TokenAmount} from "../../Tokens";

export type Fee<
    ChainIdentifier extends string = string,
    TSrc extends Token<ChainIdentifier> = Token<ChainIdentifier>,
    TDst extends Token<ChainIdentifier> = Token<ChainIdentifier>
> = {
    amountInSrcToken: TokenAmount<ChainIdentifier, TSrc>;
    amountInDstToken: TokenAmount<ChainIdentifier, TDst>;
    usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>;
}

export enum FeeType {
    SWAP = 0,
    NETWORK_OUTPUT = 1,
    WATCHTOWER = 2
}

export type FeeBreakdown<ChainIdentifier extends string = string> = {
    type: FeeType,
    fee: Fee<ChainIdentifier>
}[];
