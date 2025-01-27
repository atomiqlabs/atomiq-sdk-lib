"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISwapWrapper = void 0;
const base_1 = require("@atomiqlabs/base");
const events_1 = require("events");
const SwapWrapperStorage_1 = require("./SwapWrapperStorage");
const BN = require("bn.js");
const IntermediaryError_1 = require("../errors/IntermediaryError");
const Utils_1 = require("../utils/Utils");
class ISwapWrapper {
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
    constructor(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events) {
        this.logger = (0, Utils_1.getLogger)(this.constructor.name + ": ");
        this.isInitialized = false;
        this.tickInterval = null;
        this.boundProcessEvents = this.processEvents.bind(this);
        this.chainIdentifier = chainIdentifier;
        this.storage = new SwapWrapperStorage_1.SwapWrapperStorage(storage);
        this.contract = contract;
        this.prices = prices;
        this.chainEvents = chainEvents;
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
                name: tokenData.name
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
    preFetchSignData(signDataPrefetch) {
        if (this.contract.preFetchForInitSignatureVerification == null)
            return Promise.resolve(null);
        return signDataPrefetch.then(obj => {
            if (obj == null)
                return null;
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
    verifyReturnedSignature(data, signature, feeRatePromise, preFetchSignatureVerificationData, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const [feeRate, preFetchedSignatureData] = yield Promise.all([feeRatePromise, preFetchSignatureVerificationData]);
            yield (0, Utils_1.tryWithRetries)(() => this.contract.isValidInitAuthorization(data, signature, feeRate, preFetchedSignatureData), null, base_1.SignatureVerificationError, abortSignal);
            return yield (0, Utils_1.tryWithRetries)(() => this.contract.getInitAuthorizationExpiry(data, signature, preFetchedSignatureData), null, base_1.SignatureVerificationError, abortSignal);
        });
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
    verifyReturnedPrice(lpServiceData, send, amountSats, amountToken, token, feeData, pricePrefetchPromise = Promise.resolve(null), abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const swapBaseFee = new BN(lpServiceData.swapBaseFee);
            const swapFeePPM = new BN(lpServiceData.swapFeePPM);
            if (send)
                amountToken = amountToken.sub(feeData.networkFee);
            const isValidAmount = yield (send ?
                this.prices.isValidAmountSend(this.chainIdentifier, amountSats, swapBaseFee, swapFeePPM, amountToken, token, abortSignal, yield pricePrefetchPromise) :
                this.prices.isValidAmountReceive(this.chainIdentifier, amountSats, swapBaseFee, swapFeePPM, amountToken, token, abortSignal, yield pricePrefetchPromise));
            if (!isValidAmount.isValid)
                throw new IntermediaryError_1.IntermediaryError("Fee too high");
            return isValidAmount;
        });
    }
    /**
     * Processes batch of SC on-chain events
     * @param events
     * @private
     */
    processEvents(events) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            for (let event of events) {
                const paymentHash = event.paymentHash;
                const swap = this.swapData.get(paymentHash);
                if (swap == null)
                    continue;
                let swapChanged = false;
                if (event instanceof base_1.InitializeEvent) {
                    swapChanged = yield this.processEventInitialize(swap, event);
                    if (((_a = event.meta) === null || _a === void 0 ? void 0 : _a.txId) != null && swap.commitTxId !== event.meta.txId) {
                        swap.commitTxId = event.meta.txId;
                        swapChanged || (swapChanged = true);
                    }
                }
                if (event instanceof base_1.ClaimEvent) {
                    swapChanged = yield this.processEventClaim(swap, event);
                    if (((_b = event.meta) === null || _b === void 0 ? void 0 : _b.txId) != null && swap.claimTxId !== event.meta.txId) {
                        swap.claimTxId = event.meta.txId;
                        swapChanged || (swapChanged = true);
                    }
                }
                if (event instanceof base_1.RefundEvent) {
                    swapChanged = yield this.processEventRefund(swap, event);
                    if (((_c = event.meta) === null || _c === void 0 ? void 0 : _c.txId) != null && swap.refundTxId !== event.meta.txId) {
                        swap.refundTxId = event.meta.txId;
                        swapChanged || (swapChanged = true);
                    }
                }
                this.logger.info("processEvents(): " + event.constructor.name + " processed for " + swap.getPaymentHashString() + " swap: ", swap);
                if (swapChanged) {
                    yield swap._saveAndEmit();
                }
            }
            return true;
        });
    }
    /**
     * Initializes the swap wrapper, needs to be called before any other action can be taken
     */
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.storage.init();
            if (this.isInitialized)
                return;
            this.swapData = yield this.storage.loadSwapData(this, this.swapDeserializer);
            const hasEventListener = this.processEventRefund != null || this.processEventClaim != null || this.processEventInitialize != null;
            //Save events received in the meantime into the event queue and process them only after we've checked and
            // processed all the past swaps
            let eventQueue = [];
            const initListener = (events) => {
                eventQueue.push(...events);
                return Promise.resolve(true);
            };
            if (hasEventListener)
                this.chainEvents.registerListener(initListener);
            //Check past swaps
            const changedSwaps = [];
            const removeSwaps = [];
            yield Promise.all((0, Utils_1.mapToArray)(this.swapData, (key, swap) => this.checkPastSwap(swap).then(changed => {
                if (swap.isQuoteExpired()) {
                    removeSwaps.push(swap);
                }
                else {
                    if (changed)
                        changedSwaps.push(swap);
                }
            }).catch(e => this.logger.error("init(): Error when checking swap " + swap.getPaymentHashString() + ": ", e))));
            yield this.storage.removeSwapDataArr(removeSwaps);
            yield this.storage.saveSwapDataArr(changedSwaps);
            if (hasEventListener) {
                //Process accumulated event queue
                yield this.processEvents(eventQueue);
                //Register the correct event handler
                this.chainEvents.unregisterListener(initListener);
                this.chainEvents.registerListener(this.boundProcessEvents);
            }
            this.tickInterval = setInterval(() => {
                this.swapData.forEach(value => {
                    this.tickSwap(value);
                });
            }, 1000);
            this.logger.info("init(): Swap wrapper initialized, num swaps: " + this.swapData.size);
            this.isInitialized = true;
        });
    }
    /**
     * Un-subscribes from event listeners on Solana
     */
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            this.swapData = null;
            this.isInitialized = false;
            this.chainEvents.unregisterListener(this.boundProcessEvents);
            this.logger.info("stop(): Swap wrapper stopped");
            if (this.tickInterval != null)
                clearInterval(this.tickInterval);
        });
    }
    /**
     * Returns all swaps, optionally only those which were intiated by as specific signer's address
     */
    getAllSwaps(signer) {
        return Promise.resolve(this.getAllSwapsSync(signer));
    }
    /**
     * Returns all swaps, optionally only those which were intiated by as specific signer's address
     */
    getAllSwapsSync(signer) {
        if (!this.isInitialized)
            throw new Error("Not initialized, call init() first!");
        const array = (0, Utils_1.mapToArray)(this.swapData, (key, value) => value);
        if (signer != null)
            return array.filter((swap) => this.isOurSwap(signer, swap));
        return array;
    }
    /**
     * Returns the smart chain's native token used to pay for fees
     */
    getNativeToken() {
        return this.tokens[this.contract.getNativeCurrencyAddress()];
    }
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getActionableSwaps(signer) {
        return Promise.resolve(this.getActionableSwapsSync(signer));
    }
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getActionableSwapsSync(signer) {
        return this.getAllSwapsSync(signer).filter(swap => swap.isActionable());
    }
}
exports.ISwapWrapper = ISwapWrapper;
