/// <reference types="node" />
/// <reference types="node" />
import { IFromBTCSwap } from "../IFromBTCSwap";
import { SwapType } from "../../SwapType";
import { FromBTCWrapper } from "./FromBTCWrapper";
import * as BN from "bn.js";
import { ChainType, SwapData } from "@atomiqlabs/base";
import { ISwapInit } from "../../ISwap";
import { Buffer } from "buffer";
import { BtcToken, SCToken, TokenAmount } from "../../Tokens";
export declare enum FromBTCSwapState {
    FAILED = -4,
    EXPIRED = -3,
    QUOTE_EXPIRED = -2,
    QUOTE_SOFT_EXPIRED = -1,
    PR_CREATED = 0,
    CLAIM_COMMITED = 1,
    BTC_TX_CONFIRMED = 2,
    CLAIM_CLAIMED = 3
}
export type FromBTCSwapInit<T extends SwapData> = ISwapInit<T> & {
    address: string;
    amount: BN;
};
export declare function isFromBTCSwapInit<T extends SwapData>(obj: any): obj is FromBTCSwapInit<T>;
export declare class FromBTCSwap<T extends ChainType = ChainType> extends IFromBTCSwap<T, FromBTCSwapState> {
    protected readonly inputToken: BtcToken<false>;
    protected readonly TYPE = SwapType.FROM_BTC;
    readonly wrapper: FromBTCWrapper<T>;
    readonly address: string;
    readonly amount: BN;
    txId?: string;
    vout?: number;
    constructor(wrapper: FromBTCWrapper<T>, init: FromBTCSwapInit<T["Data"]>);
    constructor(wrapper: FromBTCWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    getTxoHash(): Buffer;
    getAddress(): string;
    /**
     * Returns bitcoin address where the on-chain BTC should be sent to
     */
    getBitcoinAddress(): string;
    getQrData(): string;
    /**
     * Returns timeout time (in UNIX milliseconds) when the on-chain address will expire and no funds should be sent
     *  to that address anymore
     */
    getTimeoutTime(): number;
    isFinished(): boolean;
    isClaimable(): boolean;
    isActionable(): boolean;
    isSuccessful(): boolean;
    isFailed(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    canCommit(): boolean;
    canClaim(): boolean;
    getInput(): TokenAmount<T["ChainId"], BtcToken<false>>;
    /**
     * Returns claimer bounty, acting as a reward for watchtowers to claim the swap automatically
     */
    getClaimerBounty(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    /**
     * Waits till the bitcoin transaction confirms and swap becomes claimable
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    waitForBitcoinTransaction(abortSignal?: AbortSignal, checkIntervalSeconds?: number, updateCallback?: (txId: string, confirmations: number, targetConfirmations: number, txEtaMs: number) => void): Promise<void>;
    /**
     * Checks whether a bitcoin payment was already made, returns the payment or null when no payment has been made.
     */
    getBitcoinPayment(): Promise<{
        txId: string;
        vout: number;
        confirmations: number;
        targetConfirmations: number;
    } | null>;
    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in a PTLC
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
     * Returns transactions required to claim the swap on-chain (and possibly also sync the bitcoin light client)
     *  after a bitcoin transaction was sent and confirmed
     *
     * @throws {Error} If the swap is in invalid state (must be BTC_TX_CONFIRMED)
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
    serialize(): any;
}
