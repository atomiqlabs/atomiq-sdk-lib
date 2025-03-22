/// <reference types="node" />
/// <reference types="node" />
import { ISwap, ISwapInit } from "../ISwap";
import { ChainType, SignatureData, SwapCommitStatus, SwapData } from "@atomiqlabs/base";
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
    protected watchdogWaitTillResult(abortSignal?: AbortSignal, interval?: number): Promise<SwapCommitStatus.PAID | SwapCommitStatus.EXPIRED | SwapCommitStatus.NOT_COMMITED>;
    /**
     * Checks if the swap's quote is still valid
     */
    isQuoteValid(): Promise<boolean>;
    /**
     * Get the estimated smart chain fee of the commit transaction
     */
    getCommitFee(): Promise<bigint>;
    /**
     * Returns the transaction fee paid on the smart chain
     */
    getSmartChainNetworkFee(): Promise<TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>>;
    serialize(): any;
}
