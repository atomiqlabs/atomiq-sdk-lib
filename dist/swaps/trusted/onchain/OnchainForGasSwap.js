"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnchainForGasSwap = exports.isOnchainForGasSwapInit = exports.OnchainForGasSwapState = void 0;
const SwapType_1 = require("../../enums/SwapType");
const PaymentAuthError_1 = require("../../../errors/PaymentAuthError");
const Utils_1 = require("../../../utils/Utils");
const ISwap_1 = require("../../ISwap");
const TrustedIntermediaryAPI_1 = require("../../../intermediaries/TrustedIntermediaryAPI");
const Tokens_1 = require("../../../Tokens");
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
        typeof (obj.sequence) === "bigint" &&
        typeof (obj.address) === "string" &&
        typeof (obj.inputAmount) === "bigint" &&
        typeof (obj.outputAmount) === "bigint" &&
        typeof (obj.recipient) === "string" &&
        typeof (obj.token) === "string" &&
        (obj.refundAddress == null || typeof (obj.refundAddress) === "string") &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isOnchainForGasSwapInit = isOnchainForGasSwapInit;
class OnchainForGasSwap extends ISwap_1.ISwap {
    constructor(wrapper, initOrObj) {
        if (isOnchainForGasSwapInit(initOrObj))
            initOrObj.url += "/frombtc_trusted";
        super(wrapper, initOrObj);
        this.getSmartChainNetworkFee = null;
        this.TYPE = SwapType_1.SwapType.TRUSTED_FROM_BTC;
        if (isOnchainForGasSwapInit(initOrObj)) {
            this.state = OnchainForGasSwapState.PR_CREATED;
        }
        else {
            this.paymentHash = initOrObj.paymentHash;
            this.sequence = initOrObj.sequence == null ? null : BigInt(initOrObj.sequence);
            this.address = initOrObj.address;
            this.inputAmount = initOrObj.inputAmount == null ? null : BigInt(initOrObj.inputAmount);
            this.outputAmount = initOrObj.outputAmount == null ? null : BigInt(initOrObj.outputAmount);
            this.recipient = initOrObj.recipient;
            this.token = initOrObj.token;
            this.refundAddress = initOrObj.refundAddress;
            this.scTxId = initOrObj.scTxId;
            this.txId = initOrObj.txId;
            this.refundTxId = initOrObj.refundTxId;
        }
        this.logger = (0, Utils_1.getLogger)("OnchainForGas(" + this.getId() + "): ");
        this.tryCalculateSwapFee();
        if (this.pricingInfo.swapPriceUSatPerToken == null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(this.chainIdentifier, this.inputAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.outputAmount, this.token ?? this.wrapper.getNativeToken().address);
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
            this.swapFeeBtc = this.swapFee * this.getInput().rawAmount / this.getOutAmountWithoutFee();
        }
    }
    //////////////////////////////
    //// Pricing
    async refreshPriceData() {
        if (this.pricingInfo == null)
            return null;
        const priceData = await this.wrapper.prices.isValidAmountReceive(this.chainIdentifier, this.inputAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.outputAmount, this.token ?? this.wrapper.getNativeToken().address);
        this.pricingInfo = priceData;
        return priceData;
    }
    getSwapPrice() {
        return Number(this.pricingInfo.swapPriceUSatPerToken) / 100000000000000;
    }
    getMarketPrice() {
        return Number(this.pricingInfo.realPriceUSatPerToken) / 100000000000000;
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
    getEscrowHash() {
        return this.paymentHash;
    }
    getId() {
        return this.paymentHash;
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
        return "bitcoin:" + this.address + "?amount=" + encodeURIComponent((Number(this.inputAmount) / 100000000).toString(10));
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
        return this.outputAmount + this.swapFee;
    }
    getOutput() {
        return (0, Tokens_1.toTokenAmount)(this.outputAmount, this.wrapper.tokens[this.wrapper.chain.getNativeCurrencyAddress()], this.wrapper.prices);
    }
    getInputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.inputAmount - this.swapFeeBtc, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices);
    }
    getInput() {
        return (0, Tokens_1.toTokenAmount)(this.inputAmount, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices);
    }
    getSwapFee() {
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.swapFeeBtc, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(this.swapFee, this.wrapper.tokens[this.wrapper.chain.getNativeCurrencyAddress()], this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }
    getRealSwapFeePercentagePPM() {
        const feeWithoutBaseFee = this.swapFeeBtc - this.pricingInfo.satsBaseFee;
        return feeWithoutBaseFee * 1000000n / this.getInputWithoutFee().rawAmount;
    }
    //////////////////////////////
    //// Payment
    async checkAddress(save = true) {
        if (this.state === OnchainForGasSwapState.FAILED ||
            this.state === OnchainForGasSwapState.EXPIRED ||
            this.state === OnchainForGasSwapState.REFUNDED)
            return false;
        if (this.state === OnchainForGasSwapState.FINISHED)
            return false;
        const response = await TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.getAddressStatus(this.url, this.paymentHash, this.sequence, this.wrapper.options.getRequestTimeout);
        switch (response.code) {
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.AWAIT_PAYMENT:
                if (this.txId != null) {
                    this.txId = null;
                    if (save)
                        await this._save();
                    return true;
                }
                return false;
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.AWAIT_CONFIRMATION:
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.PENDING:
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.TX_SENT:
                const inputAmount = BigInt(response.data.adjustedAmount);
                const outputAmount = BigInt(response.data.adjustedTotal);
                const adjustedFee = response.data.adjustedFee == null ? null : BigInt(response.data.adjustedFee);
                const adjustedFeeSats = response.data.adjustedFeeSats == null ? null : BigInt(response.data.adjustedFeeSats);
                const txId = response.data.txId;
                if (this.txId != txId ||
                    this.inputAmount !== inputAmount ||
                    this.outputAmount !== outputAmount) {
                    this.txId = txId;
                    this.inputAmount = inputAmount;
                    this.outputAmount = outputAmount;
                    if (adjustedFee != null)
                        this.swapFee = adjustedFee;
                    if (adjustedFeeSats != null)
                        this.swapFeeBtc = adjustedFeeSats;
                    if (save)
                        await this._save();
                    return true;
                }
                return false;
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.PAID:
                const txStatus = await this.wrapper.chain.getTxIdStatus(response.data.txId);
                if (txStatus === "success") {
                    this.state = OnchainForGasSwapState.FINISHED;
                    this.scTxId = response.data.txId;
                    if (save)
                        await this._saveAndEmit();
                    return true;
                }
                return false;
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.EXPIRED:
                this.state = OnchainForGasSwapState.EXPIRED;
                if (save)
                    await this._saveAndEmit();
                return true;
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.REFUNDABLE:
                if (this.state === OnchainForGasSwapState.REFUNDABLE)
                    return null;
                this.state = OnchainForGasSwapState.REFUNDABLE;
                if (save)
                    await this._saveAndEmit();
                return true;
            case TrustedIntermediaryAPI_1.AddressStatusResponseCodes.REFUNDED:
                this.state = OnchainForGasSwapState.REFUNDED;
                this.refundTxId = response.data.txId;
                if (save)
                    await this._saveAndEmit();
                return true;
            default:
                this.state = OnchainForGasSwapState.FAILED;
                if (save)
                    await this._saveAndEmit();
                return true;
        }
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
    async waitForPayment(abortSignal, checkIntervalSeconds = 5, updateCallback) {
        if (this.state !== OnchainForGasSwapState.PR_CREATED)
            throw new Error("Must be in PR_CREATED state!");
        if (!this.initiated) {
            this.initiated = true;
            await this._saveAndEmit();
        }
        while (!abortSignal.aborted &&
            this.state === OnchainForGasSwapState.PR_CREATED) {
            await this.checkAddress(true);
            if (this.txId != null && updateCallback != null) {
                const res = await this.wrapper.btcRpc.getTransaction(this.txId);
                if (res == null) {
                    updateCallback(null, null);
                }
                else if (res.confirmations > 0) {
                    updateCallback(res.txid, 0);
                }
                else {
                    const delay = await this.wrapper.btcRpc.getConfirmationDelay(res, 1);
                    updateCallback(res.txid, delay);
                }
            }
            if (this.state === OnchainForGasSwapState.PR_CREATED)
                await (0, Utils_1.timeoutPromise)(checkIntervalSeconds * 1000, abortSignal);
        }
        if (this.state === OnchainForGasSwapState.REFUNDABLE ||
            this.state === OnchainForGasSwapState.REFUNDED)
            return false;
        if (this.isQuoteExpired())
            throw new PaymentAuthError_1.PaymentAuthError("Swap expired");
        if (this.isFailed())
            throw new PaymentAuthError_1.PaymentAuthError("Swap failed");
        return true;
    }
    async waitTillRefunded(abortSignal, checkIntervalSeconds = 5) {
        if (this.state === OnchainForGasSwapState.REFUNDED)
            return;
        if (this.state !== OnchainForGasSwapState.REFUNDABLE)
            throw new Error("Must be in REFUNDABLE state!");
        while (!abortSignal.aborted &&
            this.state === OnchainForGasSwapState.REFUNDABLE) {
            await this.checkAddress(true);
            if (this.state === OnchainForGasSwapState.REFUNDABLE)
                await (0, Utils_1.timeoutPromise)(checkIntervalSeconds * 1000, abortSignal);
        }
        if (this.isQuoteExpired())
            throw new PaymentAuthError_1.PaymentAuthError("Swap expired");
        if (this.isFailed())
            throw new PaymentAuthError_1.PaymentAuthError("Swap failed");
    }
    async setRefundAddress(refundAddress) {
        if (this.refundAddress != null) {
            if (this.refundAddress !== refundAddress)
                throw new Error("Different refund address already set!");
            return;
        }
        await TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.setRefundAddress(this.url, this.paymentHash, this.sequence, refundAddress, this.wrapper.options.getRequestTimeout);
        this.refundAddress = refundAddress;
    }
    async requestRefund(refundAddress, abortSignal) {
        if (refundAddress != null)
            await this.setRefundAddress(refundAddress);
        await this.waitTillRefunded(abortSignal);
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return {
            ...super.serialize(),
            paymentHash: this.paymentHash,
            sequence: this.sequence == null ? null : this.sequence.toString(10),
            address: this.address,
            inputAmount: this.inputAmount == null ? null : this.inputAmount.toString(10),
            outputAmount: this.outputAmount == null ? null : this.outputAmount.toString(10),
            recipient: this.recipient,
            token: this.token,
            refundAddress: this.refundAddress,
            scTxId: this.scTxId,
            txId: this.txId,
            refundTxId: this.refundTxId,
        };
    }
    getInitiator() {
        return this.recipient;
    }
    hasEnoughForTxFees() {
        return Promise.resolve({
            balance: (0, Tokens_1.toTokenAmount)(0n, this.wrapper.getNativeToken(), this.wrapper.prices),
            enoughBalance: true,
            required: (0, Tokens_1.toTokenAmount)(0n, this.wrapper.getNativeToken(), this.wrapper.prices)
        });
    }
    //////////////////////////////
    //// Swap ticks & sync
    async _sync(save) {
        if (this.state === OnchainForGasSwapState.PR_CREATED) {
            //Check if it's maybe already paid
            const result = await this.checkAddress(false);
            if (result) {
                if (save)
                    await this._saveAndEmit();
                return true;
            }
        }
        return false;
    }
    _tick(save) {
        return Promise.resolve(false);
    }
}
exports.OnchainForGasSwap = OnchainForGasSwap;
