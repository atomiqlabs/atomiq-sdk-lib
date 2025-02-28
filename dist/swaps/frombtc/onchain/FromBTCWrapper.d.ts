/// <reference types="node" />
import { IFromBTCWrapper } from "../IFromBTCWrapper";
import { FromBTCSwap } from "./FromBTCSwap";
import { ChainType, ClaimEvent, InitializeEvent, IStorageManager, RefundEvent, RelaySynchronizer, SwapData, BtcRelay } from "@atomiqlabs/base";
import { EventEmitter } from "events";
import { Intermediary } from "../../../intermediaries/Intermediary";
import { BitcoinRpcWithTxoListener } from "../../../btc/BitcoinRpcWithTxoListener";
import { ISwapPrice } from "../../../prices/abstract/ISwapPrice";
import { AmountData, ISwapWrapperOptions, WrapperCtorTokens } from "../../ISwapWrapper";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
export type FromBTCOptions = {
    feeSafetyFactor?: bigint;
    blockSafetyFactor?: number;
};
export type FromBTCWrapperOptions = ISwapWrapperOptions & {
    safetyFactor?: number;
    blocksTillTxConfirms?: number;
    maxConfirmations?: number;
    minSendWindow?: number;
    bitcoinNetwork?: BTC_NETWORK;
    bitcoinBlocktime?: number;
};
export declare class FromBTCWrapper<T extends ChainType> extends IFromBTCWrapper<T, FromBTCSwap<T>, FromBTCWrapperOptions> {
    protected readonly swapDeserializer: typeof FromBTCSwap;
    readonly synchronizer: RelaySynchronizer<any, T["TX"], any>;
    readonly btcRelay: BtcRelay<any, T["TX"], any>;
    readonly btcRpc: BitcoinRpcWithTxoListener<any>;
    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param chainEvents On-chain event listener
     * @param prices Pricing to use
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param btcRelay
     * @param synchronizer Btc relay synchronizer
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier: string, storage: IStorageManager<FromBTCSwap<T>>, contract: T["Contract"], chainEvents: T["Events"], prices: ISwapPrice, tokens: WrapperCtorTokens, swapDataDeserializer: new (data: any) => T["Data"], btcRelay: BtcRelay<any, T["TX"], any>, synchronizer: RelaySynchronizer<any, T["TX"], any>, btcRpc: BitcoinRpcWithTxoListener<any>, options?: FromBTCWrapperOptions, events?: EventEmitter);
    protected checkPastSwap(swap: FromBTCSwap<T>): Promise<boolean>;
    protected tickSwap(swap: FromBTCSwap<T>): void;
    protected processEventInitialize(swap: FromBTCSwap<T>, event: InitializeEvent<T["Data"]>): Promise<boolean>;
    protected processEventClaim(swap: FromBTCSwap<T>, event: ClaimEvent<T["Data"]>): Promise<boolean>;
    protected processEventRefund(swap: FromBTCSwap<T>, event: RefundEvent<T["Data"]>): Promise<boolean>;
    /**
     * Returns the swap expiry, leaving enough time for the user to send a transaction and for it to confirm
     *
     * @param data Parsed swap data
     * @param requiredConfirmations Confirmations required to claim the tx
     */
    getOnchainSendTimeout(data: SwapData, requiredConfirmations: number): bigint;
    /**
     * Pre-fetches claimer (watchtower) bounty data for the swap. Doesn't throw, instead returns null and aborts the
     *  provided abortController
     *
     * @param signer Smartchain signer address initiating the swap
     * @param amountData
     * @param options Options as passed to the swap creation function
     * @param abortController
     * @private
     */
    private preFetchClaimerBounty;
    /**
     * Returns calculated claimer bounty calculated from the claimer bounty data as fetched from preFetchClaimerBounty()
     *
     * @param data Parsed swap data returned from the intermediary
     * @param options Options as passed to the swap creation function
     * @param claimerBounty Claimer bounty data as fetched from preFetchClaimerBounty() function
     * @private
     */
    private getClaimerBounty;
    /**
     * Verifies response returned from intermediary
     *
     * @param resp Response as returned by the intermediary
     * @param amountData
     * @param lp Intermediary
     * @param options Options as passed to the swap creation function
     * @param data Parsed swap data returned by the intermediary
     * @param sequence Required swap sequence
     * @param claimerBounty Claimer bount data as returned from the preFetchClaimerBounty() pre-fetch promise
     * @param depositToken
     * @private
     * @throws {IntermediaryError} in case the response is invalid
     */
    private verifyReturnedData;
    /**
     * Returns a newly created swap, receiving 'amount' on chain
     *
     * @param signer                Smartchain signer's address intiating the swap
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    create(signer: string, amountData: AmountData, lps: Intermediary[], options?: FromBTCOptions, additionalParams?: Record<string, any>, abortSignal?: AbortSignal): {
        quote: Promise<FromBTCSwap<T>>;
        intermediary: Intermediary;
    }[];
}
