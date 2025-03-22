"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISwap = exports.isISwapInit = void 0;
const SwapType_1 = require("./enums/SwapType");
const events_1 = require("events");
const ISwapPrice_1 = require("../prices/abstract/ISwapPrice");
const Utils_1 = require("../utils/Utils");
const Tokens_1 = require("../Tokens");
const SwapDirection_1 = require("./enums/SwapDirection");
function isISwapInit(obj) {
    return typeof obj === 'object' &&
        obj != null &&
        (0, ISwapPrice_1.isPriceInfoType)(obj.pricingInfo) &&
        typeof obj.url === 'string' &&
        typeof obj.expiry === 'number' &&
        typeof (obj.swapFee) === "bigint" &&
        (obj.swapFeeBtc == null || typeof (obj.swapFeeBtc) === "bigint") &&
        (typeof obj.exactIn === 'boolean');
}
exports.isISwapInit = isISwapInit;
class ISwap {
    constructor(wrapper, swapInitOrObj) {
        this.currentVersion = 1;
        this.initiated = false;
        /**
         * Event emitter emitting "swapState" event when swap's state changes
         */
        this.events = new events_1.EventEmitter();
        this.chainIdentifier = wrapper.chainIdentifier;
        this.wrapper = wrapper;
        if (isISwapInit(swapInitOrObj)) {
            Object.assign(this, swapInitOrObj);
            this.version = this.currentVersion;
            this.createdAt = Date.now();
            this.randomNonce = (0, Utils_1.randomBytes)(16).toString("hex");
        }
        else {
            this.expiry = swapInitOrObj.expiry;
            this.url = swapInitOrObj.url;
            this.state = swapInitOrObj.state;
            this.pricingInfo = {
                isValid: swapInitOrObj._isValid,
                differencePPM: swapInitOrObj._differencePPM == null ? null : BigInt(swapInitOrObj._differencePPM),
                satsBaseFee: swapInitOrObj._satsBaseFee == null ? null : BigInt(swapInitOrObj._satsBaseFee),
                feePPM: swapInitOrObj._feePPM == null ? null : BigInt(swapInitOrObj._feePPM),
                realPriceUSatPerToken: swapInitOrObj._realPriceUSatPerToken == null ? null : BigInt(swapInitOrObj._realPriceUSatPerToken),
                swapPriceUSatPerToken: swapInitOrObj._swapPriceUSatPerToken == null ? null : BigInt(swapInitOrObj._swapPriceUSatPerToken),
            };
            this.swapFee = swapInitOrObj.swapFee == null ? null : BigInt(swapInitOrObj.swapFee);
            this.swapFeeBtc = swapInitOrObj.swapFeeBtc == null ? null : BigInt(swapInitOrObj.swapFeeBtc);
            this.version = swapInitOrObj.version;
            this.initiated = swapInitOrObj.initiated;
            this.exactIn = swapInitOrObj.exactIn;
            this.createdAt = swapInitOrObj.createdAt ?? swapInitOrObj.expiry;
            this.randomNonce = swapInitOrObj.randomNonce;
        }
        if (this.version !== this.currentVersion) {
            this.upgradeVersion();
        }
        if (this.initiated == null)
            this.initiated = true;
    }
    /**
     * Waits till the swap reaches a specific state
     *
     * @param targetState The state to wait for
     * @param type Whether to wait for the state exactly or also to a state with a higher number
     * @param abortSignal
     * @protected
     */
    waitTillState(targetState, type = "eq", abortSignal) {
        return new Promise((resolve, reject) => {
            let listener;
            listener = (swap) => {
                if (type === "eq" ? swap.state === targetState : type === "gte" ? swap.state >= targetState : swap.state != targetState) {
                    resolve();
                    this.events.removeListener("swapState", listener);
                }
            };
            this.events.on("swapState", listener);
            if (abortSignal != null)
                abortSignal.addEventListener("abort", () => {
                    this.events.removeListener("swapState", listener);
                    reject(abortSignal.reason);
                });
        });
    }
    //////////////////////////////
    //// Pricing
    /**
     * Checks if the pricing for the swap is valid, according to max allowed price difference set in the ISwapPrice
     */
    hasValidPrice() {
        return this.pricingInfo == null ? null : this.pricingInfo.isValid;
    }
    /**
     * Returns the price difference between offered price and current market price in PPM (parts per million)
     */
    getPriceDifferencePPM() {
        return this.pricingInfo == null ? null : this.pricingInfo.differencePPM;
    }
    /**
     * Returns the price difference between offered price and current market price as a decimal number
     */
    getPriceDifferencePct() {
        return this.pricingInfo == null ? null : this.pricingInfo.differencePPM == null ? null : Number(this.pricingInfo.differencePPM) / 1000000;
    }
    /**
     * Returns quote expiry in UNIX millis
     */
    getExpiry() {
        return this.expiry;
    }
    /**
     * Returns the type of the swap
     */
    getType() {
        return this.TYPE;
    }
    /**
     * Returns the direction of the swap
     */
    getDirection() {
        return this.TYPE === SwapType_1.SwapType.TO_BTC || this.TYPE === SwapType_1.SwapType.TO_BTCLN ? SwapDirection_1.SwapDirection.TO_BTC : SwapDirection_1.SwapDirection.FROM_BTC;
    }
    /**
     * Returns the current state of the swap
     */
    getState() {
        return this.state;
    }
    /**
     * @param signer Signer to check with this swap's initiator
     * @throws {Error} When signer's address doesn't match with the swap's initiator one
     */
    checkSigner(signer) {
        if ((typeof (signer) === "string" ? signer : signer.getAddress()) !== this.getInitiator())
            throw new Error("Invalid signer provided!");
    }
    isInitiated() {
        return this.initiated;
    }
    /**
     * Returns total fee for the swap, the fee is represented in source currency & destination currency, but is
     *  paid only once
     */
    getFee() {
        return this.getSwapFee();
    }
    /**
     * Returns the transaction fee paid on the smart chain
     */
    async getSmartChainNetworkFee() {
        return (0, Tokens_1.toTokenAmount)(0n, this.wrapper.getNativeToken(), this.wrapper.prices);
    }
    //////////////////////////////
    //// Storage
    serialize() {
        if (this.pricingInfo == null)
            return {};
        return {
            id: this.getId(),
            type: this.getType(),
            escrowHash: this.getEscrowHash(),
            initiator: this.getInitiator(),
            _isValid: this.pricingInfo.isValid,
            _differencePPM: this.pricingInfo.differencePPM == null ? null : this.pricingInfo.differencePPM.toString(10),
            _satsBaseFee: this.pricingInfo.satsBaseFee == null ? null : this.pricingInfo.satsBaseFee.toString(10),
            _feePPM: this.pricingInfo.feePPM == null ? null : this.pricingInfo.feePPM.toString(10),
            _realPriceUSatPerToken: this.pricingInfo.realPriceUSatPerToken == null ? null : this.pricingInfo.realPriceUSatPerToken.toString(10),
            _swapPriceUSatPerToken: this.pricingInfo.swapPriceUSatPerToken == null ? null : this.pricingInfo.swapPriceUSatPerToken.toString(10),
            state: this.state,
            url: this.url,
            swapFee: this.swapFee == null ? null : this.swapFee.toString(10),
            swapFeeBtc: this.swapFeeBtc == null ? null : this.swapFeeBtc.toString(10),
            expiry: this.expiry,
            version: this.version,
            initiated: this.initiated,
            exactIn: this.exactIn,
            createdAt: this.createdAt,
            randomNonce: this.randomNonce
        };
    }
    _save() {
        if (this.isQuoteExpired()) {
            return this.wrapper.removeSwapData(this);
        }
        else {
            return this.wrapper.saveSwapData(this);
        }
    }
    async _saveAndEmit(state) {
        if (state != null)
            this.state = state;
        await this._save();
        this._emitEvent();
    }
    //////////////////////////////
    //// Events
    _emitEvent() {
        this.wrapper.events.emit("swapState", this);
        this.events.emit("swapState", this);
    }
}
exports.ISwap = ISwap;
