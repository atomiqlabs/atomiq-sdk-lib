import { ISwap, ISwapInit } from "../ISwap";
import { ChainType, SpvWithdrawalClaimedState, SpvWithdrawalClosedState, SpvWithdrawalFrontedState } from "@atomiqlabs/base";
import { SwapType } from "../enums/SwapType";
import { SpvFromBTCWrapper } from "./SpvFromBTCWrapper";
import { Transaction } from "@scure/btc-signer";
import { BtcToken, SCToken, TokenAmount } from "../../Tokens";
import { Fee, FeeType } from "../fee/Fee";
import { IBitcoinWallet } from "../../btc/wallet/IBitcoinWallet";
import { IBTCWalletSwap } from "../IBTCWalletSwap";
export declare enum SpvFromBTCSwapState {
    CLOSED = -5,
    FAILED = -4,
    DECLINED = -3,
    QUOTE_EXPIRED = -2,
    QUOTE_SOFT_EXPIRED = -1,
    CREATED = 0,
    SIGNED = 1,
    POSTED = 2,
    BROADCASTED = 3,
    FRONTED = 4,
    BTC_TX_CONFIRMED = 5,
    CLAIMED = 6
}
export type SpvFromBTCSwapInit = ISwapInit & {
    quoteId: string;
    recipient: string;
    vaultOwner: string;
    vaultId: bigint;
    vaultRequiredConfirmations: number;
    vaultTokenMultipliers: bigint[];
    vaultBtcAddress: string;
    vaultUtxo: string;
    vaultUtxoValue: bigint;
    btcDestinationAddress: string;
    btcAmount: bigint;
    btcAmountSwap: bigint;
    btcAmountGas: bigint;
    minimumBtcFeeRate: number;
    outputTotalSwap: bigint;
    outputSwapToken: string;
    outputTotalGas: bigint;
    outputGasToken: string;
    gasSwapFeeBtc: bigint;
    gasSwapFee: bigint;
    callerFeeShare: bigint;
    frontingFeeShare: bigint;
    executionFeeShare: bigint;
};
export declare function isSpvFromBTCSwapInit(obj: any): obj is SpvFromBTCSwapInit;
export declare class SpvFromBTCSwap<T extends ChainType> extends ISwap<T, SpvFromBTCSwapState> implements IBTCWalletSwap {
    readonly TYPE = SwapType.SPV_VAULT_FROM_BTC;
    readonly wrapper: SpvFromBTCWrapper<T>;
    readonly quoteId: string;
    readonly recipient: string;
    readonly vaultOwner: string;
    readonly vaultId: bigint;
    readonly vaultRequiredConfirmations: number;
    readonly vaultTokenMultipliers: bigint[];
    readonly vaultBtcAddress: string;
    readonly vaultUtxo: string;
    readonly vaultUtxoValue: bigint;
    readonly btcDestinationAddress: string;
    readonly btcAmount: bigint;
    readonly btcAmountSwap: bigint;
    readonly btcAmountGas: bigint;
    readonly minimumBtcFeeRate: number;
    readonly outputTotalSwap: bigint;
    readonly outputSwapToken: string;
    readonly outputTotalGas: bigint;
    readonly outputGasToken: string;
    readonly gasSwapFeeBtc: bigint;
    readonly gasSwapFee: bigint;
    readonly callerFeeShare: bigint;
    readonly frontingFeeShare: bigint;
    readonly executionFeeShare: bigint;
    claimTxId: string;
    frontTxId: string;
    data: T["SpvVaultWithdrawalData"];
    constructor(wrapper: SpvFromBTCWrapper<T>, init: SpvFromBTCSwapInit);
    constructor(wrapper: SpvFromBTCWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryCalculateSwapFee(): void;
    refreshPriceData(): Promise<void>;
    _getInitiator(): string;
    _getEscrowHash(): string;
    getId(): string;
    getQuoteExpiry(): number;
    verifyQuoteValid(): Promise<boolean>;
    getOutputAddress(): string | null;
    getOutputTxId(): string | null;
    getInputTxId(): string | null;
    requiresAction(): boolean;
    isFinished(): boolean;
    isClaimable(): boolean;
    isSuccessful(): boolean;
    isFailed(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    protected getInputSwapAmountWithoutFee(): bigint;
    protected getInputGasAmountWithoutFee(): bigint;
    protected getInputAmountWithoutFee(): bigint;
    protected getOutputWithoutFee(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    protected getSwapFee(): Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
    protected getWatchtowerFee(): Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
    getFee(): Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
    getFeeBreakdown(): [
        {
            type: FeeType.SWAP;
            fee: Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
        },
        {
            type: FeeType.NETWORK_OUTPUT;
            fee: Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
        }
    ];
    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getGasDropOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken<false>>;
    getInput(): TokenAmount<T["ChainId"], BtcToken<false>>;
    getTransactionDetails(): Promise<{
        in0txid: string;
        in0vout: number;
        in0sequence: number;
        vaultAmount: bigint;
        vaultScript: Uint8Array;
        in1sequence: number;
        out1script: Uint8Array;
        out2amount: bigint;
        out2script: Uint8Array;
        locktime: number;
    }>;
    getPsbt(): Promise<{
        psbt: Transaction;
        in1sequence: number;
    }>;
    getFundedPsbt(wallet: IBitcoinWallet, feeRate?: number): Promise<{
        psbt: Transaction;
        signInputs: number[];
    }>;
    submitPsbt(psbt: Transaction): Promise<string>;
    estimateBitcoinFee(wallet: IBitcoinWallet, feeRate?: number): Promise<number>;
    sendBitcoinTransaction(wallet: IBitcoinWallet, feeRate?: number): Promise<string>;
    /**
     * Checks whether a bitcoin payment was already made, returns the payment or null when no payment has been made.
     */
    protected getBitcoinPayment(): Promise<{
        txId: string;
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
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected watchdogWaitTillResult(abortSignal?: AbortSignal, interval?: number): Promise<SpvWithdrawalClaimedState | SpvWithdrawalFrontedState | SpvWithdrawalClosedState>;
    /**
     * Waits till the swap is successfully executed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be BTC_TX_CONFIRMED)
     * @throws {Error} If the LP refunded sooner than we were able to claim
     */
    waitTillClaimedOrFronted(abortSignal?: AbortSignal): Promise<void>;
    /**
     * Waits till the bitcoin transaction confirms and swap is claimed
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    waitTillExecuted(abortSignal?: AbortSignal, checkIntervalSeconds?: number, updateCallback?: (txId: string, confirmations: number, targetConfirmations: number, txEtaMs: number) => void): Promise<void>;
    serialize(): any;
    private syncStateFromBitcoin;
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
