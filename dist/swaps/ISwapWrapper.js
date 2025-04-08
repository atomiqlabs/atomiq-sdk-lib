"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISwapWrapper = void 0;
const base_1 = require("@atomiqlabs/base");
const events_1 = require("events");
const IntermediaryError_1 = require("../errors/IntermediaryError");
const Utils_1 = require("../utils/Utils");
class ISwapWrapper {
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
    constructor(chainIdentifier, unifiedStorage, unifiedChainEvents, contract, prices, tokens, swapDataDeserializer, options, events) {
        this.logger = (0, Utils_1.getLogger)(this.constructor.name + ": ");
        this.pendingSwaps = new Map();
        this.isInitialized = false;
        this.tickInterval = null;
        this.unifiedStorage = unifiedStorage;
        this.unifiedChainEvents = unifiedChainEvents;
        this.chainIdentifier = chainIdentifier;
        this.contract = contract;
        this.prices = prices;
        this.swapDataDeserializer = swapDataDeserializer;
        this.events = events || new events_1.EventEmitter();
        this.options = options;
        this.tokens = {};
        for (let tokenData of tokens) {
            const chainData = tokenData.chains[chainIdentifier];
            if (chainData == null)
                continue;
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
    preFetchPrice(amountData, abortSignal) {
        return this.prices.preFetchPrice(this.chainIdentifier, amountData.token, abortSignal).catch(e => {
            this.logger.warn("preFetchPrice(): Error: ", e);
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
    preFetchSignData(signDataPrefetch) {
        if (this.contract.preFetchForInitSignatureVerification == null)
            return Promise.resolve(null);
        return signDataPrefetch.then(obj => {
            if (obj == null)
                return null;
            return this.contract.preFetchForInitSignatureVerification(obj);
        }).catch(e => {
            this.logger.warn("preFetchSignData(): Error: ", e);
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
    async verifyReturnedSignature(data, signature, feeRatePromise, preFetchSignatureVerificationData, abortSignal) {
        const [feeRate, preFetchedSignatureData] = await Promise.all([feeRatePromise, preFetchSignatureVerificationData]);
        await (0, Utils_1.tryWithRetries)(() => this.contract.isValidInitAuthorization(data, signature, feeRate, preFetchedSignatureData), null, base_1.SignatureVerificationError, abortSignal);
        return await (0, Utils_1.tryWithRetries)(() => this.contract.getInitAuthorizationExpiry(data, signature, preFetchedSignatureData), null, base_1.SignatureVerificationError, abortSignal);
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
    async verifyReturnedPrice(lpServiceData, send, amountSats, amountToken, token, feeData, pricePrefetchPromise = Promise.resolve(null), abortSignal) {
        const swapBaseFee = BigInt(lpServiceData.swapBaseFee);
        const swapFeePPM = BigInt(lpServiceData.swapFeePPM);
        if (send)
            amountToken = amountToken - feeData.networkFee;
        const isValidAmount = await (send ?
            this.prices.isValidAmountSend(this.chainIdentifier, amountSats, swapBaseFee, swapFeePPM, amountToken, token, abortSignal, await pricePrefetchPromise) :
            this.prices.isValidAmountReceive(this.chainIdentifier, amountSats, swapBaseFee, swapFeePPM, amountToken, token, abortSignal, await pricePrefetchPromise));
        if (!isValidAmount.isValid)
            throw new IntermediaryError_1.IntermediaryError("Fee too high");
        return isValidAmount;
    }
    /**
     * Processes a single SC on-chain event
     * @private
     * @param event
     * @param swap
     */
    async processEvent(event, swap) {
        if (swap == null)
            return;
        let swapChanged = false;
        if (event instanceof base_1.InitializeEvent) {
            swapChanged = await this.processEventInitialize(swap, event);
            if (event.meta?.txId != null && swap.commitTxId !== event.meta.txId) {
                swap.commitTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }
        if (event instanceof base_1.ClaimEvent) {
            swapChanged = await this.processEventClaim(swap, event);
            if (event.meta?.txId != null && swap.claimTxId !== event.meta.txId) {
                swap.claimTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }
        if (event instanceof base_1.RefundEvent) {
            swapChanged = await this.processEventRefund(swap, event);
            if (event.meta?.txId != null && swap.refundTxId !== event.meta.txId) {
                swap.refundTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }
        this.logger.info("processEvents(): " + event.constructor.name + " processed for " + swap.getIdentifierHashString() + " swap: ", swap);
        if (swapChanged) {
            await swap._saveAndEmit();
        }
        return true;
    }
    /**
     * Initializes the swap wrapper, needs to be called before any other action can be taken
     */
    async init(noTimers = false, noCheckPastSwaps = false) {
        if (this.isInitialized)
            return;
        const hasEventListener = this.processEventRefund != null || this.processEventClaim != null || this.processEventInitialize != null;
        //Save events received in the meantime into the event queue and process them only after we've checked and
        // processed all the past swaps
        let eventQueue = [];
        const initListener = (event, swap) => {
            eventQueue.push({ event, swap });
            return Promise.resolve();
        };
        if (hasEventListener)
            this.unifiedChainEvents.registerListener(this.TYPE, initListener, this.swapDeserializer.bind(null, this));
        if (!noCheckPastSwaps)
            await this.checkPastSwaps();
        if (hasEventListener) {
            //Process accumulated event queue
            for (let event of eventQueue) {
                await this.processEvent(event.event, event.swap);
            }
            //Register the correct event handler
            this.unifiedChainEvents.unregisterListener(this.TYPE);
            this.unifiedChainEvents.registerListener(this.TYPE, this.processEvent.bind(this), this.swapDeserializer.bind(null, this));
        }
        if (!noTimers)
            this.startTickInterval();
        this.logger.info("init(): Swap wrapper initialized");
        this.isInitialized = true;
    }
    startTickInterval() {
        if (this.tickSwapState == null || this.tickSwapState.length === 0)
            return;
        this.tickInterval = setInterval(() => {
            this.tick();
        }, 1000);
    }
    async checkPastSwaps(pastSwaps) {
        if (pastSwaps == null)
            pastSwaps = await this.unifiedStorage.query([[{ key: "type", value: this.TYPE }, { key: "state", value: this.pendingSwapStates }]], (val) => new this.swapDeserializer(this, val));
        //Check past swaps
        const changedSwaps = [];
        const removeSwaps = [];
        await Promise.all(pastSwaps.map((swap) => swap._sync(false).then(changed => {
            if (swap.isQuoteExpired()) {
                removeSwaps.push(swap);
                this.logger.debug("init(): Removing expired swap: " + swap.getId());
            }
            else {
                if (changed)
                    changedSwaps.push(swap);
            }
        }).catch(e => this.logger.warn("init(): Error when checking swap " + swap.getIdentifierHashString() + ": ", e))));
        await this.unifiedStorage.removeAll(removeSwaps);
        await this.unifiedStorage.saveAll(changedSwaps);
    }
    async tick(swaps) {
        if (swaps == null)
            swaps = await this.unifiedStorage.query([[{ key: "type", value: this.TYPE }, { key: "state", value: this.tickSwapState }]], (val) => new this.swapDeserializer(this, val));
        for (let pendingSwap of this.pendingSwaps.values()) {
            const value = pendingSwap.deref();
            if (value != null)
                value._tick(true);
        }
        swaps.forEach(value => {
            value._tick(true);
        });
    }
    saveSwapData(swap) {
        if (!swap.isInitiated()) {
            this.logger.debug("saveSwapData(): Swap " + swap.getId() + " not initiated, saving to pending swaps");
            this.pendingSwaps.set(swap.getId(), new WeakRef(swap));
            return Promise.resolve();
        }
        else {
            this.pendingSwaps.delete(swap.getId());
        }
        return this.unifiedStorage.save(swap);
    }
    removeSwapData(swap) {
        this.pendingSwaps.delete(swap.getId());
        if (!swap.isInitiated)
            return Promise.resolve();
        return this.unifiedStorage.remove(swap);
    }
    /**
     * Un-subscribes from event listeners on Solana
     */
    async stop() {
        this.isInitialized = false;
        this.unifiedChainEvents.unregisterListener(this.TYPE);
        this.logger.info("stop(): Swap wrapper stopped");
        if (this.tickInterval != null)
            clearInterval(this.tickInterval);
    }
    /**
     * Returns the smart chain's native token used to pay for fees
     */
    getNativeToken() {
        return this.tokens[this.contract.getNativeCurrencyAddress()];
    }
}
exports.ISwapWrapper = ISwapWrapper;
