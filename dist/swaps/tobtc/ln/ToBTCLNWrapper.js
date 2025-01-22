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
exports.ToBTCLNWrapper = void 0;
const bolt11_1 = require("bolt11");
const ToBTCLNSwap_1 = require("./ToBTCLNSwap");
const IToBTCWrapper_1 = require("../IToBTCWrapper");
const BN = require("bn.js");
const UserError_1 = require("../../../errors/UserError");
const base_1 = require("@atomiqlabs/base");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const SwapType_1 = require("../../SwapType");
const Utils_1 = require("../../../utils/Utils");
const IntermediaryAPI_1 = require("../../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../../errors/RequestError");
const LNURL_1 = require("../../../utils/LNURL");
class ToBTCLNWrapper extends IToBTCWrapper_1.IToBTCWrapper {
    constructor(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events) {
        var _a, _b, _c;
        if (options == null)
            options = {};
        (_a = options.paymentTimeoutSeconds) !== null && _a !== void 0 ? _a : (options.paymentTimeoutSeconds = 4 * 24 * 60 * 60);
        (_b = options.lightningBaseFee) !== null && _b !== void 0 ? _b : (options.lightningBaseFee = 10);
        (_c = options.lightningFeePPM) !== null && _c !== void 0 ? _c : (options.lightningFeePPM = 2000);
        super(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events);
        this.swapDeserializer = ToBTCLNSwap_1.ToBTCLNSwap;
    }
    /**
     * Calculates maximum lightning network routing fee based on amount
     *
     * @param amount BTC amount of the swap in satoshis
     * @param overrideBaseFee Override wrapper's default base fee
     * @param overrideFeePPM Override wrapper's default PPM
     * @private
     * @returns Maximum lightning routing fee in sats
     */
    calculateFeeForAmount(amount, overrideBaseFee, overrideFeePPM) {
        return new BN(overrideBaseFee || this.options.lightningBaseFee)
            .add(amount.mul(new BN(overrideFeePPM || this.options.lightningFeePPM)).div(new BN(1000000)));
    }
    /**
     * Pre-fetches & checks status of the specific lightning BOLT11 invoice
     *
     * @param parsedPr Parsed bolt11 invoice
     * @param abortController Aborts in case the invoice is/was already paid
     * @private
     */
    preFetchPayStatus(parsedPr, abortController) {
        return (0, Utils_1.tryWithRetries)(() => this.contract.getPaymentHashStatus(parsedPr.tagsObject.payment_hash), null, null, abortController.signal).then(payStatus => {
            if (payStatus !== base_1.SwapCommitStatus.NOT_COMMITED) {
                throw new UserError_1.UserError("Invoice already being paid for or paid");
            }
        }).catch(e => {
            abortController.abort(e);
        });
    }
    /**
     * Verifies returned LP data
     *
     * @param resp Response as returned by the LP
     * @param parsedPr Parsed bolt11 lightning invoice
     * @param token Smart chain token to be used in the swap
     * @param lp
     * @param options Swap options as passed to the swap create function
     * @param data Parsed swap data returned by the LP
     * @param requiredTotal Required total to be paid on the input (for exactIn swaps)
     * @private
     * @throws {IntermediaryError} In case the response is not valid
     */
    verifyReturnedData(resp, parsedPr, token, lp, options, data, requiredTotal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (resp.routingFeeSats.gt(yield options.maxFee))
                throw new IntermediaryError_1.IntermediaryError("Invalid max fee sats returned");
            if (requiredTotal != null && !resp.total.eq(requiredTotal))
                throw new IntermediaryError_1.IntermediaryError("Invalid data returned - total amount");
            if (!data.getAmount().eq(resp.total) ||
                data.getHash() !== parsedPr.tagsObject.payment_hash ||
                !data.getEscrowNonce().eq(new BN(0)) ||
                data.getConfirmations() !== 0 ||
                !data.getExpiry().eq(options.expiryTimestamp) ||
                data.getType() !== base_1.ChainSwapType.HTLC ||
                !data.isPayIn() ||
                !data.isToken(token) ||
                data.getClaimer() !== lp.getAddress(this.chainIdentifier)) {
                throw new IntermediaryError_1.IntermediaryError("Invalid data returned");
            }
        });
    }
    /**
     * Returns the quote/swap from a given intermediary
     *
     * @param signer Smartchain signer initiating the swap
     * @param amountData
     * @param lp Intermediary
     * @param pr bolt11 lightning network invoice
     * @param parsedPr Parsed bolt11 lightning network invoice
     * @param options Options as passed to the swap create function
     * @param preFetches
     * @param abort Abort signal or controller, if AbortController is passed it is used as-is, when AbortSignal is passed
     *  it is extended with extendAbortController and then used
     * @param additionalParams Additional params that should be sent to the LP
     * @private
     */
    getIntermediaryQuote(signer, amountData, lp, pr, parsedPr, options, preFetches, abort, additionalParams) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const abortController = abort instanceof AbortController ? abort : (0, Utils_1.extendAbortController)(abort);
            (_a = preFetches.reputationPromise) !== null && _a !== void 0 ? _a : (preFetches.reputationPromise = this.preFetchIntermediaryReputation(amountData, lp, abortController));
            try {
                const { signDataPromise, resp } = yield (0, Utils_1.tryWithRetries)((retryCount) => __awaiter(this, void 0, void 0, function* () {
                    const { signDataPrefetch, response } = IntermediaryAPI_1.IntermediaryAPI.initToBTCLN(this.chainIdentifier, lp.url, {
                        offerer: signer,
                        pr,
                        maxFee: yield options.maxFee,
                        expiryTimestamp: options.expiryTimestamp,
                        token: amountData.token,
                        feeRate: preFetches.feeRatePromise,
                        additionalParams
                    }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                    return {
                        signDataPromise: this.preFetchSignData(signDataPrefetch),
                        resp: yield response
                    };
                }), null, e => e instanceof RequestError_1.RequestError, abortController.signal);
                const amountOut = new BN(parsedPr.millisatoshis).add(new BN(999)).div(new BN(1000));
                const totalFee = resp.swapFee.add(resp.maxFee);
                const data = new this.swapDataDeserializer(resp.data);
                data.setOfferer(signer);
                yield this.verifyReturnedData(resp, parsedPr, amountData.token, lp, options, data);
                const [pricingInfo, signatureExpiry, reputation] = yield Promise.all([
                    this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.TO_BTCLN], true, amountOut, data.getAmount(), amountData.token, { swapFee: resp.swapFee, networkFee: resp.maxFee, totalFee }, preFetches.pricePreFetchPromise, abortController.signal),
                    this.verifyReturnedSignature(data, resp, preFetches.feeRatePromise, signDataPromise, abortController.signal),
                    preFetches.reputationPromise,
                    preFetches.payStatusPromise
                ]);
                abortController.signal.throwIfAborted();
                lp.reputation[amountData.token.toString()] = reputation;
                const quote = new ToBTCLNSwap_1.ToBTCLNSwap(this, {
                    pricingInfo,
                    url: lp.url,
                    expiry: signatureExpiry,
                    swapFee: resp.swapFee,
                    feeRate: yield preFetches.feeRatePromise,
                    signatureData: resp,
                    data,
                    networkFee: resp.maxFee,
                    networkFeeBtc: resp.routingFeeSats,
                    confidence: resp.confidence,
                    pr,
                    exactIn: false
                });
                yield quote._save();
                return quote;
            }
            catch (e) {
                abortController.abort(e);
                throw e;
            }
        });
    }
    /**
     * Returns a newly created swap, paying for 'bolt11PayRequest' - a bitcoin LN invoice
     *
     * @param signer                Smartchain signer's address initiating the swap
     * @param bolt11PayRequest      BOLT11 payment request (bitcoin lightning invoice) you wish to pay
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     * @param preFetches            Existing pre-fetches for the swap (only used internally for LNURL swaps)
     */
    create(signer, bolt11PayRequest, amountData, lps, options, additionalParams, abortSignal, preFetches) {
        var _a, _b, _c;
        options !== null && options !== void 0 ? options : (options = {});
        (_a = options.expirySeconds) !== null && _a !== void 0 ? _a : (options.expirySeconds = this.options.paymentTimeoutSeconds);
        (_b = options.expiryTimestamp) !== null && _b !== void 0 ? _b : (options.expiryTimestamp = new BN(Math.floor(Date.now() / 1000) + options.expirySeconds));
        const parsedPr = (0, bolt11_1.decode)(bolt11PayRequest);
        if (parsedPr.millisatoshis == null)
            throw new UserError_1.UserError("Must be an invoice with amount");
        const amountOut = new BN(parsedPr.millisatoshis).add(new BN(999)).div(new BN(1000));
        (_c = options.maxFee) !== null && _c !== void 0 ? _c : (options.maxFee = this.calculateFeeForAmount(amountOut, options.maxRoutingBaseFee, options.maxRoutingPPM));
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        if (preFetches == null)
            preFetches = {
                pricePreFetchPromise: this.preFetchPrice(amountData, _abortController.signal),
                payStatusPromise: this.preFetchPayStatus(parsedPr, _abortController),
                feeRatePromise: this.preFetchFeeRate(signer, amountData, parsedPr.tagsObject.payment_hash, _abortController)
            };
        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: this.getIntermediaryQuote(signer, amountData, lp, bolt11PayRequest, parsedPr, options, preFetches, _abortController.signal, additionalParams)
            };
        });
    }
    /**
     * Parses and fetches lnurl pay params from the specified lnurl
     *
     * @param lnurl LNURL to be parsed and fetched
     * @param abortSignal
     * @private
     * @throws {UserError} if the LNURL is invalid or if it's not a LNURL-pay
     */
    getLNURLPay(lnurl, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof (lnurl) !== "string")
                return lnurl;
            const res = yield LNURL_1.LNURL.getLNURL(lnurl, true, this.options.getRequestTimeout, abortSignal);
            if (res == null)
                throw new UserError_1.UserError("Invalid LNURL");
            if (res.tag !== "payRequest")
                throw new UserError_1.UserError("Not a LNURL-pay");
            return res;
        });
    }
    /**
     * Returns the quote/swap from the given LP
     *
     * @param signer Smartchain signer's address initiating the swap
     * @param amountData
     * @param payRequest Parsed LNURL-pay params
     * @param lp Intermediary
     * @param dummyPr Dummy minimum value bolt11 lightning invoice returned from the LNURL-pay
     * @param options Options as passed to the swap create function
     * @param preFetches
     * @param abortSignal
     * @param additionalParams Additional params to be sent to the intermediary
     * @private
     */
    getIntermediaryQuoteExactIn(signer, amountData, payRequest, lp, dummyPr, options, preFetches, abortSignal, additionalParams) {
        return __awaiter(this, void 0, void 0, function* () {
            const abortController = (0, Utils_1.extendAbortController)(abortSignal);
            const reputationPromise = this.preFetchIntermediaryReputation(amountData, lp, abortController);
            try {
                const { signDataPromise, prepareResp } = yield (0, Utils_1.tryWithRetries)((retryCount) => __awaiter(this, void 0, void 0, function* () {
                    const { signDataPrefetch, response } = IntermediaryAPI_1.IntermediaryAPI.prepareToBTCLNExactIn(this.chainIdentifier, lp.url, {
                        token: amountData.token,
                        offerer: signer,
                        pr: dummyPr,
                        amount: amountData.amount,
                        maxFee: yield options.maxFee,
                        expiryTimestamp: options.expiryTimestamp,
                        additionalParams
                    }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                    return {
                        signDataPromise: this.preFetchSignData(signDataPrefetch),
                        prepareResp: yield response
                    };
                }), null, e => e instanceof RequestError_1.RequestError, abortController.signal);
                if (prepareResp.amount.isZero() || prepareResp.amount.isNeg())
                    throw new IntermediaryError_1.IntermediaryError("Invalid amount returned (zero or negative)");
                const min = new BN(payRequest.minSendable).div(new BN(1000));
                const max = new BN(payRequest.maxSendable).div(new BN(1000));
                if (prepareResp.amount.lt(min))
                    throw new UserError_1.UserError("Amount less than minimum");
                if (prepareResp.amount.gt(max))
                    throw new UserError_1.UserError("Amount more than maximum");
                const { invoice, parsedInvoice, successAction } = yield LNURL_1.LNURL.useLNURLPay(payRequest, prepareResp.amount, options.comment, this.options.getRequestTimeout, abortController.signal);
                const payStatusPromise = this.preFetchPayStatus(parsedInvoice, abortController);
                const resp = yield (0, Utils_1.tryWithRetries)((retryCount) => IntermediaryAPI_1.IntermediaryAPI.initToBTCLNExactIn(lp.url, {
                    pr: invoice,
                    reqId: prepareResp.reqId,
                    feeRate: preFetches.feeRatePromise,
                    additionalParams
                }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null), null, RequestError_1.RequestError, abortController.signal);
                const totalFee = resp.swapFee.add(resp.maxFee);
                const data = new this.swapDataDeserializer(resp.data);
                data.setOfferer(signer);
                yield this.verifyReturnedData(resp, parsedInvoice, amountData.token, lp, options, data, amountData.amount);
                const [pricingInfo, signatureExpiry, reputation] = yield Promise.all([
                    this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.TO_BTCLN], true, prepareResp.amount, data.getAmount(), amountData.token, { swapFee: resp.swapFee, networkFee: resp.maxFee, totalFee }, preFetches.pricePreFetchPromise, abortSignal),
                    this.verifyReturnedSignature(data, resp, preFetches.feeRatePromise, signDataPromise, abortController.signal),
                    reputationPromise,
                    payStatusPromise
                ]);
                abortController.signal.throwIfAborted();
                lp.reputation[amountData.token.toString()] = reputation;
                const quote = new ToBTCLNSwap_1.ToBTCLNSwap(this, {
                    pricingInfo,
                    url: lp.url,
                    expiry: signatureExpiry,
                    swapFee: resp.swapFee,
                    feeRate: yield preFetches.feeRatePromise,
                    signatureData: resp,
                    data,
                    networkFee: resp.maxFee,
                    networkFeeBtc: resp.routingFeeSats,
                    confidence: resp.confidence,
                    pr: invoice,
                    lnurl: payRequest.url,
                    successAction,
                    exactIn: true
                });
                yield quote._save();
                return quote;
            }
            catch (e) {
                abortController.abort(e);
                throw e;
            }
        });
    }
    /**
     * Returns a newly created swap, paying for 'lnurl' - a lightning LNURL-pay
     *
     * @param signer                Smartchain signer's address initiating the swap
     * @param lnurl                 LMURL-pay you wish to pay
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers/intermediaries) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the intermediary when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    createViaLNURL(signer, lnurl, amountData, lps, options, additionalParams, abortSignal) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isInitialized)
                throw new Error("Not initialized, call init() first!");
            options !== null && options !== void 0 ? options : (options = {});
            (_a = options.expirySeconds) !== null && _a !== void 0 ? _a : (options.expirySeconds = this.options.paymentTimeoutSeconds);
            (_b = options.expiryTimestamp) !== null && _b !== void 0 ? _b : (options.expiryTimestamp = new BN(Math.floor(Date.now() / 1000) + options.expirySeconds));
            const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
            const pricePreFetchPromise = this.preFetchPrice(amountData, _abortController.signal);
            const feeRatePromise = this.preFetchFeeRate(signer, amountData, null, _abortController);
            (_c = options.maxRoutingPPM) !== null && _c !== void 0 ? _c : (options.maxRoutingPPM = new BN(this.options.lightningFeePPM));
            (_d = options.maxRoutingBaseFee) !== null && _d !== void 0 ? _d : (options.maxRoutingBaseFee = new BN(this.options.lightningBaseFee));
            if (amountData.exactIn) {
                (_e = options.maxFee) !== null && _e !== void 0 ? _e : (options.maxFee = pricePreFetchPromise
                    .then(val => this.prices.getFromBtcSwapAmount(this.chainIdentifier, options.maxRoutingBaseFee, amountData.token, abortSignal, val))
                    .then(_maxBaseFee => this.calculateFeeForAmount(amountData.amount, _maxBaseFee, options.maxRoutingPPM)));
            }
            else {
                options.maxFee = this.calculateFeeForAmount(amountData.amount, options.maxRoutingBaseFee, options.maxRoutingPPM);
            }
            try {
                let payRequest = yield this.getLNURLPay(lnurl, _abortController.signal);
                if (options.comment != null &&
                    (payRequest.commentAllowed == null || options.comment.length > payRequest.commentAllowed))
                    throw new UserError_1.UserError("Comment not allowed or too long");
                if (amountData.exactIn) {
                    const { invoice: dummyInvoice } = yield LNURL_1.LNURL.useLNURLPay(payRequest, new BN(payRequest.minSendable).div(new BN(1000)), null, this.options.getRequestTimeout, _abortController.signal);
                    return lps.map(lp => {
                        return {
                            quote: this.getIntermediaryQuoteExactIn(signer, amountData, payRequest, lp, dummyInvoice, options, {
                                pricePreFetchPromise,
                                feeRatePromise
                            }, _abortController.signal, additionalParams),
                            intermediary: lp
                        };
                    });
                }
                else {
                    const min = new BN(payRequest.minSendable).div(new BN(1000));
                    const max = new BN(payRequest.maxSendable).div(new BN(1000));
                    if (amountData.amount.lt(min))
                        throw new UserError_1.UserError("Amount less than minimum");
                    if (amountData.amount.gt(max))
                        throw new UserError_1.UserError("Amount more than maximum");
                    const { invoice, parsedInvoice, successAction } = yield LNURL_1.LNURL.useLNURLPay(payRequest, amountData.amount, options.comment, this.options.getRequestTimeout, _abortController.signal);
                    const payStatusPromise = this.preFetchPayStatus(parsedInvoice, _abortController);
                    return this.create(signer, invoice, amountData, lps, options, additionalParams, _abortController.signal, {
                        feeRatePromise,
                        pricePreFetchPromise,
                        payStatusPromise,
                    }).map(data => {
                        return {
                            quote: data.quote.then(quote => {
                                quote.lnurl = payRequest.url;
                                quote.successAction = successAction;
                                return quote;
                            }),
                            intermediary: data.intermediary
                        };
                    });
                }
            }
            catch (e) {
                _abortController.abort(e);
                throw e;
            }
        });
    }
}
exports.ToBTCLNWrapper = ToBTCLNWrapper;
