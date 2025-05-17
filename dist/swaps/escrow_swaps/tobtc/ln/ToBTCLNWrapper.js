"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToBTCLNWrapper = void 0;
const bolt11_1 = require("@atomiqlabs/bolt11");
const ToBTCLNSwap_1 = require("./ToBTCLNSwap");
const IToBTCWrapper_1 = require("../IToBTCWrapper");
const UserError_1 = require("../../../../errors/UserError");
const base_1 = require("@atomiqlabs/base");
const IntermediaryError_1 = require("../../../../errors/IntermediaryError");
const SwapType_1 = require("../../../enums/SwapType");
const Utils_1 = require("../../../../utils/Utils");
const IntermediaryAPI_1 = require("../../../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../../../errors/RequestError");
const LNURL_1 = require("../../../../utils/LNURL");
const IToBTCSwap_1 = require("../IToBTCSwap");
class ToBTCLNWrapper extends IToBTCWrapper_1.IToBTCWrapper {
    constructor(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, contract, prices, tokens, swapDataDeserializer, options, events) {
        if (options == null)
            options = {};
        options.paymentTimeoutSeconds ??= 4 * 24 * 60 * 60;
        options.lightningBaseFee ??= 10;
        options.lightningFeePPM ??= 2000;
        super(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, contract, prices, tokens, swapDataDeserializer, options, events);
        this.TYPE = SwapType_1.SwapType.TO_BTCLN;
        this.swapDeserializer = ToBTCLNSwap_1.ToBTCLNSwap;
    }
    async checkPaymentHashWasPaid(paymentHash) {
        const swaps = await this.unifiedStorage.query([[{ key: "type", value: this.TYPE }, { key: "paymentHash", value: paymentHash }]], (obj) => new this.swapDeserializer(this, obj));
        for (let value of swaps) {
            if (value.state === IToBTCSwap_1.ToBTCSwapState.CLAIMED || value.state === IToBTCSwap_1.ToBTCSwapState.SOFT_CLAIMED)
                throw new UserError_1.UserError("Lightning invoice was already paid!");
        }
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
        return BigInt(overrideBaseFee ?? this.options.lightningBaseFee)
            + (amount * BigInt(overrideFeePPM ?? this.options.lightningFeePPM) / 1000000n);
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
    async verifyReturnedData(resp, parsedPr, token, lp, options, data, requiredTotal) {
        if (resp.routingFeeSats > await options.maxFee)
            throw new IntermediaryError_1.IntermediaryError("Invalid max fee sats returned");
        if (requiredTotal != null && resp.total !== requiredTotal)
            throw new IntermediaryError_1.IntermediaryError("Invalid data returned - total amount");
        const claimHash = this.contract.getHashForHtlc(Buffer.from(parsedPr.tagsObject.payment_hash, "hex"));
        if (data.getAmount() !== resp.total ||
            !Buffer.from(data.getClaimHash(), "hex").equals(claimHash) ||
            data.getExpiry() !== options.expiryTimestamp ||
            data.getType() !== base_1.ChainSwapType.HTLC ||
            !data.isPayIn() ||
            !data.isToken(token) ||
            data.getClaimer() !== lp.getAddress(this.chainIdentifier)) {
            throw new IntermediaryError_1.IntermediaryError("Invalid data returned");
        }
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
    async getIntermediaryQuote(signer, amountData, lp, pr, parsedPr, options, preFetches, abort, additionalParams) {
        const abortController = abort instanceof AbortController ? abort : (0, Utils_1.extendAbortController)(abort);
        preFetches.reputationPromise ??= this.preFetchIntermediaryReputation(amountData, lp, abortController);
        try {
            const { signDataPromise, resp } = await (0, Utils_1.tryWithRetries)(async (retryCount) => {
                const { signDataPrefetch, response } = IntermediaryAPI_1.IntermediaryAPI.initToBTCLN(this.chainIdentifier, lp.url, {
                    offerer: signer,
                    pr,
                    maxFee: await options.maxFee,
                    expiryTimestamp: options.expiryTimestamp,
                    token: amountData.token,
                    feeRate: preFetches.feeRatePromise,
                    additionalParams
                }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                return {
                    signDataPromise: this.preFetchSignData(signDataPrefetch),
                    resp: await response
                };
            }, null, e => e instanceof RequestError_1.RequestError, abortController.signal);
            const amountOut = (BigInt(parsedPr.millisatoshis) + 999n) / 1000n;
            const totalFee = resp.swapFee + resp.maxFee;
            const data = new this.swapDataDeserializer(resp.data);
            data.setOfferer(signer);
            await this.verifyReturnedData(resp, parsedPr, amountData.token, lp, options, data);
            const [pricingInfo, signatureExpiry, reputation] = await Promise.all([
                this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.TO_BTCLN], true, amountOut, data.getAmount(), amountData.token, { networkFee: resp.maxFee }, preFetches.pricePreFetchPromise, abortController.signal),
                this.verifyReturnedSignature(data, resp, preFetches.feeRatePromise, signDataPromise, abortController.signal),
                preFetches.reputationPromise
            ]);
            abortController.signal.throwIfAborted();
            lp.reputation[amountData.token.toString()] = reputation;
            const quote = new ToBTCLNSwap_1.ToBTCLNSwap(this, {
                pricingInfo,
                url: lp.url,
                expiry: signatureExpiry,
                swapFee: resp.swapFee,
                feeRate: await preFetches.feeRatePromise,
                signatureData: resp,
                data,
                networkFee: resp.maxFee,
                networkFeeBtc: resp.routingFeeSats,
                confidence: resp.confidence,
                pr,
                exactIn: false
            });
            await quote._save();
            return quote;
        }
        catch (e) {
            abortController.abort(e);
            throw e;
        }
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
    async create(signer, bolt11PayRequest, amountData, lps, options, additionalParams, abortSignal, preFetches) {
        options ??= {};
        options.expirySeconds ??= this.options.paymentTimeoutSeconds;
        options.expiryTimestamp ??= BigInt(Math.floor(Date.now() / 1000) + options.expirySeconds);
        const parsedPr = (0, bolt11_1.decode)(bolt11PayRequest);
        if (parsedPr.millisatoshis == null)
            throw new UserError_1.UserError("Must be an invoice with amount");
        const amountOut = (BigInt(parsedPr.millisatoshis) + 999n) / 1000n;
        options.maxFee ??= this.calculateFeeForAmount(amountOut, options.maxRoutingBaseFee, options.maxRoutingPPM);
        await this.checkPaymentHashWasPaid(parsedPr.tagsObject.payment_hash);
        const claimHash = this.contract.getHashForHtlc(Buffer.from(parsedPr.tagsObject.payment_hash, "hex"));
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        if (preFetches == null)
            preFetches = {
                pricePreFetchPromise: this.preFetchPrice(amountData, _abortController.signal),
                feeRatePromise: this.preFetchFeeRate(signer, amountData, claimHash.toString("hex"), _abortController)
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
    async getLNURLPay(lnurl, abortSignal) {
        if (typeof (lnurl) !== "string")
            return lnurl;
        const res = await LNURL_1.LNURL.getLNURL(lnurl, true, this.options.getRequestTimeout, abortSignal);
        if (res == null)
            throw new UserError_1.UserError("Invalid LNURL");
        if (res.tag !== "payRequest")
            throw new UserError_1.UserError("Not a LNURL-pay");
        return res;
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
    async getIntermediaryQuoteExactIn(signer, amountData, payRequest, lp, dummyPr, options, preFetches, abortSignal, additionalParams) {
        const abortController = (0, Utils_1.extendAbortController)(abortSignal);
        const reputationPromise = this.preFetchIntermediaryReputation(amountData, lp, abortController);
        try {
            const { signDataPromise, prepareResp } = await (0, Utils_1.tryWithRetries)(async (retryCount) => {
                const { signDataPrefetch, response } = IntermediaryAPI_1.IntermediaryAPI.prepareToBTCLNExactIn(this.chainIdentifier, lp.url, {
                    token: amountData.token,
                    offerer: signer,
                    pr: dummyPr,
                    amount: amountData.amount,
                    maxFee: await options.maxFee,
                    expiryTimestamp: options.expiryTimestamp,
                    additionalParams
                }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                return {
                    signDataPromise: this.preFetchSignData(signDataPrefetch),
                    prepareResp: await response
                };
            }, null, e => e instanceof RequestError_1.RequestError, abortController.signal);
            if (prepareResp.amount <= 0n)
                throw new IntermediaryError_1.IntermediaryError("Invalid amount returned (zero or negative)");
            const min = BigInt(payRequest.minSendable) / 1000n;
            const max = BigInt(payRequest.maxSendable) / 1000n;
            if (prepareResp.amount < min)
                throw new UserError_1.UserError("Amount less than minimum");
            if (prepareResp.amount > max)
                throw new UserError_1.UserError("Amount more than maximum");
            const { invoice, parsedInvoice, successAction } = await LNURL_1.LNURL.useLNURLPay(payRequest, prepareResp.amount, options.comment, this.options.getRequestTimeout, abortController.signal);
            const resp = await (0, Utils_1.tryWithRetries)((retryCount) => IntermediaryAPI_1.IntermediaryAPI.initToBTCLNExactIn(lp.url, {
                pr: invoice,
                reqId: prepareResp.reqId,
                feeRate: preFetches.feeRatePromise,
                additionalParams
            }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null), null, RequestError_1.RequestError, abortController.signal);
            const totalFee = resp.swapFee + resp.maxFee;
            const data = new this.swapDataDeserializer(resp.data);
            data.setOfferer(signer);
            await this.verifyReturnedData(resp, parsedInvoice, amountData.token, lp, options, data, amountData.amount);
            const [pricingInfo, signatureExpiry, reputation] = await Promise.all([
                this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.TO_BTCLN], true, prepareResp.amount, data.getAmount(), amountData.token, { networkFee: resp.maxFee }, preFetches.pricePreFetchPromise, abortSignal),
                this.verifyReturnedSignature(data, resp, preFetches.feeRatePromise, signDataPromise, abortController.signal),
                reputationPromise
            ]);
            abortController.signal.throwIfAborted();
            lp.reputation[amountData.token.toString()] = reputation;
            const quote = new ToBTCLNSwap_1.ToBTCLNSwap(this, {
                pricingInfo,
                url: lp.url,
                expiry: signatureExpiry,
                swapFee: resp.swapFee,
                feeRate: await preFetches.feeRatePromise,
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
            await quote._save();
            return quote;
        }
        catch (e) {
            abortController.abort(e);
            throw e;
        }
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
    async createViaLNURL(signer, lnurl, amountData, lps, options, additionalParams, abortSignal) {
        if (!this.isInitialized)
            throw new Error("Not initialized, call init() first!");
        options ??= {};
        options.expirySeconds ??= this.options.paymentTimeoutSeconds;
        options.expiryTimestamp ??= BigInt(Math.floor(Date.now() / 1000) + options.expirySeconds);
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        const pricePreFetchPromise = this.preFetchPrice(amountData, _abortController.signal);
        const feeRatePromise = this.preFetchFeeRate(signer, amountData, null, _abortController);
        options.maxRoutingPPM ??= BigInt(this.options.lightningFeePPM);
        options.maxRoutingBaseFee ??= BigInt(this.options.lightningBaseFee);
        if (amountData.exactIn) {
            options.maxFee ??= pricePreFetchPromise
                .then(val => this.prices.getFromBtcSwapAmount(this.chainIdentifier, options.maxRoutingBaseFee, amountData.token, abortSignal, val))
                .then(_maxBaseFee => this.calculateFeeForAmount(amountData.amount, _maxBaseFee, options.maxRoutingPPM));
        }
        else {
            options.maxFee = this.calculateFeeForAmount(amountData.amount, options.maxRoutingBaseFee, options.maxRoutingPPM);
        }
        try {
            let payRequest = await this.getLNURLPay(lnurl, _abortController.signal);
            if (options.comment != null &&
                (payRequest.commentAllowed == null || options.comment.length > payRequest.commentAllowed))
                throw new UserError_1.UserError("Comment not allowed or too long");
            if (amountData.exactIn) {
                const { invoice: dummyInvoice } = await LNURL_1.LNURL.useLNURLPay(payRequest, BigInt(payRequest.minSendable) / 1000n, null, this.options.getRequestTimeout, _abortController.signal);
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
                const min = BigInt(payRequest.minSendable) / 1000n;
                const max = BigInt(payRequest.maxSendable) / 1000n;
                if (amountData.amount < min)
                    throw new UserError_1.UserError("Amount less than minimum");
                if (amountData.amount > max)
                    throw new UserError_1.UserError("Amount more than maximum");
                const { invoice, parsedInvoice, successAction } = await LNURL_1.LNURL.useLNURLPay(payRequest, amountData.amount, options.comment, this.options.getRequestTimeout, _abortController.signal);
                return (await this.create(signer, invoice, amountData, lps, options, additionalParams, _abortController.signal, {
                    feeRatePromise,
                    pricePreFetchPromise
                })).map(data => {
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
    }
}
exports.ToBTCLNWrapper = ToBTCLNWrapper;
