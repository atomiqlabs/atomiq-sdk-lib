/// <reference types="node" />
import { AmountData, ISwapWrapper, ISwapWrapperOptions, WrapperCtorTokens } from "../ISwapWrapper";
import { BtcRelay, ChainEvent, ChainType, RelaySynchronizer, SpvVaultClaimEvent, SpvVaultCloseEvent, SpvVaultFrontEvent } from "@atomiqlabs/base";
import { SpvFromBTCSwap } from "./SpvFromBTCSwap";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
import { SwapType } from "../enums/SwapType";
import { BitcoinRpcWithTxoListener } from "../../btc/BitcoinRpcWithTxoListener";
import { UnifiedSwapStorage } from "../../storage/UnifiedSwapStorage";
import { UnifiedSwapEventListener } from "../../events/UnifiedSwapEventListener";
import { ISwapPrice } from "../../prices/abstract/ISwapPrice";
import { EventEmitter } from "events";
import { Intermediary } from "../../intermediaries/Intermediary";
export type SpvFromBTCOptions = {
    gasAmount?: bigint;
    unsafeZeroWatchtowerFee?: boolean;
    feeSafetyFactor?: number;
};
export type SpvFromBTCWrapperOptions = ISwapWrapperOptions & {
    maxConfirmations?: number;
    bitcoinNetwork?: BTC_NETWORK;
    bitcoinBlocktime?: number;
    maxTransactionsDelta?: number;
    maxRawAmountAdjustmentDifferencePPM?: number;
};
export declare class SpvFromBTCWrapper<T extends ChainType> extends ISwapWrapper<T, SpvFromBTCSwap<T>, SpvFromBTCWrapperOptions> {
    readonly TYPE = SwapType.SPV_VAULT_FROM_BTC;
    readonly swapDeserializer: typeof SpvFromBTCSwap;
    readonly synchronizer: RelaySynchronizer<any, T["TX"], any>;
    readonly contract: T["SpvVaultContract"];
    readonly btcRelay: T["BtcRelay"];
    readonly btcRpc: BitcoinRpcWithTxoListener<any>;
    readonly spvWithdrawalDataDeserializer: new (data: any) => T["SpvVaultWithdrawalData"];
    /**
     * @param chainIdentifier
     * @param unifiedStorage Storage interface for the current environment
     * @param unifiedChainEvents On-chain event listener
     * @param chain
     * @param contract Underlying contract handling the swaps
     * @param prices Pricing to use
     * @param tokens
     * @param spvWithdrawalDataDeserializer Deserializer for SpvVaultWithdrawalData
     * @param btcRelay
     * @param synchronizer Btc relay synchronizer
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier: string, unifiedStorage: UnifiedSwapStorage<T>, unifiedChainEvents: UnifiedSwapEventListener<T>, chain: T["ChainInterface"], contract: T["SpvVaultContract"], prices: ISwapPrice, tokens: WrapperCtorTokens, spvWithdrawalDataDeserializer: new (data: any) => T["SpvVaultWithdrawalData"], btcRelay: BtcRelay<any, T["TX"], any>, synchronizer: RelaySynchronizer<any, T["TX"], any>, btcRpc: BitcoinRpcWithTxoListener<any>, options?: SpvFromBTCWrapperOptions, events?: EventEmitter);
    readonly pendingSwapStates: Array<SpvFromBTCSwap<T>["state"]>;
    readonly tickSwapState: Array<SpvFromBTCSwap<T>["state"]>;
    protected processEventFront(event: SpvVaultFrontEvent, swap: SpvFromBTCSwap<T>): boolean;
    protected processEventClaim(event: SpvVaultClaimEvent, swap: SpvFromBTCSwap<T>): boolean;
    protected processEventClose(event: SpvVaultCloseEvent, swap: SpvFromBTCSwap<T>): boolean;
    protected processEvent(event: ChainEvent<T["Data"]>, swap: SpvFromBTCSwap<T>): Promise<boolean>;
    /**
     * Pre-fetches caller (watchtower) bounty data for the swap. Doesn't throw, instead returns null and aborts the
     *  provided abortController
     *
     * @param signer Smartchain signer address initiating the swap
     * @param amountData
     * @param options Options as passed to the swap creation function
     * @param pricePrefetch
     * @param nativeTokenPricePrefetch
     * @param abortController
     * @private
     */
    private preFetchCallerFeeShare;
    /**
     * Verifies response returned from intermediary
     *
     * @param resp Response as returned by the intermediary
     * @param amountData
     * @param lp Intermediary
     * @param options Options as passed to the swap creation function
     * @param callerFeeShare
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
    create(signer: string, amountData: AmountData, lps: Intermediary[], options?: SpvFromBTCOptions, additionalParams?: Record<string, any>, abortSignal?: AbortSignal): {
        quote: Promise<SpvFromBTCSwap<T>>;
        intermediary: Intermediary;
    }[];
}
