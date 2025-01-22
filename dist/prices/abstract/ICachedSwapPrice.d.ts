import { ISwapPrice } from "./ISwapPrice";
import BN from "bn.js";
import { ChainIds, MultiChain } from "../../swaps/Swapper";
export declare abstract class ICachedSwapPrice<T extends MultiChain> extends ISwapPrice<T> {
    cache: {
        [chainIdentifier in keyof T]?: {
            [tokenAddress: string]: {
                price: Promise<BN>;
                expiry: number;
            };
        };
    };
    usdCache: {
        price: Promise<number>;
        expiry: number;
    };
    cacheTimeout: number;
    protected constructor(maxAllowedFeeDiffPPM: BN, cacheTimeout?: number);
    protected abstract fetchPrice<C extends ChainIds<T>>(chainIdentifier: C, token: string, abortSignal?: AbortSignal): Promise<BN>;
    protected abstract fetchUsdPrice(abortSignal?: AbortSignal): Promise<number>;
    protected getPrice<C extends ChainIds<T>>(chainIdentifier: C, tokenAddress: string, abortSignal?: AbortSignal): Promise<BN>;
    /**
     * Returns BTC price in USD (sats/USD)
     *
     * @param abortSignal
     * @throws {Error} if token is not found
     */
    protected getUsdPrice(abortSignal?: AbortSignal): Promise<number>;
}
