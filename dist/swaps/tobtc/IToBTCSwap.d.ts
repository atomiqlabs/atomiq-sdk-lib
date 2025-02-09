import { IToBTCWrapper } from "./IToBTCWrapper";
import { Fee, ISwap, ISwapInit } from "../ISwap";
import * as BN from "bn.js";
import { ChainType, SwapData } from "@atomiqlabs/base";
import { PriceInfoType } from "../../prices/abstract/ISwapPrice";
import { RefundAuthorizationResponse } from "../../intermediaries/IntermediaryAPI";
import { BtcToken, SCToken, TokenAmount } from "../Tokens";
export type IToBTCSwapInit<T extends SwapData> = ISwapInit<T> & {
    networkFee: BN;
    networkFeeBtc?: BN;
};
export declare function isIToBTCSwapInit<T extends SwapData>(obj: any): obj is IToBTCSwapInit<T>;
export declare abstract class IToBTCSwap<T extends ChainType = ChainType> extends ISwap<T, ToBTCSwapState> {
    protected readonly networkFee: BN;
    protected networkFeeBtc?: BN;
    protected readonly abstract outputToken: BtcToken;
    protected constructor(wrapper: IToBTCWrapper<T, IToBTCSwap<T>>, serializedObject: any);
    protected constructor(wrapper: IToBTCWrapper<T, IToBTCSwap<T>>, init: IToBTCSwapInit<T["Data"]>);
    protected upgradeVersion(): void;
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryCalculateSwapFee(): void;
    /**
     * Returns the payment hash identifier to be sent to the LP for getStatus and getRefund
     * @protected
     */
    protected getLpIdentifier(): string;
    /**
     * Sets the payment result for the swap, optionally also checking it (checking that tx exist or swap secret is valid)
     *
     * @param result Result returned by the LP
     * @param check Whether to check the passed result
     * @returns true if check passed, false if check failed with a soft error (e.g. tx not yet found in the mempool)
     * @throws {IntermediaryError} When the data returned by the intermediary isn't valid
     */
    abstract _setPaymentResult(result: {
        secret?: string;
        txId?: string;
    }, check?: boolean): Promise<boolean>;
    refreshPriceData(): Promise<PriceInfoType>;
    getSwapPrice(): number;
    getMarketPrice(): number;
    getRealSwapFeePercentagePPM(): BN;
    getInputTxId(): string | null;
    abstract getOutputTxId(): string | null;
    getInputAddress(): string | null;
    getOutputAddress(): string | null;
    /**
     * Returns whether the swap is finished and in its terminal state (this can mean successful, refunded or failed)
     */
    isFinished(): boolean;
    isActionable(): boolean;
    isRefundable(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    isSuccessful(): boolean;
    isFailed(): boolean;
    /**
     * Checks if the swap can be committed/started
     */
    canCommit(): boolean;
    getInitiator(): string;
    /**
     * Returns the recipient address/lnurl/lightning invoice for the swap
     */
    abstract getRecipient(): string;
    getFee(): Fee<T["ChainId"], SCToken<T["ChainId"]>, BtcToken>;
    getSwapFee(): Fee<T["ChainId"], SCToken<T["ChainId"]>, BtcToken>;
    /**
     * Returns network fee for the swap, the fee is represented in source currency & destination currency, but is
     *  paid only once
     */
    getNetworkFee(): Fee<T["ChainId"], SCToken<T["ChainId"]>, BtcToken>;
    getInputWithoutFee(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getInput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    /**
     * Get the estimated smart chain transaction fee of the refund transaction
     */
    getRefundFee(): Promise<BN>;
    /**
     * Checks if the intiator/sender has enough balance to go through with the swap
     */
    hasEnoughBalance(): Promise<{
        enoughBalance: boolean;
        balance: TokenAmount;
        required: TokenAmount;
    }>;
    /**
     * Check if the initiator/sender has enough balance to cover the transaction fee for processing the swap
     */
    hasEnoughForTxFees(): Promise<{
        enoughBalance: boolean;
        balance: TokenAmount;
        required: TokenAmount;
    }>;
    /**
     * Commits the swap on-chain, initiating the swap
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled on swap creation, if you commit right after quoting, you can skipChecks)`
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    commit(signer: T["Signer"], abortSignal?: AbortSignal, skipChecks?: boolean): Promise<string>;
    /**
     * Returns transactions for committing the swap on-chain, initiating the swap
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled on swap creation, if you commit right after quoting, you can use skipChecks=true)
     *
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    txsCommit(skipChecks?: boolean): Promise<T["TX"][]>;
    /**
     * Waits till a swap is committed, should be called after sending the commit transactions manually
     *
     * @param abortSignal   AbortSignal
     * @throws {Error} If swap is not in the correct state (must be CREATED)
     */
    waitTillCommited(abortSignal?: AbortSignal): Promise<void>;
    /**
     * A blocking promise resolving when swap was concluded by the intermediary,
     *  rejecting in case of failure
     *
     * @param abortSignal           Abort signal
     * @param checkIntervalSeconds  How often to poll the intermediary for answer
     *
     * @returns {Promise<boolean>}  Was the payment successful? If not we can refund.
     * @throws {IntermediaryError} If a swap is determined expired by the intermediary, but it is actually still valid
     * @throws {SignatureVerificationError} If the swap should be cooperatively refundable but the intermediary returned
     *  invalid refund signature
     * @throws {Error} When swap expires or if the swap has invalid state (must be COMMITED)
     */
    waitForPayment(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<boolean>;
    protected waitTillIntermediarySwapProcessed(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<RefundAuthorizationResponse>;
    /**
     * Checks whether the swap was already processed by the LP and is either successful (requires proof which is
     *  either a HTLC pre-image for LN swaps or valid txId for on-chain swap) or failed and we can cooperatively
     *  refund.
     *
     * @param save whether to save the data
     * @returns true if swap is processed, false if the swap is still ongoing
     * @private
     */
    checkIntermediarySwapProcessed(save?: boolean): Promise<boolean>;
    /**
     * Refunds the swap if the swap is in refundable state, you can check so with isRefundable()
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal               Abort signal
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    refund(signer: T["Signer"], abortSignal?: AbortSignal): Promise<string>;
    /**
     * Returns transactions for refunding the swap if the swap is in refundable state, you can check so with isRefundable()
     *
     * @throws {IntermediaryError} If intermediary returns invalid response in case cooperative refund should be used
     * @throws {SignatureVerificationError} If intermediary returned invalid cooperative refund signature
     * @throws {Error} When state is not refundable
     */
    txsRefund(): Promise<T["TX"][]>;
    /**
     * Waits till a swap is refunded, should be called after sending the refund transactions manually
     *
     * @param abortSignal   AbortSignal
     * @throws {Error} When swap is not in a valid state (must be COMMITED)
     * @throws {Error} If we tried to refund but claimer was able to claim first
     */
    waitTillRefunded(abortSignal?: AbortSignal): Promise<void>;
    serialize(): any;
}
export declare enum ToBTCSwapState {
    REFUNDED = -3,
    QUOTE_EXPIRED = -2,
    QUOTE_SOFT_EXPIRED = -1,
    CREATED = 0,
    COMMITED = 1,
    SOFT_CLAIMED = 2,
    CLAIMED = 3,
    REFUNDABLE = 4
}
