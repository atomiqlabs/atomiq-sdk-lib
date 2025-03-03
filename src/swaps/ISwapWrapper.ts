import {
    ChainType,
    ClaimEvent,
    InitializeEvent,
    RefundEvent, SignatureData,
    SignatureVerificationError,
    SwapEvent
} from "@atomiqlabs/base";
import {EventEmitter} from "events";
import {ISwap} from "./ISwap";
import {ISwapPrice, PriceInfoType} from "../prices/abstract/ISwapPrice";
import {IntermediaryError} from "../errors/IntermediaryError";
import {getLogger, tryWithRetries} from "../utils/Utils";
import {SCToken} from "./Tokens";
import {ChainIds, MultiChain} from "./Swapper";
import {ISwapStorage} from "../swap-storage/ISwapStorage";
import {UnifiedSwapEventListener} from "../events/UnifiedSwapEventListener";
import {SwapType} from "./SwapType";

export type AmountData = {
    amount: bigint,
    token: string,
    exactIn?: boolean
}

export type ISwapWrapperOptions = {
    getRequestTimeout?: number,
    postRequestTimeout?: number
};

export type WrapperCtorTokens<T extends MultiChain = MultiChain> = {
    ticker: string,
    name: string,
    chains: {[chainId in ChainIds<T>]?: {
        address: string,
        decimals: number,
        displayDecimals?: number
    }}
}[];

export abstract class ISwapWrapper<
    T extends ChainType,
    S extends ISwap<T>,
    O extends ISwapWrapperOptions = ISwapWrapperOptions
> {
    abstract readonly TYPE: SwapType;
    protected readonly logger = getLogger(this.constructor.name+": ");

    public readonly abstract swapDeserializer: new (wrapper: ISwapWrapper<T, S, O>, data: any) => S;

    readonly unifiedStorage: ISwapStorage<S>;
    readonly unifiedChainEvents: UnifiedSwapEventListener<T>;

    readonly chainIdentifier: string;
    readonly contract: T["Contract"];
    readonly prices: ISwapPrice;
    readonly swapDataDeserializer: new (data: any) => T["Data"];
    readonly events: EventEmitter;
    readonly options: O;
    readonly tokens: {
        [tokenAddress: string]: SCToken<T["ChainId"]>
    };

    isInitialized: boolean = false;
    tickInterval: NodeJS.Timeout = null;

    /**
     * @param chainIdentifier
     * @param unifiedStorage
     * @param unifiedChainEvents
     * @param contract Underlying contract handling the swaps
     * @param prices Swap pricing handler
     * @param tokens Chain specific token data
     * @param swapDataDeserializer Deserializer for SwapData
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(
        chainIdentifier: string,
        unifiedStorage: ISwapStorage<S>,
        unifiedChainEvents: UnifiedSwapEventListener<T>,
        contract: T["Contract"],
        prices: ISwapPrice,
        tokens: WrapperCtorTokens,
        swapDataDeserializer: new (data: any) => T["Data"],
        options: O,
        events?: EventEmitter
    ) {
        this.unifiedStorage = unifiedStorage;
        this.unifiedChainEvents = unifiedChainEvents;

        this.chainIdentifier = chainIdentifier;
        this.contract = contract;
        this.prices = prices;
        this.swapDataDeserializer = swapDataDeserializer;
        this.events = events || new EventEmitter();
        this.options = options;
        this.tokens = {};
        for(let tokenData of tokens) {
            const chainData = tokenData.chains[chainIdentifier];
            if(chainData==null) continue;
            this.tokens[chainData.address] = {
                chain: "SC",
                chainId: this.chainIdentifier,
                address: chainData.address,
                decimals: chainData.decimals,
                ticker: tokenData.ticker,
                name: tokenData.name,
                displayDecimals: chainData.displayDecimals
            };
        }
    }

    /**
     * Pre-fetches swap price for a given swap
     *
     * @param amountData
     * @param abortSignal
     * @protected
     * @returns Price of the token in uSats (micro sats)
     */
    protected preFetchPrice(amountData: Omit<AmountData, "amount">, abortSignal?: AbortSignal): Promise<bigint | null> {
        return this.prices.preFetchPrice(this.chainIdentifier, amountData.token, abortSignal).catch(e => {
            this.logger.error("preFetchPrice(): Error: ", e);
            return null;
        });
    }

    /**
     * Pre-fetches signature verification data from the server's pre-sent promise, doesn't throw, instead returns null
     *
     * @param signDataPrefetch Promise that resolves when we receive "signDataPrefetch" from the LP in streaming mode
     * @protected
     * @returns Pre-fetched signature verification data or null if failed
     */
    protected preFetchSignData(signDataPrefetch: Promise<any | null>): Promise<any | null> {
        if(this.contract.preFetchForInitSignatureVerification==null) return Promise.resolve(null);
        return signDataPrefetch.then(obj => {
            if(obj==null) return null;
            return this.contract.preFetchForInitSignatureVerification(obj);
        }).catch(e => {
            this.logger.error("preFetchSignData(): Error: ", e);
            return null;
        });
    }

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
    protected async verifyReturnedSignature(
        data: T["Data"],
        signature: SignatureData,
        feeRatePromise: Promise<any>,
        preFetchSignatureVerificationData: Promise<any>,
        abortSignal?: AbortSignal
    ): Promise<number> {
        const [feeRate, preFetchedSignatureData] = await Promise.all([feeRatePromise, preFetchSignatureVerificationData]);
        await tryWithRetries(
            () => this.contract.isValidInitAuthorization(data, signature, feeRate, preFetchedSignatureData),
            null,
            SignatureVerificationError,
            abortSignal
        );
        return await tryWithRetries(
            () => this.contract.getInitAuthorizationExpiry(data, signature, preFetchedSignatureData),
            null,
            SignatureVerificationError,
            abortSignal
        );
    }

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
    protected async verifyReturnedPrice(
        lpServiceData: {swapBaseFee: number, swapFeePPM: number},
        send: boolean,
        amountSats: bigint,
        amountToken: bigint,
        token: string,
        feeData: {
            swapFee: bigint,
            networkFee?: bigint,
            totalFee?: bigint
        },
        pricePrefetchPromise: Promise<bigint> = Promise.resolve(null),
        abortSignal?: AbortSignal
    ): Promise<PriceInfoType> {
        const swapBaseFee = BigInt(lpServiceData.swapBaseFee);
        const swapFeePPM = BigInt(lpServiceData.swapFeePPM);
        if(send) amountToken = amountToken - feeData.networkFee;

        const isValidAmount = await (
            send ?
                this.prices.isValidAmountSend(this.chainIdentifier, amountSats, swapBaseFee, swapFeePPM, amountToken, token, abortSignal, await pricePrefetchPromise) :
                this.prices.isValidAmountReceive(this.chainIdentifier, amountSats, swapBaseFee, swapFeePPM, amountToken, token, abortSignal, await pricePrefetchPromise)
        );
        if(!isValidAmount.isValid) throw new IntermediaryError("Fee too high");

        return isValidAmount;
    }

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
    protected abstract checkPastSwapStates: Array<S["state"]>;

    protected abstract tickSwap(swap: S): void;
    protected abstract tickSwapState: Array<S["state"]>;

    /**
     * Processes a single SC on-chain event
     * @private
     * @param event
     * @param swap
     */
    private async processEvent(event: SwapEvent<T["Data"]>, swap: S): Promise<boolean> {
        if(swap==null) return;

        let swapChanged: boolean = false;
        if(event instanceof InitializeEvent) {
            swapChanged = await this.processEventInitialize(swap, event);
            if(event.meta?.txId!=null && swap.commitTxId!==event.meta.txId) {
                swap.commitTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }
        if(event instanceof ClaimEvent) {
            swapChanged = await this.processEventClaim(swap, event);
            if(event.meta?.txId!=null && swap.claimTxId!==event.meta.txId) {
                swap.claimTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }
        if(event instanceof RefundEvent) {
            swapChanged = await this.processEventRefund(swap, event);
            if(event.meta?.txId!=null && swap.refundTxId!==event.meta.txId) {
                swap.refundTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }

        this.logger.info("processEvents(): "+event.constructor.name+" processed for "+swap.getIdentifierHashString()+" swap: ", swap);

        if(swapChanged) {
            await swap._saveAndEmit();
        }
        return true;
    }

    /**
     * Initializes the swap wrapper, needs to be called before any other action can be taken
     */
    public async init(noTimers: boolean = false, noCheckPastSwaps: boolean = false): Promise<void> {
        if(this.isInitialized) return;

        const hasEventListener = this.processEventRefund!=null || this.processEventClaim!=null || this.processEventInitialize!=null;

        //Save events received in the meantime into the event queue and process them only after we've checked and
        // processed all the past swaps
        let eventQueue: {
            event: SwapEvent<T["Data"]>,
            swap: S
        }[] = [];
        const initListener = (event: SwapEvent<T["Data"]>, swap: S) => {
            eventQueue.push({event, swap});
            return Promise.resolve();
        }
        if(hasEventListener) this.unifiedChainEvents.registerListener(this.TYPE, initListener, this.swapDeserializer.bind(null, this));

        if(!noCheckPastSwaps) {
            const pastSwaps = await this.unifiedStorage.query<S>(
                [{key: "type", value: this.TYPE}, {key: "state", value: this.checkPastSwapStates}],
                (val: any) => new this.swapDeserializer(this, val)
            );

            //Check past swaps
            const changedSwaps: S[] = [];
            const removeSwaps: S[] = [];

            await Promise.all(pastSwaps.map((swap: S) =>
                this.checkPastSwap(swap).then(changed => {
                    if(swap.isQuoteExpired()) {
                        removeSwaps.push(swap);
                    } else {
                        if(changed) changedSwaps.push(swap);
                    }
                }).catch(e => this.logger.error("init(): Error when checking swap "+swap.getIdentifierHashString()+": ", e))
            ));

            await this.unifiedStorage.removeAll(removeSwaps);
            await this.unifiedStorage.saveAll(changedSwaps);
        }

        if(hasEventListener) {
            //Process accumulated event queue
            for(let event of eventQueue) {
                await this.processEvent(event.event, event.swap);
            }

            //Register the correct event handler
            this.unifiedChainEvents.unregisterListener(this.TYPE);
            this.unifiedChainEvents.registerListener(this.TYPE, this.processEvent.bind(this), this.swapDeserializer.bind(null, this));
        }

        if(!noTimers) this.startTickInterval();

        this.logger.info("init(): Swap wrapper initialized");

        this.isInitialized = true;
    }

    protected startTickInterval(): void {
        if(this.tickSwapState==null || this.tickSwapState.length===0) return;
        this.tickInterval = setInterval(() => {
            this.tick();
        }, 1000);
    }

    async tick(): Promise<void> {
        const swaps = await this.unifiedStorage.query<S>(
            [{key: "type", value: this.TYPE}, {key: "state", value: this.tickSwapState}],
            (val: any) => new this.swapDeserializer(this, val)
        );

        swaps.forEach(value => {
            this.tickSwap(value);
        })
    }

    saveSwapData(swap: S): Promise<void> {
        if(!swap.isInitiated()) return Promise.resolve();
        return this.unifiedStorage.save(swap);
    }

    removeSwapData(swap: S): Promise<void> {
        if(!swap.isInitiated) return Promise.resolve();
        return this.unifiedStorage.remove(swap);
    }

    /**
     * Un-subscribes from event listeners on Solana
     */
    public async stop() {
        this.isInitialized = false;
        this.unifiedChainEvents.unregisterListener(this.TYPE);
        this.logger.info("stop(): Swap wrapper stopped");
        if(this.tickInterval!=null) clearInterval(this.tickInterval);
    }

    /**
     * Returns the smart chain's native token used to pay for fees
     */
    public getNativeToken(): SCToken<T["ChainId"]> {
        return this.tokens[this.contract.getNativeCurrencyAddress()];
    }

}