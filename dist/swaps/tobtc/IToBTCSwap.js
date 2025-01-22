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
exports.ToBTCSwapState = exports.IToBTCSwap = exports.isIToBTCSwapInit = void 0;
const ISwap_1 = require("../ISwap");
const BN = require("bn.js");
const base_1 = require("@atomiqlabs/base");
const IntermediaryAPI_1 = require("../../intermediaries/IntermediaryAPI");
const IntermediaryError_1 = require("../../errors/IntermediaryError");
const Utils_1 = require("../../utils/Utils");
const Tokens_1 = require("../Tokens");
function isIToBTCSwapInit(obj) {
    return BN.isBN(obj.networkFee) &&
        (obj.networkFeeBtc == null || BN.isBN(obj.networkFeeBtc)) &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isIToBTCSwapInit = isIToBTCSwapInit;
class IToBTCSwap extends ISwap_1.ISwap {
    constructor(wrapper, initOrObject) {
        super(wrapper, initOrObject);
        if (isIToBTCSwapInit(initOrObject)) {
            this.state = ToBTCSwapState.CREATED;
        }
        else {
            this.networkFee = initOrObject.networkFee == null ? null : new BN(initOrObject.networkFee);
            this.networkFeeBtc = initOrObject.networkFeeBtc == null ? null : new BN(initOrObject.networkFeeBtc);
        }
    }
    upgradeVersion() {
        if (this.version == null) {
            switch (this.state) {
                case -2:
                    this.state = ToBTCSwapState.REFUNDED;
                    break;
                case -1:
                    this.state = ToBTCSwapState.QUOTE_EXPIRED;
                    break;
                case 0:
                    this.state = ToBTCSwapState.CREATED;
                    break;
                case 1:
                    this.state = ToBTCSwapState.COMMITED;
                    break;
                case 2:
                    this.state = ToBTCSwapState.CLAIMED;
                    break;
                case 3:
                    this.state = ToBTCSwapState.REFUNDABLE;
                    break;
            }
            this.version = 1;
        }
    }
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    tryCalculateSwapFee() {
        if (this.swapFeeBtc == null) {
            this.swapFeeBtc = this.swapFee.mul(this.getOutput().rawAmount).div(this.getInputWithoutFee().rawAmount);
        }
        if (this.networkFeeBtc == null) {
            this.networkFeeBtc = this.networkFee.mul(this.getOutput().rawAmount).div(this.getInputWithoutFee().rawAmount);
        }
        if (this.pricingInfo.swapPriceUSatPerToken == null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoSend(this.chainIdentifier, this.getOutput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.data.getAmount(), this.data.getToken());
        }
    }
    //////////////////////////////
    //// Pricing
    refreshPriceData() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pricingInfo == null)
                return null;
            const priceData = yield this.wrapper.prices.isValidAmountSend(this.chainIdentifier, this.getOutput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.data.getAmount(), this.data.getToken());
            this.pricingInfo = priceData;
            return priceData;
        });
    }
    getSwapPrice() {
        return 100000000000000 / this.pricingInfo.swapPriceUSatPerToken.toNumber();
    }
    getMarketPrice() {
        return 100000000000000 / this.pricingInfo.realPriceUSatPerToken.toNumber();
    }
    getRealSwapFeePercentagePPM() {
        const feeWithoutBaseFee = this.swapFeeBtc.sub(this.pricingInfo.satsBaseFee);
        return feeWithoutBaseFee.mul(new BN(1000000)).div(this.getOutput().rawAmount);
    }
    //////////////////////////////
    //// Getters & utils
    /**
     * Returns whether the swap is finished and in its terminal state (this can mean successful, refunded or failed)
     */
    isFinished() {
        return this.state === ToBTCSwapState.CLAIMED || this.state === ToBTCSwapState.REFUNDED || this.state === ToBTCSwapState.QUOTE_EXPIRED;
    }
    isActionable() {
        return this.isRefundable();
    }
    isRefundable() {
        return this.state === ToBTCSwapState.REFUNDABLE || (this.state === ToBTCSwapState.COMMITED && this.wrapper.contract.isExpired(this.getInitiator(), this.data));
    }
    isQuoteExpired() {
        return this.state === ToBTCSwapState.QUOTE_EXPIRED;
    }
    isQuoteSoftExpired() {
        return this.state === ToBTCSwapState.QUOTE_EXPIRED || this.state === ToBTCSwapState.QUOTE_SOFT_EXPIRED;
    }
    isSuccessful() {
        return this.state === ToBTCSwapState.CLAIMED;
    }
    isFailed() {
        return this.state === ToBTCSwapState.REFUNDED;
    }
    /**
     * Checks if the swap can be committed/started
     */
    canCommit() {
        return this.state === ToBTCSwapState.CREATED;
    }
    getInitiator() {
        return this.data.getOfferer();
    }
    //////////////////////////////
    //// Amounts & fees
    getFee() {
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.swapFee.add(this.networkFee), this.wrapper.tokens[this.data.getToken()], this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(this.swapFeeBtc.add(this.networkFeeBtc), this.outputToken, this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc.add(this.networkFeeBtc), abortSignal, preFetchedUsdPrice)
        };
    }
    getSwapFee() {
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.swapFee, this.wrapper.tokens[this.data.getToken()], this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(this.swapFeeBtc, this.outputToken, this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }
    /**
     * Returns network fee for the swap, the fee is represented in source currency & destination currency, but is
     *  paid only once
     */
    getNetworkFee() {
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.networkFee, this.wrapper.tokens[this.data.getToken()], this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(this.networkFeeBtc, this.outputToken, this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(this.networkFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }
    getInputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.data.getAmount().sub(this.swapFee.add(this.networkFee)), this.wrapper.tokens[this.data.getToken()], this.wrapper.prices);
    }
    getInput() {
        return (0, Tokens_1.toTokenAmount)(this.data.getAmount(), this.wrapper.tokens[this.data.getToken()], this.wrapper.prices);
    }
    /**
     * Get the estimated smart chain transaction fee of the refund transaction
     */
    getRefundFee() {
        return this.wrapper.contract.getRefundFee(this.data);
    }
    /**
     * Checks if the intiator/sender has enough balance to go through with the swap
     */
    hasEnoughBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            const [balance, commitFee] = yield Promise.all([
                this.wrapper.contract.getBalance(this.getInitiator(), this.data.getToken(), false),
                this.data.getToken() === this.wrapper.contract.getNativeCurrencyAddress() ? this.getCommitFee() : Promise.resolve(null)
            ]);
            let required = this.data.getAmount();
            if (commitFee != null)
                required = required.add(commitFee);
            return {
                enoughBalance: balance.gte(required),
                balance: (0, Tokens_1.toTokenAmount)(balance, this.wrapper.tokens[this.data.getToken()], this.wrapper.prices),
                required: (0, Tokens_1.toTokenAmount)(required, this.wrapper.tokens[this.data.getToken()], this.wrapper.prices)
            };
        });
    }
    /**
     * Check if the initiator/sender has enough balance to cover the transaction fee for processing the swap
     */
    hasEnoughForTxFees() {
        return __awaiter(this, void 0, void 0, function* () {
            const [balance, commitFee] = yield Promise.all([
                this.wrapper.contract.getBalance(this.getInitiator(), this.wrapper.contract.getNativeCurrencyAddress(), false),
                this.getCommitFee()
            ]);
            return {
                enoughBalance: balance.gte(commitFee),
                balance: (0, Tokens_1.toTokenAmount)(balance, this.wrapper.getNativeToken(), this.wrapper.prices),
                required: (0, Tokens_1.toTokenAmount)(commitFee, this.wrapper.getNativeToken(), this.wrapper.prices)
            };
        });
    }
    //////////////////////////////
    //// Commit
    /**
     * Commits the swap on-chain, initiating the swap
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled on swap creation, if you commit right after quoting, you can skipChecks)`
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    commit(signer, abortSignal, skipChecks) {
        return __awaiter(this, void 0, void 0, function* () {
            this.checkSigner(signer);
            const result = yield this.wrapper.contract.sendAndConfirm(signer, yield this.txsCommit(skipChecks), true, abortSignal);
            this.commitTxId = result[0];
            if (this.state === ToBTCSwapState.CREATED || this.state === ToBTCSwapState.QUOTE_SOFT_EXPIRED) {
                yield this._saveAndEmit(ToBTCSwapState.COMMITED);
            }
            else {
                yield this._save();
            }
            return result[0];
        });
    }
    /**
     * Returns transactions for committing the swap on-chain, initiating the swap
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled on swap creation, if you commit right after quoting, you can use skipChecks=true)
     *
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    txsCommit(skipChecks) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.canCommit())
                throw new Error("Must be in CREATED state!");
            this.initiated = true;
            yield this._saveAndEmit();
            return yield this.wrapper.contract.txsInitPayIn(this.data, this.signatureData, skipChecks, this.feeRate).catch(e => Promise.reject(e instanceof base_1.SignatureVerificationError ? new Error("Request timed out") : e));
        });
    }
    /**
     * Waits till a swap is committed, should be called after sending the commit transactions manually
     *
     * @param abortSignal   AbortSignal
     * @throws {Error} If swap is not in the correct state (must be CREATED)
     */
    waitTillCommited(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === ToBTCSwapState.COMMITED || this.state === ToBTCSwapState.CLAIMED)
                return Promise.resolve();
            if (this.state !== ToBTCSwapState.CREATED && this.state !== ToBTCSwapState.QUOTE_SOFT_EXPIRED)
                throw new Error("Invalid state (not CREATED)");
            const abortController = (0, Utils_1.extendAbortController)(abortSignal);
            const result = yield Promise.race([
                this.watchdogWaitTillCommited(abortController.signal),
                this.waitTillState(ToBTCSwapState.COMMITED, "gte", abortController.signal).then(() => 0)
            ]);
            abortController.abort();
            if (result === 0)
                this.logger.debug("waitTillCommited(): Resolved from state change");
            if (result === true)
                this.logger.debug("waitTillCommited(): Resolved from watchdog - commited");
            if (result === false) {
                this.logger.debug("waitTillCommited(): Resolved from watchdog - signature expiry");
                if (this.state === ToBTCSwapState.QUOTE_SOFT_EXPIRED || this.state === ToBTCSwapState.CREATED) {
                    yield this._saveAndEmit(ToBTCSwapState.QUOTE_EXPIRED);
                }
                return;
            }
            if (this.state === ToBTCSwapState.QUOTE_SOFT_EXPIRED || this.state === ToBTCSwapState.CREATED) {
                yield this._saveAndEmit(ToBTCSwapState.COMMITED);
            }
        });
    }
    //////////////////////////////
    //// Payment
    /**
     * A blocking promise resolving when swap was concluded by the intermediary,
     *  rejecting in case of failure
     *
     * @param abortSignal           Abort signal
     * @param checkIntervalSeconds  How often to poll the intermediary for answer
     *
     * @returns {Promise<boolean>}  Was the payment successful? If not we can refund.
     * @throws {IntermediaryError} If a swap is determined expired by the intermediary, but it is actually still valid
     * @throws {SignatureVerificationError} If the swap should be cooperatively refundable but the intermediary returned
     *  invalid refund signature
     * @throws {Error} When swap expires or if the swap has invalid state (must be COMMITED)
     */
    waitForPayment(abortSignal, checkIntervalSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === ToBTCSwapState.CLAIMED)
                return Promise.resolve(true);
            if (this.state !== ToBTCSwapState.COMMITED && this.state !== ToBTCSwapState.SOFT_CLAIMED)
                throw new Error("Invalid state (not COMMITED)");
            const abortController = (0, Utils_1.extendAbortController)(abortSignal);
            const result = yield Promise.race([
                this.waitTillState(ToBTCSwapState.CLAIMED, "gte", abortController.signal),
                this.waitTillIntermediarySwapProcessed(abortController.signal, checkIntervalSeconds)
            ]);
            abortController.abort();
            if (typeof result !== "object") {
                if (this.state === ToBTCSwapState.REFUNDABLE)
                    throw new Error("Swap expired");
                this.logger.debug("waitTillRefunded(): Resolved from state change");
                return true;
            }
            this.logger.debug("waitTillRefunded(): Resolved from intermediary response");
            switch (result.code) {
                case IntermediaryAPI_1.RefundAuthorizationResponseCodes.PAID:
                    yield this._saveAndEmit();
                    return true;
                case IntermediaryAPI_1.RefundAuthorizationResponseCodes.REFUND_DATA:
                    yield (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.isValidRefundAuthorization(this.data, result.data), null, base_1.SignatureVerificationError, abortSignal);
                    yield this._saveAndEmit(ToBTCSwapState.REFUNDABLE);
                    return false;
                case IntermediaryAPI_1.RefundAuthorizationResponseCodes.EXPIRED:
                    if (this.wrapper.contract.isExpired(this.getInitiator(), this.data))
                        throw new Error("Swap expired");
                    throw new IntermediaryError_1.IntermediaryError("Swap expired");
                case IntermediaryAPI_1.RefundAuthorizationResponseCodes.NOT_FOUND:
                    if (this.state === ToBTCSwapState.CLAIMED)
                        return true;
                    throw new Error("Intermediary swap not found");
            }
        });
    }
    waitTillIntermediarySwapProcessed(abortSignal, checkIntervalSeconds = 5) {
        return __awaiter(this, void 0, void 0, function* () {
            let resp = { code: IntermediaryAPI_1.RefundAuthorizationResponseCodes.PENDING, msg: "" };
            while (!abortSignal.aborted && (resp.code === IntermediaryAPI_1.RefundAuthorizationResponseCodes.PENDING || resp.code === IntermediaryAPI_1.RefundAuthorizationResponseCodes.NOT_FOUND)) {
                resp = yield IntermediaryAPI_1.IntermediaryAPI.getRefundAuthorization(this.url, this.data.getHash(), this.data.getSequence());
                if (resp.code === IntermediaryAPI_1.RefundAuthorizationResponseCodes.PAID) {
                    const validResponse = yield this._setPaymentResult(resp.data, true);
                    if (validResponse) {
                        this.state = ToBTCSwapState.SOFT_CLAIMED;
                    }
                    else {
                        resp = { code: IntermediaryAPI_1.RefundAuthorizationResponseCodes.PENDING, msg: "" };
                    }
                }
                if (resp.code === IntermediaryAPI_1.RefundAuthorizationResponseCodes.PENDING ||
                    resp.code === IntermediaryAPI_1.RefundAuthorizationResponseCodes.NOT_FOUND)
                    yield (0, Utils_1.timeoutPromise)(checkIntervalSeconds * 1000, abortSignal);
            }
            return resp;
        });
    }
    /**
     * Checks whether the swap was already processed by the LP and is either successful (requires proof which is
     *  either a HTLC pre-image for LN swaps or valid txId for on-chain swap) or failed and we can cooperatively
     *  refund.
     *
     * @param save whether to save the data
     * @returns true if swap is processed, false if the swap is still ongoing
     * @private
     */
    checkIntermediarySwapProcessed(save = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === ToBTCSwapState.CREATED || this.state == ToBTCSwapState.QUOTE_EXPIRED)
                return false;
            if (this.isFinished() || this.isRefundable())
                return true;
            //Check if that maybe already concluded according to the LP
            const resp = yield IntermediaryAPI_1.IntermediaryAPI.getRefundAuthorization(this.url, this.data.getHash(), this.data.getSequence());
            switch (resp.code) {
                case IntermediaryAPI_1.RefundAuthorizationResponseCodes.PAID:
                    const processed = yield this._setPaymentResult(resp.data, true);
                    if (processed) {
                        this.state = ToBTCSwapState.SOFT_CLAIMED;
                        if (save)
                            yield this._saveAndEmit();
                    }
                    return processed;
                case IntermediaryAPI_1.RefundAuthorizationResponseCodes.REFUND_DATA:
                    yield (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.isValidRefundAuthorization(this.data, resp.data), null, base_1.SignatureVerificationError);
                    this.state = ToBTCSwapState.REFUNDABLE;
                    if (save)
                        yield this._saveAndEmit();
                    return true;
                default:
                    return false;
            }
        });
    }
    //////////////////////////////
    //// Refund
    /**
     * Refunds the swap if the swap is in refundable state, you can check so with isRefundable()
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal               Abort signal
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    refund(signer, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            this.checkSigner(signer);
            const result = yield this.wrapper.contract.sendAndConfirm(signer, yield this.txsRefund(), true, abortSignal);
            this.refundTxId = result[0];
            yield this._saveAndEmit(ToBTCSwapState.REFUNDED);
            return result[0];
        });
    }
    /**
     * Returns transactions for refunding the swap if the swap is in refundable state, you can check so with isRefundable()
     *
     * @throws {IntermediaryError} If intermediary returns invalid response in case cooperative refund should be used
     * @throws {SignatureVerificationError} If intermediary returned invalid cooperative refund signature
     * @throws {Error} When state is not refundable
     */
    txsRefund() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isRefundable())
                throw new Error("Must be in REFUNDABLE state or expired!");
            if (this.wrapper.contract.isExpired(this.getInitiator(), this.data)) {
                return yield this.wrapper.contract.txsRefund(this.data, true, true);
            }
            else {
                const res = yield IntermediaryAPI_1.IntermediaryAPI.getRefundAuthorization(this.url, this.data.getHash(), this.data.getSequence());
                if (res.code === IntermediaryAPI_1.RefundAuthorizationResponseCodes.REFUND_DATA) {
                    return yield this.wrapper.contract.txsRefundWithAuthorization(this.data, res.data, true, true);
                }
                throw new IntermediaryError_1.IntermediaryError("Invalid intermediary cooperative message returned");
            }
        });
    }
    /**
     * Waits till a swap is refunded, should be called after sending the refund transactions manually
     *
     * @param abortSignal   AbortSignal
     * @throws {Error} When swap is not in a valid state (must be COMMITED)
     * @throws {Error} If we tried to refund but claimer was able to claim first
     */
    waitTillRefunded(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === ToBTCSwapState.REFUNDED)
                return Promise.resolve();
            if (this.state !== ToBTCSwapState.COMMITED && this.state !== ToBTCSwapState.SOFT_CLAIMED)
                throw new Error("Invalid state (not COMMITED)");
            const abortController = new AbortController();
            if (abortSignal != null)
                abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
            const res = yield Promise.race([
                this.watchdogWaitTillResult(abortController.signal),
                this.waitTillState(ToBTCSwapState.REFUNDED, "eq", abortController.signal).then(() => 0),
                this.waitTillState(ToBTCSwapState.CLAIMED, "eq", abortController.signal).then(() => 1),
            ]);
            abortController.abort();
            if (res === 0) {
                this.logger.debug("waitTillRefunded(): Resolved from state change (REFUNDED)");
                return;
            }
            if (res === 1) {
                this.logger.debug("waitTillRefunded(): Resolved from state change (CLAIMED)");
                throw new Error("Tried to refund swap, but claimer claimed it in the meantime!");
            }
            this.logger.debug("waitTillRefunded(): Resolved from watchdog");
            if (res === base_1.SwapCommitStatus.PAID) {
                yield this._saveAndEmit(ToBTCSwapState.CLAIMED);
                throw new Error("Tried to refund swap, but claimer claimed it in the meantime!");
            }
            if (res === base_1.SwapCommitStatus.NOT_COMMITED) {
                yield this._saveAndEmit(ToBTCSwapState.REFUNDED);
            }
        });
    }
    //////////////////////////////
    //// Storage
    serialize() {
        const obj = super.serialize();
        return Object.assign(Object.assign({}, obj), { networkFee: this.networkFee == null ? null : this.networkFee.toString(10), networkFeeBtc: this.networkFeeBtc == null ? null : this.networkFeeBtc.toString(10) });
    }
}
exports.IToBTCSwap = IToBTCSwap;
var ToBTCSwapState;
(function (ToBTCSwapState) {
    ToBTCSwapState[ToBTCSwapState["REFUNDED"] = -3] = "REFUNDED";
    ToBTCSwapState[ToBTCSwapState["QUOTE_EXPIRED"] = -2] = "QUOTE_EXPIRED";
    ToBTCSwapState[ToBTCSwapState["QUOTE_SOFT_EXPIRED"] = -1] = "QUOTE_SOFT_EXPIRED";
    ToBTCSwapState[ToBTCSwapState["CREATED"] = 0] = "CREATED";
    ToBTCSwapState[ToBTCSwapState["COMMITED"] = 1] = "COMMITED";
    ToBTCSwapState[ToBTCSwapState["SOFT_CLAIMED"] = 2] = "SOFT_CLAIMED";
    ToBTCSwapState[ToBTCSwapState["CLAIMED"] = 3] = "CLAIMED";
    ToBTCSwapState[ToBTCSwapState["REFUNDABLE"] = 4] = "REFUNDABLE";
})(ToBTCSwapState = exports.ToBTCSwapState || (exports.ToBTCSwapState = {}));
