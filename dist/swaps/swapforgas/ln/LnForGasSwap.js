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
exports.LnForGasSwap = exports.isLnForGasSwapInit = exports.LnForGasSwapState = void 0;
const bolt11_1 = require("bolt11");
const SwapType_1 = require("../../SwapType");
const BN = require("bn.js");
const buffer_1 = require("buffer");
const PaymentAuthError_1 = require("../../../errors/PaymentAuthError");
const Utils_1 = require("../../../utils/Utils");
const ISwap_1 = require("../../ISwap");
const TrustedIntermediaryAPI_1 = require("../../../intermediaries/TrustedIntermediaryAPI");
const Tokens_1 = require("../../Tokens");
var LnForGasSwapState;
(function (LnForGasSwapState) {
    LnForGasSwapState[LnForGasSwapState["EXPIRED"] = -2] = "EXPIRED";
    LnForGasSwapState[LnForGasSwapState["FAILED"] = -1] = "FAILED";
    LnForGasSwapState[LnForGasSwapState["PR_CREATED"] = 0] = "PR_CREATED";
    LnForGasSwapState[LnForGasSwapState["PR_PAID"] = 1] = "PR_PAID";
    LnForGasSwapState[LnForGasSwapState["FINISHED"] = 2] = "FINISHED";
})(LnForGasSwapState = exports.LnForGasSwapState || (exports.LnForGasSwapState = {}));
function isLnForGasSwapInit(obj) {
    return typeof (obj.pr) === "string" &&
        BN.isBN(obj.outputAmount) &&
        typeof (obj.recipient) === "string" &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isLnForGasSwapInit = isLnForGasSwapInit;
class LnForGasSwap extends ISwap_1.ISwap {
    constructor(wrapper, initOrObj) {
        if (isLnForGasSwapInit(initOrObj))
            initOrObj.url += "/lnforgas";
        super(wrapper, initOrObj);
        this.getSmartChainNetworkFee = null;
        this.currentVersion = 2;
        this.TYPE = SwapType_1.SwapType.TRUSTED_FROM_BTCLN;
        if (isLnForGasSwapInit(initOrObj)) {
            this.state = LnForGasSwapState.PR_CREATED;
        }
        else {
            this.pr = initOrObj.pr;
            this.outputAmount = initOrObj.outputAmount == null ? null : new BN(initOrObj.outputAmount);
            this.recipient = initOrObj.recipient;
            this.scTxId = initOrObj.scTxId;
        }
        this.tryCalculateSwapFee();
        this.logger = (0, Utils_1.getLogger)(this.constructor.name + "(" + this.getIdentifierHashString() + "): ");
        if (this.pricingInfo.swapPriceUSatPerToken == null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(this.chainIdentifier, this.getInput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.data.getAmount(), this.data.getToken());
        }
    }
    upgradeVersion() {
        if (this.version == 1) {
            if (this.state === 1)
                this.state = LnForGasSwapState.FINISHED;
            this.version = 2;
        }
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
        return this.pr;
    }
    getOutputAddress() {
        return this.recipient;
    }
    getInputTxId() {
        return this.getPaymentHash().toString("hex");
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
        if (this.pr == null)
            return null;
        const decodedPR = (0, bolt11_1.decode)(this.pr);
        return buffer_1.Buffer.from(decodedPR.tagsObject.payment_hash, "hex");
    }
    /**
     * Returns the lightning network BOLT11 invoice that needs to be paid as an input to the swap
     */
    getLightningInvoice() {
        return this.pr;
    }
    /**
     * Returns a string that can be displayed as QR code representation of the lightning invoice (with lightning: prefix)
     */
    getQrData() {
        return "lightning:" + this.pr.toUpperCase();
    }
    getTimeoutTime() {
        if (this.pr == null)
            return null;
        const decoded = (0, bolt11_1.decode)(this.pr);
        return (decoded.timeExpireDate * 1000);
    }
    isFinished() {
        return this.state === LnForGasSwapState.FINISHED || this.state === LnForGasSwapState.FAILED || this.state === LnForGasSwapState.EXPIRED;
    }
    isQuoteExpired() {
        return this.state === LnForGasSwapState.EXPIRED;
    }
    isQuoteSoftExpired() {
        return this.getTimeoutTime() < Date.now();
    }
    isFailed() {
        return this.state === LnForGasSwapState.FAILED;
    }
    isSuccessful() {
        return this.state === LnForGasSwapState.FINISHED;
    }
    isQuoteValid() {
        return Promise.resolve(this.getTimeoutTime() > Date.now());
    }
    isActionable() {
        return false;
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
        const parsed = (0, bolt11_1.decode)(this.pr);
        const amount = new BN(parsed.millisatoshis).add(new BN(999)).div(new BN(1000));
        return (0, Tokens_1.toTokenAmount)(amount.sub(this.swapFeeBtc), Tokens_1.BitcoinTokens.BTCLN, this.wrapper.prices);
    }
    getInput() {
        const parsed = (0, bolt11_1.decode)(this.pr);
        const amount = new BN(parsed.millisatoshis).add(new BN(999)).div(new BN(1000));
        return (0, Tokens_1.toTokenAmount)(amount, Tokens_1.BitcoinTokens.BTCLN, this.wrapper.prices);
    }
    getSwapFee() {
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.swapFeeBtc, Tokens_1.BitcoinTokens.BTCLN, this.wrapper.prices),
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
    checkInvoicePaid(save = true) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state === LnForGasSwapState.FAILED || this.state === LnForGasSwapState.EXPIRED)
                return false;
            if (this.state === LnForGasSwapState.FINISHED)
                return true;
            const decodedPR = (0, bolt11_1.decode)(this.pr);
            const paymentHash = decodedPR.tagsObject.payment_hash;
            const response = yield TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.getInvoiceStatus(this.url, paymentHash, this.wrapper.options.getRequestTimeout);
            this.logger.debug("checkInvoicePaid(): LP response: ", response);
            switch (response.code) {
                case TrustedIntermediaryAPI_1.InvoiceStatusResponseCodes.PAID:
                    this.scTxId = response.data.txId;
                    const txStatus = yield this.wrapper.contract.getTxIdStatus(this.scTxId);
                    if (txStatus === "success") {
                        this.state = LnForGasSwapState.FINISHED;
                        if (save)
                            yield this._saveAndEmit();
                        return true;
                    }
                    return null;
                case TrustedIntermediaryAPI_1.InvoiceStatusResponseCodes.EXPIRED:
                    if (this.state === LnForGasSwapState.PR_CREATED) {
                        this.state = LnForGasSwapState.EXPIRED;
                    }
                    else {
                        this.state = LnForGasSwapState.FAILED;
                    }
                    if (save)
                        yield this._saveAndEmit();
                    return false;
                case TrustedIntermediaryAPI_1.InvoiceStatusResponseCodes.TX_SENT:
                    this.scTxId = response.data.txId;
                    if (this.state === LnForGasSwapState.PR_CREATED) {
                        this.state = LnForGasSwapState.PR_PAID;
                        if (save)
                            yield this._saveAndEmit();
                    }
                    return null;
                case TrustedIntermediaryAPI_1.InvoiceStatusResponseCodes.PENDING:
                    if (this.state === LnForGasSwapState.PR_CREATED) {
                        this.state = LnForGasSwapState.PR_PAID;
                        if (save)
                            yield this._saveAndEmit();
                    }
                    return null;
                case TrustedIntermediaryAPI_1.InvoiceStatusResponseCodes.AWAIT_PAYMENT:
                    return null;
                default:
                    this.state = LnForGasSwapState.FAILED;
                    if (save)
                        yield this._saveAndEmit();
                    return false;
            }
        });
    }
    /**
     * A blocking promise resolving when payment was received by the intermediary and client can continue
     * rejecting in case of failure
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    waitForPayment(abortSignal, checkIntervalSeconds = 5) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.state !== LnForGasSwapState.PR_CREATED)
                throw new Error("Must be in PR_CREATED state!");
            if (!this.initiated) {
                this.initiated = true;
                yield this._saveAndEmit();
            }
            while (!abortSignal.aborted && (this.state === LnForGasSwapState.PR_CREATED || this.state === LnForGasSwapState.PR_PAID)) {
                yield this.checkInvoicePaid(true);
                if (this.state === LnForGasSwapState.PR_CREATED || this.state === LnForGasSwapState.PR_PAID)
                    yield (0, Utils_1.timeoutPromise)(checkIntervalSeconds * 1000, abortSignal);
            }
            if (this.isFailed())
                throw new PaymentAuthError_1.PaymentAuthError("Swap failed");
            if (this.isQuoteExpired())
                throw new PaymentAuthError_1.PaymentAuthError("Swap expired");
        });
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return Object.assign(Object.assign({}, super.serialize()), { pr: this.pr, outputAmount: this.outputAmount == null ? null : this.outputAmount.toString(10), recipient: this.recipient, scTxId: this.scTxId });
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
exports.LnForGasSwap = LnForGasSwap;
