import { ISwapPrice, PriceInfoType } from "./abstract/ISwapPrice";
import { ChainIds, MultiChain } from "../swaps/Swapper";
import * as BN from "bn.js";
import { Token } from "../swaps/Tokens";
export declare class SwapPriceWithChain<T extends MultiChain, ChainIdentifier extends ChainIds<T>> {
    swapPrice: ISwapPrice<T>;
    chainIdentifier: ChainIdentifier;
    maxAllowedFeeDifferencePPM: BN;
    constructor(swapPrice: ISwapPrice<T>, chainIdentifier: ChainIdentifier);
    /**
     * Checks whether the swap amounts are valid given the current market rate for a given pair
     *
     * @param amountSats Amount of sats (BTC) to be received from the swap
     * @param satsBaseFee Base fee in sats (BTC) as reported by the intermediary
     * @param feePPM PPM fee rate as reported by the intermediary
     * @param paidToken Amount of token to be paid to the swap
     * @param token
     * @param abortSignal
     * @param preFetchedPrice Already pre-fetched price
     */
    isValidAmountSend(amountSats: BN, satsBaseFee: BN, feePPM: BN, paidToken: BN, token: string, abortSignal?: AbortSignal, preFetchedPrice?: BN): Promise<PriceInfoType>;
    /**
     * Checks whether the swap amounts are valid given the current market rate for a given pair
     *
     * @param amountSats Amount of sats (BTC) to be paid to the swap
     * @param satsBaseFee Base fee in sats (BTC) as reported by the intermediary
     * @param feePPM PPM fee rate as reported by the intermediary
     * @param receiveToken Amount of token to be received from the swap
     * @param token
     * @param abortSignal
     * @param preFetchedPrice Already pre-fetched price
     */
    isValidAmountReceive(amountSats: BN, satsBaseFee: BN, feePPM: BN, receiveToken: BN, token: string, abortSignal?: AbortSignal, preFetchedPrice?: BN): Promise<PriceInfoType>;
    preFetchPrice(token: string, abortSignal?: AbortSignal): Promise<BN>;
    preFetchUsdPrice(abortSignal?: AbortSignal): Promise<number>;
    /**
     * Returns amount of {toToken} that are equivalent to {fromAmount} satoshis
     *
     * @param fromAmount        Amount of satoshis
     * @param toToken           Token
     * @param abortSignal
     * @param preFetchedPrice
     * @throws {Error} when token is not found
     */
    getFromBtcSwapAmount(fromAmount: BN, toToken: string, abortSignal?: AbortSignal, preFetchedPrice?: BN): Promise<BN>;
    /**
     * Returns amount of satoshis that are equivalent to {fromAmount} of {fromToken}
     *
     * @param fromAmount Amount of the token
     * @param fromToken Token
     * @param abortSignal
     * @param preFetchedPrice Pre-fetched swap price if available
     * @throws {Error} when token is not found
     */
    getToBtcSwapAmount(fromAmount: BN, fromToken: string, abortSignal?: AbortSignal, preFetchedPrice?: BN): Promise<BN>;
    /**
     * Returns whether the token should be ignored and pricing for it not calculated
     *
     * @param tokenAddress
     * @throws {Error} if token is not found
     */
    shouldIgnore(tokenAddress: string): boolean;
    getBtcUsdValue(btcSats: BN, abortSignal?: AbortSignal, preFetchedPrice?: number): Promise<number>;
    getTokenUsdValue(tokenAmount: BN, token: string, abortSignal?: AbortSignal, preFetchedPrice?: number): Promise<number>;
    getUsdValue(amount: BN, token: Token<ChainIdentifier>, abortSignal?: AbortSignal, preFetchedUsdPrice?: number): Promise<number>;
}
