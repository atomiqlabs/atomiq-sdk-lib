/// <reference types="node" />
/// <reference types="node" />
import { FromBTCLNWrapper } from "./FromBTCLNWrapper";
import { IFromBTCSwap } from "../IFromBTCSwap";
import { SwapType } from "../../SwapType";
import { ChainType, SignatureData, SwapData } from "@atomiqlabs/base";
import { ISwapInit } from "../../ISwap";
import { Buffer } from "buffer";
import { LNURLWithdraw } from "../../../utils/LNURL";
import { BtcToken, SCToken, TokenAmount } from "../../Tokens";
export declare enum FromBTCLNSwapState {
    FAILED = -4,
    QUOTE_EXPIRED = -3,
    QUOTE_SOFT_EXPIRED = -2,
    EXPIRED = -1,
    PR_CREATED = 0,
    PR_PAID = 1,
    CLAIM_COMMITED = 2,
    CLAIM_CLAIMED = 3
}
export type FromBTCLNSwapInit<T extends SwapData> = ISwapInit<T> & {
    pr: string;
    secret: string;
    initialSwapData: T;
    lnurl?: string;
    lnurlK1?: string;
    lnurlCallback?: string;
};
export declare function isFromBTCLNSwapInit<T extends SwapData>(obj: any): obj is FromBTCLNSwapInit<T>;
export declare class FromBTCLNSwap<T extends ChainType = ChainType> extends IFromBTCSwap<T, FromBTCLNSwapState> {
    protected readonly inputToken: BtcToken<true>;
    protected readonly TYPE = SwapType.FROM_BTCLN;
    protected readonly lnurlFailSignal: AbortController;
    protected readonly pr: string;
    protected readonly secret: string;
    protected initialSwapData: T["Data"];
    lnurl?: string;
    lnurlK1?: string;
    lnurlCallback?: string;
    prPosted?: boolean;
    wrapper: FromBTCLNWrapper<T>;
    protected getSwapData(): T["Data"];
    constructor(wrapper: FromBTCLNWrapper<T>, init: FromBTCLNSwapInit<T["Data"]>);
    constructor(wrapper: FromBTCLNWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    getInputTxId(): string | null;
    getIdentifierHash(): Buffer;
    getPaymentHash(): Buffer;
    getAddress(): string;
    /**
     * Returns the lightning network BOLT11 invoice that needs to be paid as an input to the swap
     */
    getLightningInvoice(): string;
    getQrData(): string;
    /**
     * Returns timeout time (in UNIX milliseconds) when the LN invoice will expire
     */
    getTimeoutTime(): number;
    /**
     * Returns timeout time (in UNIX milliseconds) when the on-chain address will expire and no funds should be sent
     *  to that address anymore
     */
    getHtlcTimeoutTime(): number;
    isFinished(): boolean;
    isClaimable(): boolean;
    isSuccessful(): boolean;
    isFailed(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    isQuoteValid(): Promise<boolean>;
    canCommit(): boolean;
    canClaim(): boolean;
    getInput(): TokenAmount<T["ChainId"], BtcToken<true>>;
    /**
     * Estimated transaction fee for commit & claim txs combined
     */
    getCommitAndClaimFee(): Promise<bigint>;
    getSmartChainNetworkFee(): Promise<TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>>;
    hasEnoughForTxFees(): Promise<{
        enoughBalance: boolean;
        balance: TokenAmount;
        required: TokenAmount;
    }>;
    /**
     * Waits till an LN payment is received by the intermediary and client can continue commiting & claiming the HTLC
     *
     * @param abortSignal Abort signal to stop waiting for payment
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     */
    waitForPayment(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<void>;
    /**
     * Checks whether the LP received the LN payment and we can continue by committing & claiming the HTLC on-chain
     *
     * @param save If the new swap state should be saved
     */
    checkIntermediaryPaymentReceived(save?: boolean): Promise<boolean | null>;
    /**
     * Checks the data returned by the intermediary in the payment auth request
     *
     * @param signer Smart chain signer's address initiating the swap
     * @param data Parsed swap data as returned by the intermediary
     * @param signature Signature data as returned by the intermediary
     * @protected
     * @throws {IntermediaryError} If the returned are not valid
     * @throws {SignatureVerificationError} If the returned signature is not valid
     * @throws {Error} If the swap is already committed on-chain
     */
    protected checkIntermediaryReturnedAuthData(signer: string, data: T["Data"], signature: SignatureData): Promise<void>;
    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in an HTLC
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    commit(signer: T["Signer"], abortSignal?: AbortSignal, skipChecks?: boolean): Promise<string>;
    waitTillCommited(abortSignal?: AbortSignal): Promise<void>;
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
    canCommitAndClaimInOneShot(): boolean;
    /**
     * Commits and claims the swap, in a way that the transactions can be signed together by the underlying provider and
     *  then sent sequentially
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If in invalid state (must be PR_PAID or CLAIM_COMMITED)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    commitAndClaim(signer: T["Signer"], abortSignal?: AbortSignal, skipChecks?: boolean): Promise<string[]>;
    /**==
     * Returns transactions for both commit & claim operation together, such that they can be signed all at once by
     *  the wallet. CAUTION: transactions must be sent sequentially, such that the claim (2nd) transaction is only
     *  sent after the commit (1st) transaction confirms. Failure to do so can reveal the HTLC pre-image too soon,
     *  opening a possibility for the LP to steal funds.
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     *
     * @throws {Error} If in invalid state (must be PR_PAID or CLAIM_COMMITED)
     */
    txsCommitAndClaim(skipChecks?: boolean): Promise<T["TX"][]>;
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
