/// <reference types="node" />
/// <reference types="node" />
import { SwapType } from "../../../enums/SwapType";
import { ChainType, SwapData, SwapExpiredState, SwapNotCommitedState, SwapPaidState } from "@atomiqlabs/base";
import { Buffer } from "buffer";
import { LNURLWithdraw } from "../../../../utils/LNURL";
import { BtcToken, SCToken, TokenAmount } from "../../../../Tokens";
import { ISwap, ISwapInit } from "../../../ISwap";
import { Fee, FeeType } from "../../../fee/Fee";
import { IAddressSwap } from "../../../IAddressSwap";
import { FromBTCLNAutoWrapper } from "./FromBTCLNAutoWrapper";
export declare enum FromBTCLNAutoSwapState {
    FAILED = -3,
    QUOTE_EXPIRED = -2,
    EXPIRED = -1,
    PR_CREATED = 0,
    PR_PAID = 1,
    CLAIM_COMMITED = 2,
    CLAIM_CLAIMED = 3
}
export type FromBTCLNAutoSwapInit<T extends SwapData> = ISwapInit & {
    pr: string;
    secret: string;
    initialSwapData: T;
    btcAmountSwap: bigint;
    btcAmountGas: bigint;
    gasSwapFeeBtc: bigint;
    gasSwapFee: bigint;
    lnurl?: string;
    lnurlK1?: string;
    lnurlCallback?: string;
};
export declare function isFromBTCLNAutoSwapInit<T extends SwapData>(obj: any): obj is FromBTCLNAutoSwapInit<T>;
export declare class FromBTCLNAutoSwap<T extends ChainType = ChainType> extends ISwap<T, FromBTCLNAutoSwapState> implements IAddressSwap {
    protected readonly inputToken: BtcToken<true>;
    protected readonly TYPE = SwapType.FROM_BTCLN_AUTO;
    protected readonly lnurlFailSignal: AbortController;
    protected readonly pr: string;
    protected readonly secret: string;
    protected initialSwapData: T["Data"];
    protected readonly btcAmountSwap: bigint;
    protected readonly btcAmountGas: bigint;
    protected readonly gasSwapFeeBtc: bigint;
    protected readonly gasSwapFee: bigint;
    data: T["Data"];
    commitTxId: string;
    claimTxId?: string;
    lnurl?: string;
    lnurlK1?: string;
    lnurlCallback?: string;
    prPosted?: boolean;
    wrapper: FromBTCLNAutoWrapper<T>;
    protected getSwapData(): T["Data"];
    constructor(wrapper: FromBTCLNAutoWrapper<T>, init: FromBTCLNAutoSwapInit<T["Data"]>);
    constructor(wrapper: FromBTCLNAutoWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryRecomputeSwapPrice(): void;
    refreshPriceData(): Promise<void>;
    _getEscrowHash(): string | null;
    _getInitiator(): string;
    getId(): string;
    getOutputAddress(): string | null;
    getOutputTxId(): string | null;
    requiresAction(): boolean;
    protected getIdentifierHashString(): string;
    protected getPaymentHash(): Buffer;
    getInputTxId(): string | null;
    /**
     * Returns the lightning network BOLT11 invoice that needs to be paid as an input to the swap
     */
    getAddress(): string;
    getHyperlink(): string;
    /**
     * Returns timeout time (in UNIX milliseconds) when the LN invoice will expire
     */
    getTimeoutTime(): number;
    /**
     * Returns timeout time (in UNIX milliseconds) when the swap htlc will expire
     */
    getHtlcTimeoutTime(): number;
    isFinished(): boolean;
    isClaimable(): boolean;
    isSuccessful(): boolean;
    isFailed(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    verifyQuoteValid(): Promise<boolean>;
    protected getLightningInvoiceSats(): bigint;
    protected getWatchtowerFeeAmountBtc(): bigint;
    protected getInputSwapAmountWithoutFee(): bigint;
    protected getInputGasAmountWithoutFee(): bigint;
    protected getInputAmountWithoutFee(): bigint;
    protected getOutputAmountWithoutFee(): bigint;
    getInput(): TokenAmount<T["ChainId"], BtcToken<true>>;
    getInputWithoutFee(): TokenAmount;
    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getGasDropOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    protected getSwapFee(): Fee<T["ChainId"], BtcToken<true>, SCToken<T["ChainId"]>>;
    protected getWatchtowerFee(): Fee<T["ChainId"], BtcToken<true>, SCToken<T["ChainId"]>>;
    getFee(): Fee<T["ChainId"], BtcToken<true>, SCToken<T["ChainId"]>>;
    getFeeBreakdown(): [
        {
            type: FeeType.SWAP;
            fee: Fee<T["ChainId"], BtcToken<true>, SCToken<T["ChainId"]>>;
        },
        {
            type: FeeType.NETWORK_OUTPUT;
            fee: Fee<T["ChainId"], BtcToken<true>, SCToken<T["ChainId"]>>;
        }
    ];
    /**
     * Checks whether the LP received the LN payment and we can continue by committing & claiming the HTLC on-chain
     *
     * @param save If the new swap state should be saved
     */
    protected checkIntermediaryPaymentReceived(save?: boolean): Promise<boolean | null>;
    /**
     * Checks the data returned by the intermediary in the payment auth request
     *
     * @param signer Smart chain signer's address initiating the swap
     * @param data Parsed swap data as returned by the intermediary
     * @protected
     * @throws {IntermediaryError} If the returned are not valid
     * @throws {SignatureVerificationError} If the returned signature is not valid
     * @throws {Error} If the swap is already committed on-chain
     */
    protected checkIntermediaryReturnedData(signer: string, data: T["Data"]): Promise<void>;
    /**
     * Waits till an LN payment is received by the intermediary and client can continue commiting & claiming the HTLC
     *
     * @param abortSignal Abort signal to stop waiting for payment
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     */
    waitForPayment(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<boolean>;
    /**
     * Periodically checks the chain to see whether the swap is committed
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected watchdogWaitTillCommited(abortSignal?: AbortSignal, interval?: number): Promise<boolean>;
    protected waitTillCommited(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<void>;
    /**
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected watchdogWaitTillResult(abortSignal?: AbortSignal, interval?: number): Promise<SwapPaidState | SwapExpiredState | SwapNotCommitedState>;
    /**
     * Returns transactions required for claiming the HTLC and finishing the swap by revealing the HTLC secret
     *  (hash preimage)
     *
     * @param signer Optional signer address to use for claiming the swap, can also be different from the initializer
     * @throws {Error} If in invalid state (must be CLAIM_COMMITED)
     */
    txsClaim(signer?: T["Signer"]): Promise<T["TX"][]>;
    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    claim(signer: T["Signer"], abortSignal?: AbortSignal): Promise<string>;
    /**
     * Waits till the swap is successfully claimed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be BTC_TX_CONFIRMED)
     * @throws {Error} If the LP refunded sooner than we were able to claim
     */
    waitTillClaimed(abortSignal?: AbortSignal): Promise<void>;
    /**
     * Is this an LNURL-withdraw swap?
     */
    isLNURL(): boolean;
    /**
     * Gets the used LNURL or null if this is not an LNURL-withdraw swap
     */
    getLNURL(): string | null;
    /**
     * Pay the generated lightning network invoice with LNURL-withdraw
     */
    settleWithLNURLWithdraw(lnurl: string | LNURLWithdraw): Promise<void>;
    serialize(): any;
    /**
     * Checks the swap's state on-chain and compares it to its internal state, updates/changes it according to on-chain
     *  data
     *
     * @private
     */
    private syncStateFromChain;
    _sync(save?: boolean): Promise<boolean>;
    _tick(save?: boolean): Promise<boolean>;
}
