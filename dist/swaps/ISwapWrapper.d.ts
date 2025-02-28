/// <reference types="node" />
/// <reference types="node" />
import { ChainType, ClaimEvent, InitializeEvent, IStorageManager, RefundEvent, SignatureData } from "@atomiqlabs/base";
import { EventEmitter } from "events";
import { ISwap } from "./ISwap";
import { SwapWrapperStorage } from "./SwapWrapperStorage";
import { ISwapPrice, PriceInfoType } from "../prices/abstract/ISwapPrice";
import { SCToken } from "./Tokens";
import { ChainIds, MultiChain } from "./Swapper";
export type AmountData = {
    amount: bigint;
    token: string;
    exactIn?: boolean;
};
export type ISwapWrapperOptions = {
    getRequestTimeout?: number;
    postRequestTimeout?: number;
};
export type WrapperCtorTokens<T extends MultiChain = MultiChain> = {
    ticker: string;
    name: string;
    chains: {
        [chainId in ChainIds<T>]?: {
            address: string;
            decimals: number;
            displayDecimals?: number;
        };
    };
}[];
export declare abstract class ISwapWrapper<T extends ChainType, S extends ISwap<T>, O extends ISwapWrapperOptions = ISwapWrapperOptions> {
    protected readonly logger: import("../utils/Utils").LoggerType;
    protected readonly abstract swapDeserializer: new (wrapper: ISwapWrapper<T, S, O>, data: any) => S;
    readonly chainIdentifier: string;
    readonly storage: SwapWrapperStorage<S>;
    readonly contract: T["Contract"];
    readonly prices: ISwapPrice;
    readonly chainEvents: T["Events"];
    readonly swapDataDeserializer: new (data: any) => T["Data"];
    readonly events: EventEmitter;
    readonly options: O;
    readonly tokens: {
        [tokenAddress: string]: SCToken<T["ChainId"]>;
    };
    swapData: Map<string, S>;
    swapDataByEscrowHash: Map<string, S>;
    isInitialized: boolean;
    tickInterval: NodeJS.Timeout;
    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param prices Swap pricing handler
     * @param chainEvents On-chain event listener
     * @param tokens Chain specific token data
     * @param swapDataDeserializer Deserializer for SwapData
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier: string, storage: IStorageManager<S>, contract: T["Contract"], chainEvents: T["Events"], prices: ISwapPrice, tokens: WrapperCtorTokens, swapDataDeserializer: new (data: any) => T["Data"], options: O, events?: EventEmitter);
    /**
     * Pre-fetches swap price for a given swap
     *
     * @param amountData
     * @param abortSignal
     * @protected
     * @returns Price of the token in uSats (micro sats)
     */
    protected preFetchPrice(amountData: Omit<AmountData, "amount">, abortSignal?: AbortSignal): Promise<bigint | null>;
    /**
     * Pre-fetches signature verification data from the server's pre-sent promise, doesn't throw, instead returns null
     *
     * @param signDataPrefetch Promise that resolves when we receive "signDataPrefetch" from the LP in streaming mode
     * @protected
     * @returns Pre-fetched signature verification data or null if failed
     */
    protected preFetchSignData(signDataPrefetch: Promise<any | null>): Promise<any | null>;
    /**
     * Verifies swap initialization signature returned by the intermediary
     *
     * @param data Parsed swap data from the intermediary
     * @param signature Response of the intermediary
     * @param feeRatePromise Pre-fetched fee rate promise
     * @param preFetchSignatureVerificationData Pre-fetched signature verification data
     * @param abortSignal
     * @protected
     * @returns Swap initialization signature expiry
     * @throws {SignatureVerificationError} when swap init signature is invalid
     */
    protected verifyReturnedSignature(data: T["Data"], signature: SignatureData, feeRatePromise: Promise<any>, preFetchSignatureVerificationData: Promise<any>, abortSignal?: AbortSignal): Promise<number>;
    /**
     * Verifies returned  price for swaps
     *
     * @param lpServiceData Service data for the service in question (TO_BTCLN, TO_BTC, etc.) of the given intermediary
     * @param send Whether this is a send (SOL -> SC) or receive (BTC -> SC) swap
     * @param amountSats Amount in BTC
     * @param amountToken Amount in token
     * @param token Token used in the swap
     * @param feeData Fee data as returned by the intermediary
     * @param pricePrefetchPromise Price pre-fetch promise
     * @param abortSignal
     * @protected
     * @returns Price info object
     * @throws {IntermediaryError} if the calculated fee is too high
     */
    protected verifyReturnedPrice(lpServiceData: {
        swapBaseFee: number;
        swapFeePPM: number;
    }, send: boolean, amountSats: bigint, amountToken: bigint, token: string, feeData: {
        swapFee: bigint;
        networkFee?: bigint;
        totalFee?: bigint;
    }, pricePrefetchPromise?: Promise<bigint>, abortSignal?: AbortSignal): Promise<PriceInfoType>;
    /**
     * Checks if the provided swap is belonging to the provided signer's address
     *
     * @param signer
     * @param swap Swap to be checked
     * @protected
     */
    protected abstract isOurSwap(signer: string, swap: S): boolean;
    /**
     * Processes InitializeEvent for a given swap
     * @param swap
     * @param event
     * @protected
     * @returns Whether the swap was updated/changed
     */
    protected processEventInitialize?(swap: S, event: InitializeEvent<T["Data"]>): Promise<boolean>;
    /**
     * Processes ClaimEvent for a given swap
     * @param swap
     * @param event
     * @protected
     * @returns Whether the swap was updated/changed
     */
    protected processEventClaim?(swap: S, event: ClaimEvent<T["Data"]>): Promise<boolean>;
    /**
     * Processes RefundEvent for a given swap
     * @param swap
     * @param event
     * @protected
     * @returns Whether the swap was updated/changed
     */
    protected processEventRefund?(swap: S, event: RefundEvent<T["Data"]>): Promise<boolean>;
    /**
     * Checks past swap and syncs its state from the chain, this is called on initialization for all unfinished swaps
     * @param swap
     * @protected
     * @returns Whether the swap was updated/changed
     */
    protected abstract checkPastSwap(swap: S): Promise<boolean>;
    protected abstract tickSwap(swap: S): void;
    /**
     * Processes batch of SC on-chain events
     * @param events
     * @private
     */
    private processEvents;
    private boundProcessEvents;
    /**
     * Initializes the swap wrapper, needs to be called before any other action can be taken
     */
    init(noTimers?: boolean): Promise<void>;
    saveSwapData(swap: S): Promise<void>;
    removeSwapData(swap: S): Promise<void>;
    /**
     * Un-subscribes from event listeners on Solana
     */
    stop(): Promise<void>;
    /**
     * Returns all swaps, optionally only those which were intiated by as specific signer's address
     */
    getAllSwaps(signer?: string): Promise<S[]>;
    /**
     * Returns all swaps, optionally only those which were intiated by as specific signer's address
     */
    getAllSwapsSync(signer?: string): S[];
    /**
     * Returns the smart chain's native token used to pay for fees
     */
    getNativeToken(): SCToken<T["ChainId"]>;
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getActionableSwaps(signer?: string): Promise<S[]>;
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getActionableSwapsSync(signer?: string): S[];
}
