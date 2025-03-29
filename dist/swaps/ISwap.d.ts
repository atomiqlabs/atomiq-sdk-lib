/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { SwapType } from "./SwapType";
import { EventEmitter } from "events";
import { Buffer } from "buffer";
import { ISwapWrapper } from "./ISwapWrapper";
import { ChainType, SignatureData, SwapCommitStatus, SwapData } from "@atomiqlabs/base";
import { PriceInfoType } from "../prices/abstract/ISwapPrice";
import { LoggerType } from "../utils/Utils";
import { SCToken, Token, TokenAmount } from "./Tokens";
import { SwapDirection } from "./SwapDirection";
export type ISwapInit<T extends SwapData> = {
    pricingInfo: PriceInfoType;
    url: string;
    expiry: number;
    swapFee: bigint;
    swapFeeBtc?: bigint;
    feeRate: any;
    signatureData?: SignatureData;
    data?: T;
    exactIn: boolean;
};
export declare function isISwapInit<T extends SwapData>(obj: any): obj is ISwapInit<T>;
export type Fee<ChainIdentifier extends string = string, TSrc extends Token<ChainIdentifier> = Token<ChainIdentifier>, TDst extends Token<ChainIdentifier> = Token<ChainIdentifier>> = {
    amountInSrcToken: TokenAmount<ChainIdentifier, TSrc>;
    amountInDstToken: TokenAmount<ChainIdentifier, TDst>;
    usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>;
};
export declare abstract class ISwap<T extends ChainType = ChainType, S extends number = number> {
    readonly chainIdentifier: string;
    readonly exactIn: boolean;
    readonly createdAt: number;
    protected readonly currentVersion: number;
    protected version: number;
    protected initiated: boolean;
    protected logger: LoggerType;
    protected readonly abstract TYPE: SwapType;
    protected readonly wrapper: ISwapWrapper<T, ISwap<T, S>>;
    expiry?: number;
    readonly url: string;
    state: S;
    pricingInfo: PriceInfoType;
    data: T["Data"];
    signatureData?: SignatureData;
    feeRate?: any;
    protected swapFee: bigint;
    protected swapFeeBtc?: bigint;
    /**
     * Transaction IDs for the swap on the smart chain side
     */
    commitTxId: string;
    refundTxId?: string;
    claimTxId?: string;
    /**
     * Random nonce to differentiate the swap from others with the same identifier hash (i.e. when quoting the same swap
     *  from multiple LPs)
     */
    randomNonce: string;
    /**
     * Event emitter emitting "swapState" event when swap's state changes
     */
    events: EventEmitter;
    protected constructor(wrapper: ISwapWrapper<T, ISwap<T, S>>, obj: any);
    protected constructor(wrapper: ISwapWrapper<T, ISwap<T, S>>, swapInit: ISwapInit<T["Data"]>);
    protected abstract upgradeVersion(): void;
    /**
     * Periodically checks for init signature's expiry
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected watchdogWaitTillSignatureExpiry(abortSignal?: AbortSignal, interval?: number): Promise<void>;
    /**
     * Periodically checks the chain to see whether the swap is committed
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected watchdogWaitTillCommited(abortSignal?: AbortSignal, interval?: number): Promise<boolean>;
    /**
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected watchdogWaitTillResult(abortSignal?: AbortSignal, interval?: number): Promise<SwapCommitStatus.PAID | SwapCommitStatus.EXPIRED | SwapCommitStatus.NOT_COMMITED>;
    /**
     * Waits till the swap reaches a specific state
     *
     * @param targetState The state to wait for
     * @param type Whether to wait for the state exactly or also to a state with a higher number
     * @param abortSignal
     * @protected
     */
    protected waitTillState(targetState: S, type?: "eq" | "gte" | "neq", abortSignal?: AbortSignal): Promise<void>;
    /**
     * Checks if the pricing for the swap is valid, according to max allowed price difference set in the ISwapPrice
     */
    hasValidPrice(): boolean;
    /**
     * Returns the price difference between offered price and current market price in PPM (parts per million)
     */
    getPriceDifferencePPM(): bigint;
    /**
     * Returns the price difference between offered price and current market price as a decimal number
     */
    getPriceDifferencePct(): number;
    /**
     * Re-fetches & revalidates the price data
     */
    abstract refreshPriceData(): Promise<PriceInfoType>;
    /**
     * Returns the offered swap quote price
     */
    abstract getSwapPrice(): number;
    /**
     * Returns the real current market price fetched from reputable exchanges
     */
    abstract getMarketPrice(): number;
    /**
     * Returns the real swap fee percentage as PPM (parts per million)
     */
    abstract getRealSwapFeePercentagePPM(): bigint;
    abstract getInputTxId(): string | null;
    abstract getOutputTxId(): string | null;
    abstract getInputAddress(): string | null;
    abstract getOutputAddress(): string | null;
    /**
     * Returns the escrow hash - i.e. hash of the escrow data
     */
    getEscrowHash(): string | null;
    /**
     * Returns the claim data hash - i.e. hash passed to the claim handler
     */
    getClaimHash(): string;
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHash(): Buffer;
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHashString(): string;
    /**
     * Returns the ID of the swap, as used in the storage and getSwapById function
     */
    getId(): string;
    /**
     * Returns quote expiry in UNIX millis
     */
    getExpiry(): number;
    /**
     * Returns the type of the swap
     */
    getType(): SwapType;
    /**
     * Returns the direction of the swap
     */
    getDirection(): SwapDirection;
    /**
     * Returns the current state of the swap
     */
    getState(): S;
    /**
     * Returns whether the swap is finished and in its terminal state (this can mean successful, refunded or failed)
     */
    abstract isFinished(): boolean;
    /**
     * Checks whether the swap's quote has definitely expired and cannot be committed anymore, we can remove such swap
     */
    abstract isQuoteExpired(): boolean;
    /**
     * Checks whether the swap's quote is soft expired (this means there is not enough time buffer for it to commit,
     *  but it still can happen)
     */
    abstract isQuoteSoftExpired(): boolean;
    /**
     * Returns whether the swap finished successful
     */
    abstract isSuccessful(): boolean;
    /**
     * Returns whether the swap failed (e.g. was refunded)
     */
    abstract isFailed(): boolean;
    /**
     * Returns the intiator address of the swap - address that created this swap
     */
    abstract getInitiator(): string;
    /**
     * @param signer Signer to check with this swap's initiator
     * @throws {Error} When signer's address doesn't match with the swap's initiator one
     */
    checkSigner(signer: T["Signer"] | string): void;
    /**
     * Checks if the swap's quote is still valid
     */
    isQuoteValid(): Promise<boolean>;
    isInitiated(): boolean;
    /**
     * Checks whether there is some action required from the user for this swap - can mean either refundable or claimable
     */
    abstract isActionable(): boolean;
    /**
     * Get the estimated smart chain fee of the commit transaction
     */
    getCommitFee(): Promise<bigint>;
    /**
     * Returns output amount of the swap, user receives this much
     */
    abstract getOutput(): TokenAmount;
    /**
     * Returns input amount of the swap, user needs to pay this much
     */
    abstract getInput(): TokenAmount;
    /**
     * Returns input amount if the swap without the fees (swap fee, network fee)
     */
    abstract getInputWithoutFee(): TokenAmount;
    /**
     * Returns total fee for the swap, the fee is represented in source currency & destination currency, but is
     *  paid only once
     */
    getFee(): Fee;
    /**
     * Returns swap fee for the swap, the fee is represented in source currency & destination currency, but is
     *  paid only once
     */
    abstract getSwapFee(): Fee;
    /**
     * Returns the transaction fee paid on the smart chain
     */
    getSmartChainNetworkFee(): Promise<TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>>;
    /**
     * Checks if the initiator/sender has enough balance to cover the transaction fee for processing the swap
     */
    abstract hasEnoughForTxFees(): Promise<{
        enoughBalance: boolean;
        balance: TokenAmount;
        required: TokenAmount;
    }>;
    serialize(): any;
    _save(): Promise<void>;
    _saveAndEmit(state?: S): Promise<void>;
    _emitEvent(): void;
    /**
     * Synchronizes swap state from chain and/or LP node, usually ran on startup
     *
     * @param save whether to save the new swap state or not
     *
     * @returns {boolean} true if the swap changed, false if the swap hasn't changed
     */
    abstract _sync(save?: boolean): Promise<boolean>;
    /**
     * Runs quick checks on the swap, such as checking the expiry, usually ran periodically every few seconds
     *
     * @param save whether to save the new swap state or not
     *
     * @returns {boolean} true if the swap changed, false if the swap hasn't changed
     */
    abstract _tick(save?: boolean): Promise<boolean>;
}
