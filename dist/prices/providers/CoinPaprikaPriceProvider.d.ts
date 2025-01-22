import { CoinType, CtorCoinTypes } from "../abstract/IPriceProvider";
import * as BN from "bn.js";
import { HttpPriceProvider } from "./abstract/HttpPriceProvider";
import { MultiChain } from "../../swaps/Swapper";
export type CoinPaprikaResponse<Currency extends string> = {
    quotes: {
        [curr in Currency]: {
            price: number;
        };
    };
};
export declare class CoinPaprikaPriceProvider<T extends MultiChain> extends HttpPriceProvider<T> {
    constructor(coinsMap: CtorCoinTypes<T>, url?: string, httpRequestTimeout?: number);
    fetchPrice(token: CoinType, abortSignal?: AbortSignal): Promise<BN>;
    protected fetchUsdPrice(abortSignal?: AbortSignal): Promise<number>;
}
