"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISwap = exports.isISwapInit = void 0;
const SwapType_1 = require("./enums/SwapType");
const events_1 = require("events");
const buffer_1 = require("buffer");
const base_1 = require("@atomiqlabs/base");
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
        obj.feeRate != null &&
        (obj.signatureData == null || (typeof (obj.signatureData) === 'object' &&
            typeof (obj.signatureData.prefix) === "string" &&
            typeof (obj.signatureData.timeout) === "string" &&
            typeof (obj.signatureData.signature) === "string")) &&
        (obj.data == null || typeof obj.data === 'object') &&
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
            this.data = swapInitOrObj.data != null ? new wrapper.swapDataDeserializer(swapInitOrObj.data) : null;
            this.swapFee = swapInitOrObj.swapFee == null ? null : BigInt(swapInitOrObj.swapFee);
            this.swapFeeBtc = swapInitOrObj.swapFeeBtc == null ? null : BigInt(swapInitOrObj.swapFeeBtc);
            this.signatureData = swapInitOrObj.signature == null ? null : {
                prefix: swapInitOrObj.prefix,
                timeout: swapInitOrObj.timeout,
                signature: swapInitOrObj.signature
            };
            this.feeRate = swapInitOrObj.feeRate;
            this.commitTxId = swapInitOrObj.commitTxId;
            this.claimTxId = swapInitOrObj.claimTxId;
            this.refundTxId = swapInitOrObj.refundTxId;
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
     * Periodically checks for init signature's expiry
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    async watchdogWaitTillSignatureExpiry(abortSignal, interval = 5) {
        let expired = false;
        while (!expired) {
            await (0, Utils_1.timeoutPromise)(interval * 1000, abortSignal);
            try {
                expired = await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData);
            }
            catch (e) {
                this.logger.warn("watchdogWaitTillSignatureExpiry(): Error when checking signature expiry: ", e);
            }
        }
        if (abortSignal != null)
            abortSignal.throwIfAborted();
    }
    /**
     * Periodically checks the chain to see whether the swap is committed
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    async watchdogWaitTillCommited(abortSignal, interval = 5) {
        let status = base_1.SwapCommitStatus.NOT_COMMITED;
        while (status === base_1.SwapCommitStatus.NOT_COMMITED) {
            await (0, Utils_1.timeoutPromise)(interval * 1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data);
                if (status === base_1.SwapCommitStatus.NOT_COMMITED &&
                    await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData))
                    return false;
            }
            catch (e) {
                this.logger.warn("watchdogWaitTillCommited(): Error when fetching commit status or signature expiry: ", e);
            }
        }
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        return true;
    }
    /**
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    async watchdogWaitTillResult(abortSignal, interval = 5) {
        let status = base_1.SwapCommitStatus.COMMITED;
        while (status === base_1.SwapCommitStatus.COMMITED || status === base_1.SwapCommitStatus.REFUNDABLE) {
            await (0, Utils_1.timeoutPromise)(interval * 1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data);
            }
            catch (e) {
                this.logger.warn("watchdogWaitTillResult(): Error when fetching commit status: ", e);
            }
        }
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        return status;
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
     * Returns the escrow hash - i.e. hash of the escrow data
     */
    getEscrowHash() {
        return this.data?.getEscrowHash();
    }
    /**
     * Returns the claim data hash - i.e. hash passed to the claim handler
     */
    getClaimHash() {
        return this.data?.getClaimHash();
    }
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHash() {
        const claimHashBuffer = buffer_1.Buffer.from(this.getClaimHash(), "hex");
        if (this.randomNonce == null)
            return claimHashBuffer;
        return buffer_1.Buffer.concat([claimHashBuffer, buffer_1.Buffer.from(this.randomNonce, "hex")]);
    }
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHashString() {
        const paymentHash = this.getIdentifierHash();
        if (paymentHash == null)
            return null;
        return paymentHash.toString("hex");
    }
    /**
     * Returns the ID of the swap, as used in the storage and getSwapById function
     */
    getId() {
        return this.getIdentifierHashString();
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
        return this.TYPE === SwapType_1.SwapType.FROM_BTCLN || this.TYPE === SwapType_1.SwapType.FROM_BTC ? SwapDirection_1.SwapDirection.FROM_BTC : SwapDirection_1.SwapDirection.TO_BTC;
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
    /**
     * Checks if the swap's quote is still valid
     */
    async isQuoteValid() {
        try {
            await (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.isValidInitAuthorization(this.data, this.signatureData, this.feeRate), null, base_1.SignatureVerificationError);
            return true;
        }
        catch (e) {
            if (e instanceof base_1.SignatureVerificationError) {
                return false;
            }
            throw e;
        }
    }
    /**
     * Checks if the swap's quote is expired for good (i.e. the swap strictly cannot be committed on-chain anymore)
     */
    async isQuoteDefinitelyExpired() {
        return (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData));
    }
    isInitiated() {
        return this.initiated;
    }
    //////////////////////////////
    //// Amounts & fees
    /**
     * Get the estimated smart chain fee of the commit transaction
     */
    getCommitFee() {
        return this.wrapper.contract.getCommitFee(this.data, this.feeRate);
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
        const swapContract = this.wrapper.contract;
        return (0, Tokens_1.toTokenAmount)(await (swapContract.getRawCommitFee != null ?
            swapContract.getRawCommitFee(this.data, this.feeRate) :
            swapContract.getCommitFee(this.data, this.feeRate)), this.wrapper.getNativeToken(), this.wrapper.prices);
    }
    //////////////////////////////
    //// Storage
    serialize() {
        if (this.pricingInfo == null)
            return {};
        return {
            id: this.getIdentifierHashString(),
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
            data: this.data != null ? this.data.serialize() : null,
            swapFee: this.swapFee == null ? null : this.swapFee.toString(10),
            swapFeeBtc: this.swapFeeBtc == null ? null : this.swapFeeBtc.toString(10),
            prefix: this.signatureData?.prefix,
            timeout: this.signatureData?.timeout,
            signature: this.signatureData?.signature,
            feeRate: this.feeRate == null ? null : this.feeRate.toString(),
            commitTxId: this.commitTxId,
            claimTxId: this.claimTxId,
            refundTxId: this.refundTxId,
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
