import { IToBTCSwap } from "./IToBTCSwap";
import { ChainType, ClaimEvent, InitializeEvent, RefundEvent } from "@atomiqlabs/base";
import { AmountData, ISwapWrapper, ISwapWrapperOptions } from "../ISwapWrapper";
import { Intermediary, SingleChainReputationType } from "../../intermediaries/Intermediary";
export declare abstract class IToBTCWrapper<T extends ChainType, S extends IToBTCSwap<T> = IToBTCSwap<T>, O extends ISwapWrapperOptions = ISwapWrapperOptions> extends ISwapWrapper<T, S, O> {
    /**
     * Checks the swap's state on-chain and compares it to its internal state, updates/changes it according to on-chain
     *  data
     *
     * @param swap Swap to be checked
     * @private
     */
    private syncStateFromChain;
    /**
     * Pre-fetches intermediary's reputation, doesn't throw, instead aborts via abortController and returns null
     *
     * @param amountData
     * @param lp Intermediary
     * @param abortController
     * @protected
     * @returns Intermediary's reputation or null if failed
     * @throws {IntermediaryError} If the intermediary vault doesn't exist
     */
    protected preFetchIntermediaryReputation(amountData: Omit<AmountData, "amount">, lp: Intermediary, abortController: AbortController): Promise<SingleChainReputationType | null>;
    /**
     * Pre-fetches feeRate for a given swap
     *
     * @param signer Address of the swap initiator
     * @param amountData
     * @param claimHash optional hash of the swap or null
     * @param abortController
     * @protected
     * @returns Fee rate
     */
    protected preFetchFeeRate(signer: string, amountData: Omit<AmountData, "amount">, claimHash: string | null, abortController: AbortController): Promise<any | null>;
    protected checkPastSwap(swap: S): Promise<boolean>;
    protected tickSwap(swap: S): void;
    protected processEventInitialize(swap: S, event: InitializeEvent<T["Data"]>): Promise<boolean>;
    protected processEventClaim(swap: S, event: ClaimEvent<T["Data"]>): Promise<boolean>;
    protected processEventRefund(swap: S, event: RefundEvent<T["Data"]>): Promise<boolean>;
    protected isOurSwap(signer: string, swap: S): boolean;
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getRefundableSwaps(signer?: string): Promise<S[]>;
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getRefundableSwapsSync(signer?: string): S[];
}
