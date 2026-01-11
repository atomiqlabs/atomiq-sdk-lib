import {ISwapPrice, PriceInfoType} from "./prices/abstract/ISwapPrice";

export type BtcToken<L = boolean> = {
    chain: "BTC",
    lightning: L,
    ticker: "BTC",
    decimals: 8,
    name: L extends true ? "Bitcoin (lightning L2)" : "Bitcoin (on-chain L1)",
    displayDecimals?: number
};

export function isBtcToken(obj: any): obj is BtcToken {
    return typeof(obj)==="object" &&
        obj.chain==="BTC" &&
        typeof(obj.lightning)==="boolean" &&
        typeof(obj.ticker)==="string" &&
        typeof(obj.decimals)==="number" &&
        typeof(obj.name)==="string";
}

export const BitcoinTokens: {
    BTC: BtcToken<false>,
    BTCLN: BtcToken<true>
} = {
    BTC: {
        chain: "BTC",
        lightning: false,
        ticker: "BTC",
        decimals: 8,
        name: "Bitcoin (on-chain L1)"
    },
    BTCLN: {
        chain: "BTC",
        lightning: true,
        ticker: "BTC",
        decimals: 8,
        name: "Bitcoin (lightning L2)"
    }
};

export type SCToken<ChainIdentifier extends string = string> = {
    chain: "SC",
    chainId: ChainIdentifier,
    address: string,
    ticker: string,
    decimals: number,
    displayDecimals?: number,
    name: string
}

export function isSCToken(obj: any): obj is SCToken {
    return typeof(obj)==="object" &&
        obj.chain==="SC" &&
        typeof(obj.chainId)==="string" &&
        typeof(obj.address)==="string" &&
        typeof(obj.ticker)==="string" &&
        typeof(obj.decimals)==="number" &&
        typeof(obj.name)==="string";
}

export type Token<ChainIdentifier extends string = string> = BtcToken | SCToken<ChainIdentifier>;

export function isToken(obj: any): obj is Token {
    return isBtcToken(obj) || isSCToken(obj);
}

/**
 * Represents a token amount along with its formatted values and USD valuation helpers
 */
export type TokenAmount<
    ChainIdentifier extends string = string,
    T extends Token<ChainIdentifier> = Token<ChainIdentifier>
> = {
    /**
     * Raw amount in base units represented as bigint
     */
    rawAmount: bigint,
    /**
     * Human readable amount with decimal places
     */
    amount: string,
    /**
     * Number representation of the decimal token amount (can lose precision!)
     */
    _amount: number,
    /**
     * Token associated with this amount
     */
    token: T,
    /**
     * Fetches the current USD value of the amount
     *
     * @param abortSignal
     * @param preFetchedUsdPrice You can supply a pre-fetched usd price to the pricing function
     * @returns A promise resolving to the current USD value of the token amount
     */
    currentUsdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>,
    /**
     * Gets USD value of the amount, if this amount was returned from a swap it uses the USD value
     *  when the swap was created, otherwise fetches the usd value on-demand
     *
     * @param abortSignal
     * @param preFetchedUsdPrice You can supply a pre-fetched usd price to the pricing function
     * @returns A promise resolving to the current USD value of the token amount
     */
    usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>,
    /**
     * USD value of the amount when swap was created - only present for token amounts obtained
     *  from swaps, left for convenience only, use usdValue() instead, which automatically
     *  recognizes which pricing to use (either past value if available or fetches it on-demand)
     */
    pastUsdValue?: number,
    /**
     * Returns the string representation of the amount along with the token ticker in format: {amount} {ticker}
     */
    toString: () => string
};

export function fromDecimal(amount: string, decimalCount: number) {
    if(amount.includes(".")) {
        const [before, after] = amount.split(".");
        if(decimalCount<0) {
            return BigInt(before.substring(0, before.length+decimalCount));
        }
        if(after.length>decimalCount) {
            //Cut the last digits
            return BigInt((before==="0" ? "" : before)+after.substring(0, decimalCount));
        }
        return BigInt((before==="0" ? "" : before)+after.padEnd(decimalCount, "0"));
    } else {
        if(decimalCount<0) {
            return BigInt(amount.substring(0, amount.length+decimalCount));
        } else {
            return BigInt(amount+"0".repeat(decimalCount));
        }
    }

}

export function toDecimal(amount: bigint, decimalCount: number, cut?: boolean, displayDecimals?: number) {
    if(decimalCount<=0) {
        return amount.toString(10)+"0".repeat(-decimalCount);
    }

    const amountStr = amount.toString(10).padStart(decimalCount+1, "0");

    const splitPoint = amountStr.length-decimalCount;

    const decimalPart = amountStr.substring(splitPoint, amountStr.length);
    let cutTo = decimalPart.length;
    if(cut && cutTo>0) {
        for(let i=decimalPart.length-1;i--;i>=0) {
            if(decimalPart.charAt(i)==="0") {
                cutTo = i;
            } else break;
        }
        if(cutTo===0) cutTo = 1;
    }

    if(displayDecimals===0) return amountStr.substring(0, splitPoint);
    if(displayDecimals!=null && cutTo > displayDecimals) cutTo = displayDecimals;
    return amountStr.substring(0, splitPoint)+"."+decimalPart.substring(0, cutTo);
}

export function toTokenAmount<
    ChainIdentifier extends string = string,
    T extends Token<ChainIdentifier> = Token<ChainIdentifier>
>(
    amount: bigint,
    token:  T,
    prices: ISwapPrice,
    pricingInfo?: PriceInfoType
): TokenAmount<ChainIdentifier, T> {
    if(amount==null) return {
        rawAmount: null,
        amount: null,
        _amount: null,
        token,
        currentUsdValue: () => Promise.resolve(null),
        pastUsdValue: null,
        usdValue: () => Promise.resolve(null),
        toString: () => "??? "+token.ticker
    };
    const amountStr = toDecimal(amount, token.decimals, undefined, token.displayDecimals);
    const _amount = parseFloat(amountStr);

    let usdValue: number | undefined = undefined;
    if(pricingInfo!=null) {
        if(token.chain==="BTC" && token.ticker==="BTC") {
            if(pricingInfo.realPriceUsdPerBitcoin!=null) {
                usdValue = _amount * pricingInfo.realPriceUsdPerBitcoin;
            }
        } else {
            if(pricingInfo.realPriceUsdPerBitcoin!=null && pricingInfo.realPriceUSatPerToken!=null) {
                usdValue = _amount
                    * pricingInfo.realPriceUsdPerBitcoin
                    * Number(pricingInfo.realPriceUSatPerToken)
                    / 100_000_000_000_000;
            }
        }
    }

    const currentUsdValue = (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) =>
        prices.getUsdValue(amount, token, abortSignal, preFetchedUsdPrice);

    return {
        rawAmount: amount,
        amount: amountStr,
        _amount,
        token,
        currentUsdValue,
        pastUsdValue: usdValue,
        usdValue: async (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => {
            if(usdValue==null) {
                usdValue = await currentUsdValue(abortSignal, preFetchedUsdPrice);
            }
            return usdValue;
        },
        toString: () => amountStr+" "+token.ticker
    };
}
