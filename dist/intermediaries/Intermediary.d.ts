import { SwapType } from "../swaps/SwapType";
import { SwapHandlerInfoType } from "./IntermediaryDiscovery";
import * as BN from "bn.js";
import { ChainSwapType, SwapContract } from "@atomiqlabs/base";
import { LNNodeLiquidity } from "../btc/LightningNetworkApi";
export type ServicesType = {
    [key in SwapType]?: SwapHandlerInfoType;
};
export type SingleChainReputationType = {
    [token: string]: {
        [key in ChainSwapType]: {
            successVolume: BN;
            successCount: BN;
            failVolume: BN;
            failCount: BN;
            coopCloseVolume: BN;
            coopCloseCount: BN;
        };
    };
};
export type SCLiquidity = {
    [token: string]: BN;
};
export declare class Intermediary {
    readonly url: string;
    readonly addresses: {
        [chainIdentifier: string]: string;
    };
    readonly services: ServicesType;
    reputation: {
        [chainIdentifier: string]: SingleChainReputationType;
    };
    liquidity: {
        [chainIdentifier: string]: SCLiquidity;
    };
    lnData: LNNodeLiquidity;
    constructor(url: string, addresses: {
        [chainIdentifier: string]: string;
    }, services: ServicesType, reputation?: {
        [chainIdentifier: string]: SingleChainReputationType;
    });
    /**
     * Returns tokens supported by the intermediary, optionally constrained to the specific swap types
     *
     * @param chainIdentifier
     * @param swapTypesArr
     * @private
     */
    private getSupportedTokens;
    /**
     * Fetches, returns and saves the reputation of the intermediary, either for all or just for a single token
     *
     * @param chainIdentifier
     * @param swapContract
     * @param tokens
     * @param abortSignal
     */
    getReputation(chainIdentifier: string, swapContract: SwapContract<any>, tokens?: string[], abortSignal?: AbortSignal): Promise<SingleChainReputationType>;
    /**
     * Fetches, returns and saves the liquidity of the intermediaryfor a specific token
     *
     * @param chainIdentifier
     * @param swapContract
     * @param token
     * @param abortSignal
     */
    getLiquidity(chainIdentifier: string, swapContract: SwapContract<any>, token: string, abortSignal?: AbortSignal): Promise<BN>;
    supportsChain(chainIdentifier: string): boolean;
    getAddress(chainIdentifier: string): string;
}
