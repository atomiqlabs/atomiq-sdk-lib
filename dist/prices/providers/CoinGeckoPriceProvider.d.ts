import * as BN from "bn.js";
import { CoinType, CtorCoinTypes } from "../abstract/IPriceProvider";
import { HttpPriceProvider } from "./abstract/HttpPriceProvider";
import { MultiChain } from "../../swaps/Swapper";
export type CoinGeckoResponse<Currency extends string> = {
    [coinId: string]: {
        [c in Currency]: number;
    };
};
export declare class CoinGeckoPriceProvider<T extends MultiChain> extends HttpPriceProvider<T> {
    constructor(coinsMap: CtorCoinTypes<T>, url?: string, httpRequestTimeout?: number);
    protected fetchPrice(token: CoinType, abortSignal?: AbortSignal): Promise<BN>;
    protected fetchUsdPrice(abortSignal?: AbortSignal): Promise<number>;
}
