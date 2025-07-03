/// <reference types="node" />
/// <reference types="node" />
import { ISwap, ISwapInit } from "../ISwap";
import { ChainType, SignatureData, SwapData, SwapExpiredState, SwapNotCommitedState, SwapPaidState } from "@atomiqlabs/base";
import { IEscrowSwapWrapper } from "./IEscrowSwapWrapper";
import { Buffer } from "buffer";
import { SCToken, TokenAmount } from "../../Tokens";
export type IEscrowSwapInit<T extends SwapData> = ISwapInit & {
    feeRate: any;
    signatureData?: SignatureData;
    data?: T;
};
export declare function isIEscrowSwapInit<T extends SwapData>(obj: any): obj is IEscrowSwapInit<T>;
export declare abstract class IEscrowSwap<T extends ChainType = ChainType, S extends number = number> extends ISwap<T, S> {
    protected readonly wrapper: IEscrowSwapWrapper<T, IEscrowSwap<T, S>>;
    data: T["Data"];
    signatureData?: SignatureData;
    feeRate?: any;
    /**
     * Transaction IDs for the swap on the smart chain side
     */
    commitTxId: string;
    refundTxId?: string;
    claimTxId?: string;
    protected constructor(wrapper: IEscrowSwapWrapper<T, IEscrowSwap<T, S>>, obj: any);
    protected constructor(wrapper: IEscrowSwapWrapper<T, IEscrowSwap<T, S>>, swapInit: IEscrowSwapInit<T["Data"]>);
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    protected getIdentifierHash(): Buffer;
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    protected getIdentifierHashString(): string;
    _getEscrowHash(): string | null;
    /**
     * Returns the escrow hash - i.e. hash of the escrow data
     */
    getEscrowHash(): string | null;
    /**
     * Returns the claim data hash - i.e. hash passed to the claim handler
     */
    getClaimHash(): string;
    getId(): string;
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
    protected watchdogWaitTillResult(abortSignal?: AbortSignal, interval?: number): Promise<SwapPaidState | SwapExpiredState | SwapNotCommitedState>;
    /**
     * Checks if the swap's quote is expired for good (i.e. the swap strictly cannot be committed on-chain anymore)
     */
    protected verifyQuoteDefinitelyExpired(): Promise<boolean>;
    /**
     * Checks if the swap's quote is still valid
     */
    verifyQuoteValid(): Promise<boolean>;
    /**
     * Get the estimated smart chain fee of the commit transaction
     */
    protected getCommitFee(): Promise<bigint>;
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
}
