/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { FromBTCLNSwap } from "./FromBTCLNSwap";
import { IFromBTCWrapper } from "../IFromBTCWrapper";
import * as BN from "bn.js";
import { ChainType, ClaimEvent, InitializeEvent, IStorageManager, RefundEvent } from "@atomiqlabs/base";
import { Intermediary } from "../../../intermediaries/Intermediary";
import { Buffer } from "buffer";
import { LightningNetworkApi } from "../../../btc/LightningNetworkApi";
import { ISwapPrice } from "../../../prices/abstract/ISwapPrice";
import { EventEmitter } from "events";
import { AmountData, ISwapWrapperOptions, WrapperCtorTokens } from "../../ISwapWrapper";
import { LNURLWithdrawParamsWithUrl } from "../../../utils/LNURL";
export type FromBTCLNOptions = {
    descriptionHash?: Buffer;
};
export declare class FromBTCLNWrapper<T extends ChainType> extends IFromBTCWrapper<T, FromBTCLNSwap<T>> {
    protected readonly swapDeserializer: typeof FromBTCLNSwap;
    protected readonly lnApi: LightningNetworkApi;
    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param prices Swap pricing handler
     * @param chainEvents On-chain event listener
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param lnApi
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier: string, storage: IStorageManager<FromBTCLNSwap<T>>, contract: T["Contract"], chainEvents: T["Events"], prices: ISwapPrice, tokens: WrapperCtorTokens, swapDataDeserializer: new (data: any) => T["Data"], lnApi: LightningNetworkApi, options: ISwapWrapperOptions, events?: EventEmitter);
    protected checkPastSwap(swap: FromBTCLNSwap<T>): Promise<boolean>;
    protected tickSwap(swap: FromBTCLNSwap<T>): void;
    protected processEventInitialize(swap: FromBTCLNSwap<T>, event: InitializeEvent<T["Data"]>): Promise<boolean>;
    protected processEventClaim(swap: FromBTCLNSwap<T>, event: ClaimEvent<T["Data"]>): Promise<boolean>;
    protected processEventRefund(swap: FromBTCLNSwap<T>, event: RefundEvent<T["Data"]>): Promise<boolean>;
    /**
     * Generates a new 32-byte secret to be used as pre-image for lightning network invoice & HTLC swap\
     *
     * @private
     * @returns Hash pre-image & payment hash
     */
    private getSecretAndHash;
    /**
     * Pre-fetches intermediary's LN node capacity, doesn't throw, instead returns null
     *
     * @param pubkeyPromise Promise that resolves when we receive "lnPublicKey" param from the intermediary thorugh
     *  streaming
     * @private
     * @returns LN Node liquidity
     */
    private preFetchLnCapacity;
    /**
     * Verifies response returned from intermediary
     *
     * @param resp Response as returned by the intermediary
     * @param amountData
     * @param lp Intermediary
     * @param options Options as passed to the swap creation function
     * @param decodedPr Decoded bolt11 lightning network invoice
     * @param amountIn Amount in sats that will be paid for the swap
     * @private
     * @throws {IntermediaryError} in case the response is invalid
     */
    private verifyReturnedData;
    /**
     * Verifies whether the intermediary's lightning node has enough inbound capacity to receive the LN payment
     *
     * @param lp Intermediary
     * @param decodedPr Decoded bolt11 lightning network invoice
     * @param amountIn Amount to be paid for the swap in sats
     * @param lnCapacityPrefetchPromise Pre-fetch for LN node capacity, preFetchLnCapacity()
     * @param abortSignal
     * @private
     * @throws {IntermediaryError} if the lightning network node doesn't have enough inbound liquidity
     * @throws {Error} if the lightning network node's inbound liquidity might be enough, but the swap would
     *  deplete more than half of the liquidity
     */
    private verifyLnNodeCapacity;
    /**
     * Returns a newly created swap, receiving 'amount' on lightning network
     *
     * @param signer                Smart chain signer's address intiating the swap
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     * @param preFetches
     */
    create(signer: string, amountData: AmountData, lps: Intermediary[], options: FromBTCLNOptions, additionalParams?: Record<string, any>, abortSignal?: AbortSignal, preFetches?: {
        pricePrefetchPromise?: Promise<BN>;
        feeRatePromise?: Promise<any>;
    }): {
        quote: Promise<FromBTCLNSwap<T>>;
        intermediary: Intermediary;
    }[];
    /**
     * Parses and fetches lnurl withdraw params from the specified lnurl
     *
     * @param lnurl LNURL to be parsed and fetched
     * @param abortSignal
     * @private
     * @throws {UserError} if the LNURL is invalid or if it's not a LNURL-withdraw
     */
    private getLNURLWithdraw;
    /**
     * Returns a newly created swap, receiving 'amount' from the lnurl-withdraw
     *
     * @param signer                Smart chains signer's address intiating the swap
     * @param lnurl                 LNURL-withdraw to withdraw funds from
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    createViaLNURL(signer: string, lnurl: string | LNURLWithdrawParamsWithUrl, amountData: AmountData, lps: Intermediary[], additionalParams?: Record<string, any>, abortSignal?: AbortSignal): Promise<{
        quote: Promise<FromBTCLNSwap<T>>;
        intermediary: Intermediary;
    }[]>;
}
