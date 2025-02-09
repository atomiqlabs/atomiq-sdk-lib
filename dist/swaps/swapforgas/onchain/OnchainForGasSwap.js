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
exports.OnchainForGasSwap = exports.isOnchainForGasSwapInit = exports.OnchainForGasSwapState = void 0;
const SwapType_1 = require("../../SwapType");
const BN = require("bn.js");
const buffer_1 = require("buffer");
const PaymentAuthError_1 = require("../../../errors/PaymentAuthError");
const Utils_1 = require("../../../utils/Utils");
const ISwap_1 = require("../../ISwap");
const TrustedIntermediaryAPI_1 = require("../../../intermediaries/TrustedIntermediaryAPI");
const Tokens_1 = require("../../Tokens");
var OnchainForGasSwapState;
(function (OnchainForGasSwapState) {
    OnchainForGasSwapState[OnchainForGasSwapState["EXPIRED"] = -3] = "EXPIRED";
    OnchainForGasSwapState[OnchainForGasSwapState["FAILED"] = -2] = "FAILED";
    OnchainForGasSwapState[OnchainForGasSwapState["REFUNDED"] = -1] = "REFUNDED";
    OnchainForGasSwapState[OnchainForGasSwapState["PR_CREATED"] = 0] = "PR_CREATED";
    OnchainForGasSwapState[OnchainForGasSwapState["FINISHED"] = 1] = "FINISHED";
    OnchainForGasSwapState[OnchainForGasSwapState["REFUNDABLE"] = 2] = "REFUNDABLE";
})(OnchainForGasSwapState = exports.OnchainForGasSwapState || (exports.OnchainForGasSwapState = {}));
function isOnchainForGasSwapInit(obj) {
    return typeof (obj.paymentHash) === "string" &&
        BN.isBN(obj.sequence) &&
        typeof (obj.address) === "string" &&
        BN.isBN(obj.inputAmount) &&
        BN.isBN(obj.outputAmount) &&
        typeof (obj.recipient) === "string" &&
        (obj.refundAddress == null || typeof (obj.refundAddress) === "string") &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isOnchainForGasSwapInit = isOnchainForGasSwapInit;
class OnchainForGasSwap extends ISwap_1.ISwap {
    constructor(wrapper, initOrObj) {
        if (isOnchainForGasSwapInit(initOrObj))
            initOrObj.url += "/frombtc_trusted";
        super(wrapper, initOrObj);
        this.TYPE = SwapType_1.SwapType.TRUSTED_FROM_BTC;
        if (isOnchainForGasSwapInit(initOrObj)) {
            this.state = OnchainForGasSwapState.PR_CREATED;
        }
        else {
            this.paymentHash = initOrObj.paymentHash;
            this.sequence = initOrObj.sequence == null ? null : new BN(initOrObj.sequence);
            this.address = initOrObj.address;
            this.inputAmount = initOrObj.inputAmount == null ? null : new BN(initOrObj.inputAmount);
            this.outputAmount = initOrObj.outputAmount == null ? null : new BN(initOrObj.outputAmount);
            this.recipient = initOrObj.recipient;
            this.refundAddress = initOrObj.refundAddress;
            this.scTxId = initOrObj.scTxId;
            this.txId = initOrObj.txId;
            this.refundTxId = initOrObj.refundTxId;
        }
        this.tryCalculateSwapFee();
        this.logger = (0, Utils_1.getLogger)(this.constructor.name + "(" + this.getIdentifierHashString() + "): ");
        if (this.pricingInfo.swapPriceUSatPerToken == null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(this.chainIdentifier, this.getInput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.data.getAmount(), this.data.getToken());
        }
    }
    upgradeVersion() {
        if (this.version == null) {
            //Noop
            this.version = 1;
        }
    }
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    tryCalculateSwapFee() {
        if (this.swapFeeBtc == null) {
            this.swapFeeBtc = this.swapFee.mul(this.getInput().rawAmount).div(this.getOutAmountWithoutFee());
        }
    }
    //////////////////////////////
    //// Pricing
    refreshPriceData() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pricingInfo == null)
                return null;
            const priceData = yield this.wrapper.prices.isValidAmountReceive(this.chainIdentifier, this.getInput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.data.getAmount(), this.data.getToken());
            this.pricingInfo = priceData;
            return priceData;
        });
    }
    getSwapPrice() {
        return this.pricingInfo.swapPriceUSatPerToken.toNumber() / 100000000000000;
    }
    getMarketPrice() {
        return this.pricingInfo.realPriceUSatPerToken.toNumber() / 100000000000000;
    }
    //////////////////////////////
    //// Getters & utils
    getInputAddress() {
        return this.address;
    }
    getOutputAddress() {
        return this.recipient;
    }
    getInputTxId() {
        return this.txId;
    }
    getOutputTxId() {
        return this.scTxId;
    }
    getRecipient() {
        return this.recipient;
    }
    getIdentifierHash() {
        return this.getPaymentHash();
    }
    getPaymentHash() {
        return buffer_1.Buffer.from(this.paymentHash, "hex");
    }
    getAddress() {
        return this.address;
    }
    /**
     * Returns bitcoin address where the on-chain BTC should be sent to
     */
    getBitcoinAddress() {
        return this.address;
    }
    getQrData() {
        return "bitcoin:" + this.address + "?amount=" + encodeURIComponent((this.inputAmount.toNumber() / 100000000).toString(10));
    }
    getTimeoutTime() {
        return this.expiry;
    }
    isFinished() {
        return this.state === OnchainForGasSwapState.FINISHED || this.state === OnchainForGasSwapState.FAILED || this.state === OnchainForGasSwapState.EXPIRED || this.state === OnchainForGasSwapState.REFUNDED;
    }
    isQuoteExpired() {
        return this.state === OnchainForGasSwapState.EXPIRED;
    }
    isQuoteSoftExpired() {
        return this.expiry < Date.now();
    }
    isFailed() {
        return this.state === OnchainForGasSwapState.FAILED;
    }
    isSuccessful() {
        return this.state === OnchainForGasSwapState.FINISHED;
    }
    isQuoteValid() {
        return Promise.resolve(this.getTimeoutTime() > Date.now());
    }
    isActionable() {
        return this.state === OnchainForGasSwapState.REFUNDABLE;
    }
    //////////////////////////////
    //// Amounts & fees
    getOutAmountWithoutFee() {
        return this.outputAmount.add(this.swapFee);
    }
    getOutput() {
        return (0, Tokens_1.toTokenAmount)(this.outputAmount, this.wrapper.tokens[this.wrapper.contract.getNativeCurrencyAddress()], this.wrapper.prices);
    }
    getInputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.inputAmount.sub(this.swapFeeBtc), Tokens_1.BitcoinTokens.BTC, this.wrapper.prices);
    }
    getInput() {
        return (0, Tokens_1.toTokenAmount)(this.inputAmount, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices);
    }
    getSwapFee() {
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.swapFeeBtc, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(this.swapFee, this.wrapper.tokens[this.wrapper.contract.getNativeCurrencyAddress()], this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }
    getRealSwapFeePercentagePPM() {
        const feeWithoutBaseFee = this.swapFeeBtc.sub(this.pricingInfo.satsBaseFee);
        return feeWithoutBaseFee.mul(new BN(1000000)).div(this.getInputWithoutFee().rawAmount);
    }
    //////////////////////////////
    //// Payment
    checkAddress(save = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === OnchainForGasSwapState.FAILED ||
                this.state === OnchainForGasSwapState.EXPIRED ||
                this.state === OnchainForGasSwapState.REFUNDED)
                return false;
            if (this.state === OnchainForGasSwapState.FINISHED)
                return false;
            const response = yield TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.getAddressStatus(this.url, this.paymentHash, this.sequence, this.wrapper.options.getRequestTimeout);
            switch (response.code) {
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.AWAIT_PAYMENT:
                    if (this.txId != null) {
                        this.txId = null;
                        if (save)
                            yield this._save();
                        return true;
                    }
                    return false;
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.AWAIT_CONFIRMATION:
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.PENDING:
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.TX_SENT:
                    const inputAmount = new BN(response.data.adjustedAmount, 10);
                    const outputAmount = new BN(response.data.adjustedTotal, 10);
                    const adjustedFee = response.data.adjustedFee == null ? null : new BN(response.data.adjustedFee, 10);
                    const adjustedFeeSats = response.data.adjustedFeeSats == null ? null : new BN(response.data.adjustedFeeSats, 10);
                    const txId = response.data.txId;
                    if (this.txId != txId ||
                        !this.inputAmount.eq(inputAmount) ||
                        !this.outputAmount.eq(outputAmount)) {
                        this.txId = txId;
                        this.inputAmount = inputAmount;
                        this.outputAmount = outputAmount;
                        if (adjustedFee != null)
                            this.swapFee = adjustedFee;
                        if (adjustedFeeSats != null)
                            this.swapFeeBtc = adjustedFeeSats;
                        if (save)
                            yield this._save();
                        return true;
                    }
                    return false;
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.PAID:
                    const txStatus = yield this.wrapper.contract.getTxIdStatus(response.data.txId);
                    if (txStatus === "success") {
                        this.state = OnchainForGasSwapState.FINISHED;
                        this.scTxId = response.data.txId;
                        if (save)
                            yield this._saveAndEmit();
                        return true;
                    }
                    return false;
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.EXPIRED:
                    this.state = OnchainForGasSwapState.EXPIRED;
                    if (save)
                        yield this._saveAndEmit();
                    return true;
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.REFUNDABLE:
                    if (this.state === OnchainForGasSwapState.REFUNDABLE)
                        return null;
                    this.state = OnchainForGasSwapState.REFUNDABLE;
                    if (save)
                        yield this._saveAndEmit();
                    return true;
                case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.REFUNDED:
                    this.state = OnchainForGasSwapState.REFUNDED;
                    this.refundTxId = response.data.txId;
                    if (save)
                        yield this._saveAndEmit();
                    return true;
                default:
                    this.state = OnchainForGasSwapState.FAILED;
                    if (save)
                        yield this._saveAndEmit();
                    return true;
            }
        });
    }
    /**
     * A blocking promise resolving when payment was received by the intermediary and client can continue
     * rejecting in case of failure
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    waitForPayment(abortSignal, checkIntervalSeconds = 5, updateCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state !== OnchainForGasSwapState.PR_CREATED)
                throw new Error("Must be in PR_CREATED state!");
            if (!this.initiated) {
                this.initiated = true;
                yield this._saveAndEmit();
            }
            while (!abortSignal.aborted &&
                this.state === OnchainForGasSwapState.PR_CREATED) {
                yield this.checkAddress(true);
                if (this.txId != null && updateCallback != null) {
                    const res = yield this.wrapper.btcRpc.getTransaction(this.txId);
                    if (res == null) {
                        updateCallback(null, null);
                    }
                    else if (res.confirmations > 0) {
                        updateCallback(res.txid, 0);
                    }
                    else {
                        const delay = yield this.wrapper.btcRpc.getConfirmationDelay(res, 1);
                        updateCallback(res.txid, delay);
                    }
                }
                if (this.state === OnchainForGasSwapState.PR_CREATED)
                    yield (0, Utils_1.timeoutPromise)(checkIntervalSeconds * 1000, abortSignal);
            }
            if (this.state === OnchainForGasSwapState.REFUNDABLE ||
                this.state === OnchainForGasSwapState.REFUNDED)
                return false;
            if (this.isQuoteExpired())
                throw new PaymentAuthError_1.PaymentAuthError("Swap expired");
            if (this.isFailed())
                throw new PaymentAuthError_1.PaymentAuthError("Swap failed");
            return true;
        });
    }
    waitTillRefunded(abortSignal, checkIntervalSeconds = 5) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === OnchainForGasSwapState.REFUNDED)
                return;
            if (this.state !== OnchainForGasSwapState.REFUNDABLE)
                throw new Error("Must be in REFUNDABLE state!");
            while (!abortSignal.aborted &&
                this.state === OnchainForGasSwapState.REFUNDABLE) {
                yield this.checkAddress(true);
                if (this.state === OnchainForGasSwapState.REFUNDABLE)
                    yield (0, Utils_1.timeoutPromise)(checkIntervalSeconds * 1000, abortSignal);
            }
            if (this.isQuoteExpired())
                throw new PaymentAuthError_1.PaymentAuthError("Swap expired");
            if (this.isFailed())
                throw new PaymentAuthError_1.PaymentAuthError("Swap failed");
        });
    }
    setRefundAddress(refundAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.refundAddress != null) {
                if (this.refundAddress !== refundAddress)
                    throw new Error("Different refund address already set!");
                return;
            }
            yield TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.setRefundAddress(this.url, this.paymentHash, this.sequence, refundAddress, this.wrapper.options.getRequestTimeout);
            this.refundAddress = refundAddress;
        });
    }
    requestRefund(refundAddress, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (refundAddress != null)
                yield this.setRefundAddress(refundAddress);
            yield this.waitTillRefunded(abortSignal);
        });
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return Object.assign(Object.assign({}, super.serialize()), { paymentHash: this.paymentHash, sequence: this.sequence == null ? null : this.sequence.toString(10), address: this.address, inputAmount: this.inputAmount == null ? null : this.inputAmount.toString(10), outputAmount: this.outputAmount == null ? null : this.outputAmount.toString(10), recipient: this.recipient, refundAddress: this.refundAddress, scTxId: this.scTxId, txId: this.txId, refundTxId: this.refundTxId });
    }
    getInitiator() {
        return this.recipient;
    }
    hasEnoughForTxFees() {
        return Promise.resolve({
            balance: (0, Tokens_1.toTokenAmount)(new BN(0), this.wrapper.getNativeToken(), this.wrapper.prices),
            enoughBalance: true,
            required: (0, Tokens_1.toTokenAmount)(new BN(0), this.wrapper.getNativeToken(), this.wrapper.prices)
        });
    }
}
exports.OnchainForGasSwap = OnchainForGasSwap;
