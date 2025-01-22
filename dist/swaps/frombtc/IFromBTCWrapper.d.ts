import { IFromBTCSwap } from "./IFromBTCSwap";
import { AmountData, ISwapWrapper, ISwapWrapperOptions } from "../ISwapWrapper";
import * as BN from "bn.js";
import { Intermediary } from "../../intermediaries/Intermediary";
import { ChainType } from "@atomiqlabs/base";
export declare abstract class IFromBTCWrapper<T extends ChainType, S extends IFromBTCSwap<T, any>, O extends ISwapWrapperOptions = ISwapWrapperOptions> extends ISwapWrapper<T, S, O> {
    /**
     * Returns a random sequence to be used for swaps
     *
     * @protected
     * @returns Random 64-bit sequence number
     */
    protected getRandomSequence(): BN;
    /**
     * Pre-fetches feeRate for a given swap
     *
     * @param signer Address initiating the swap
     * @param amountData
     * @param hash optional hash of the swap or null
     * @param abortController
     * @protected
     * @returns Fee rate
     */
    protected preFetchFeeRate(signer: string, amountData: AmountData, hash: string | null, abortController: AbortController): Promise<any | null>;
    /**
     * Pre-fetches intermediary's available SC on-chain liquidity
     * @param amountData
     * @param lp Intermediary
     * @param abortController
     * @protected
     * @returns Intermediary's liquidity balance
     */
    protected preFetchIntermediaryLiquidity(amountData: AmountData, lp: Intermediary, abortController: AbortController): Promise<BN | null>;
    /**
     * Verifies whether the intermediary has enough available liquidity such that we can initiate the swap
     *
     * @param amount Swap amount that we should receive
     * @param liquidityPromise pre-fetched liquidity promise as obtained from preFetchIntermediaryLiquidity()
     * @protected
     * @throws {IntermediaryError} if intermediary's liquidity is lower than what's required for the swap
     */
    protected verifyIntermediaryLiquidity(amount: BN, liquidityPromise: Promise<BN>): Promise<void>;
    protected isOurSwap(signer: string, swap: S): boolean;
    /**
     * Returns all swaps that are claimable, and optionally only those initiated with signer's address
     */
    getClaimableSwaps(signer?: string): Promise<S[]>;
    /**
     * Returns all swaps that are claimable, and optionally only those initiated with signer's address
     */
    getClaimableSwapsSync(signer?: string): S[];
}
