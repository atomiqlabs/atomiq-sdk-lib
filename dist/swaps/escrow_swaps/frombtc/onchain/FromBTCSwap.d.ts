import { IFromBTCSwap } from "../IFromBTCSwap";
import { SwapType } from "../../../enums/SwapType";
import { FromBTCWrapper } from "./FromBTCWrapper";
import { ChainType, SwapData } from "@atomiqlabs/base";
import { BtcToken, SCToken, TokenAmount } from "../../../../Tokens";
import { IEscrowSwapInit } from "../../IEscrowSwap";
import { IBitcoinWallet } from "../../../../btc/wallet/IBitcoinWallet";
import { IBTCWalletSwap } from "../../../IBTCWalletSwap";
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
export type FromBTCSwapInit<T extends SwapData> = IEscrowSwapInit<T> & {
    address: string;
    amount: bigint;
    requiredConfirmations: number;
};
export declare function isFromBTCSwapInit<T extends SwapData>(obj: any): obj is FromBTCSwapInit<T>;
export declare class FromBTCSwap<T extends ChainType = ChainType> extends IFromBTCSwap<T, FromBTCSwapState> implements IBTCWalletSwap {
    protected readonly inputToken: BtcToken<false>;
    protected readonly TYPE = SwapType.FROM_BTC;
    readonly wrapper: FromBTCWrapper<T>;
    readonly address: string;
    readonly amount: bigint;
    readonly requiredConfirmations: number;
    txId?: string;
    vout?: number;
    constructor(wrapper: FromBTCWrapper<T>, init: FromBTCSwapInit<T["Data"]>);
    constructor(wrapper: FromBTCWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    /**
     * Returns bitcoin address where the on-chain BTC should be sent to
     */
    getAddress(): string;
    getHyperlink(): string;
    getInputTxId(): string | null;
    /**
     * Returns timeout time (in UNIX milliseconds) when the on-chain address will expire and no funds should be sent
     *  to that address anymore
     */
    getTimeoutTime(): number;
    requiresAction(): boolean;
    isFinished(): boolean;
    isClaimable(): boolean;
    isSuccessful(): boolean;
    isFailed(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    protected canCommit(): boolean;
    getInput(): TokenAmount<T["ChainId"], BtcToken<false>>;
    /**
     * Returns claimer bounty, acting as a reward for watchtowers to claim the swap automatically
     */
    getClaimerBounty(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    /**
     * Checks whether a bitcoin payment was already made, returns the payment or null when no payment has been made.
     */
    protected getBitcoinPayment(): Promise<{
        txId: string;
        vout: number;
        confirmations: number;
        targetConfirmations: number;
    } | null>;
    /**
     * Waits till the bitcoin transaction confirms and swap becomes claimable
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    waitForBitcoinTransaction(abortSignal?: AbortSignal, checkIntervalSeconds?: number, updateCallback?: (txId: string, confirmations: number, targetConfirmations: number, txEtaMs: number) => void): Promise<string>;
    estimateBitcoinFee(wallet: IBitcoinWallet, feeRate?: number): Promise<number>;
    sendBitcoinTransaction(wallet: IBitcoinWallet, feeRate?: number): Promise<string>;
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
