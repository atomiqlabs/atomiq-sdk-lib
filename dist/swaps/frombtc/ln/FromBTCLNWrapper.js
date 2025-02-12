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
exports.FromBTCLNWrapper = void 0;
const FromBTCLNSwap_1 = require("./FromBTCLNSwap");
const IFromBTCWrapper_1 = require("../IFromBTCWrapper");
const BN = require("bn.js");
const bolt11_1 = require("bolt11");
const base_1 = require("@atomiqlabs/base");
const UserError_1 = require("../../../errors/UserError");
const randomBytes = require("randombytes");
const createHash = require("create-hash");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const SwapType_1 = require("../../SwapType");
const Utils_1 = require("../../../utils/Utils");
const IntermediaryAPI_1 = require("../../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../../errors/RequestError");
const LNURL_1 = require("../../../utils/LNURL");
class FromBTCLNWrapper extends IFromBTCWrapper_1.IFromBTCWrapper {
    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param prices Swap pricing handler
     * @param chainEvents On-chain event listener
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param lnApi
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, lnApi, options, events) {
        super(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events);
        this.swapDeserializer = FromBTCLNSwap_1.FromBTCLNSwap;
        this.lnApi = lnApi;
    }
    checkPastSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.PR_CREATED || (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && swap.signatureData == null)) {
                if (swap.getTimeoutTime() < Date.now()) {
                    swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED;
                }
                const result = yield swap.checkIntermediaryPaymentReceived(false);
                if (result !== null)
                    return true;
            }
            if (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.PR_PAID || (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && swap.signatureData != null)) {
                //Check if it's already committed
                const status = yield (0, Utils_1.tryWithRetries)(() => this.contract.getCommitStatus(swap.getInitiator(), swap.data));
                switch (status) {
                    case base_1.SwapCommitStatus.COMMITED:
                        swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_COMMITED;
                        return true;
                    case base_1.SwapCommitStatus.EXPIRED:
                        swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_EXPIRED;
                        return true;
                    case base_1.SwapCommitStatus.PAID:
                        swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_CLAIMED;
                        return true;
                }
                if (!(yield swap.isQuoteValid())) {
                    swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_EXPIRED;
                    return true;
                }
                return false;
            }
            if (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_COMMITED || swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.EXPIRED) {
                //Check if it's already successfully paid
                const commitStatus = yield (0, Utils_1.tryWithRetries)(() => this.contract.getCommitStatus(swap.getInitiator(), swap.data));
                if (commitStatus === base_1.SwapCommitStatus.PAID) {
                    swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_CLAIMED;
                    return true;
                }
                if (commitStatus === base_1.SwapCommitStatus.NOT_COMMITED || commitStatus === base_1.SwapCommitStatus.EXPIRED) {
                    swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.FAILED;
                    return true;
                }
                return false;
            }
        });
    }
    tickSwap(swap) {
        switch (swap.state) {
            case FromBTCLNSwap_1.FromBTCLNSwapState.PR_CREATED:
                if (swap.getTimeoutTime() < Date.now())
                    swap._saveAndEmit(FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED);
                break;
            case FromBTCLNSwap_1.FromBTCLNSwapState.PR_PAID:
                if (swap.expiry < Date.now())
                    swap._saveAndEmit(FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED);
                break;
            case FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_COMMITED:
                this.contract.isExpired(swap.getInitiator(), swap.data).then(expired => {
                    if (expired)
                        swap._saveAndEmit(FromBTCLNSwap_1.FromBTCLNSwapState.EXPIRED);
                });
                break;
        }
    }
    processEventInitialize(swap, event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.PR_PAID || swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
                if (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.PR_PAID || swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED)
                    swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_COMMITED;
                return true;
            }
        });
    }
    processEventClaim(swap, event) {
        if (swap.state !== FromBTCLNSwap_1.FromBTCLNSwapState.FAILED) {
            swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_CLAIMED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventRefund(swap, event) {
        if (swap.state !== FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_CLAIMED) {
            swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.FAILED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    /**
     * Returns the swap expiry, leaving enough time for the user to claim the HTLC
     *
     * @param data Parsed swap data
     */
    getHtlcTimeout(data) {
        return data.getExpiry().sub(new BN(600));
    }
    /**
     * Generates a new 32-byte secret to be used as pre-image for lightning network invoice & HTLC swap\
     *
     * @private
     * @returns Hash pre-image & payment hash
     */
    getSecretAndHash() {
        const secret = randomBytes(32);
        const paymentHash = createHash("sha256").update(secret).digest();
        return { secret, paymentHash };
    }
    /**
     * Pre-fetches intermediary's LN node capacity, doesn't throw, instead returns null
     *
     * @param pubkeyPromise Promise that resolves when we receive "lnPublicKey" param from the intermediary thorugh
     *  streaming
     * @private
     * @returns LN Node liquidity
     */
    preFetchLnCapacity(pubkeyPromise) {
        return pubkeyPromise.then(pubkey => {
            if (pubkey == null)
                return null;
            return this.lnApi.getLNNodeLiquidity(pubkey);
        }).catch(e => {
            this.logger.error("preFetchLnCapacity(): Error: ", e);
            return null;
        });
    }
    /**
     * Verifies response returned from intermediary
     *
     * @param resp Response as returned by the intermediary
     * @param amountData
     * @param lp Intermediary
     * @param options Options as passed to the swap creation function
     * @param decodedPr Decoded bolt11 lightning network invoice
     * @param amountIn Amount in sats that will be paid for the swap
     * @private
     * @throws {IntermediaryError} in case the response is invalid
     */
    verifyReturnedData(resp, amountData, lp, options, decodedPr, amountIn) {
        if (lp.getAddress(this.chainIdentifier) !== resp.intermediaryKey)
            throw new IntermediaryError_1.IntermediaryError("Invalid intermediary address/pubkey");
        if (options.descriptionHash != null && decodedPr.tagsObject.purpose_commit_hash !== options.descriptionHash.toString("hex"))
            throw new IntermediaryError_1.IntermediaryError("Invalid pr returned - description hash");
        if (!amountData.exactIn) {
            if (!resp.total.eq(amountData.amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid amount returned");
        }
        else {
            if (!amountIn.eq(amountData.amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid payment request returned, amount mismatch");
        }
    }
    /**
     * Verifies whether the intermediary's lightning node has enough inbound capacity to receive the LN payment
     *
     * @param lp Intermediary
     * @param decodedPr Decoded bolt11 lightning network invoice
     * @param amountIn Amount to be paid for the swap in sats
     * @param lnCapacityPrefetchPromise Pre-fetch for LN node capacity, preFetchLnCapacity()
     * @param abortSignal
     * @private
     * @throws {IntermediaryError} if the lightning network node doesn't have enough inbound liquidity
     * @throws {Error} if the lightning network node's inbound liquidity might be enough, but the swap would
     *  deplete more than half of the liquidity
     */
    verifyLnNodeCapacity(lp, decodedPr, amountIn, lnCapacityPrefetchPromise, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            let result = yield lnCapacityPrefetchPromise;
            if (result == null)
                result = yield this.lnApi.getLNNodeLiquidity(decodedPr.payeeNodeKey);
            if (abortSignal != null)
                abortSignal.throwIfAborted();
            if (result === null)
                throw new IntermediaryError_1.IntermediaryError("LP's lightning node not found in the lightning network graph!");
            lp.lnData = result;
            if (decodedPr.payeeNodeKey !== result.publicKey)
                throw new IntermediaryError_1.IntermediaryError("Invalid pr returned - payee pubkey");
            if (result.capacity.lt(amountIn))
                throw new IntermediaryError_1.IntermediaryError("LP's lightning node doesn't have enough inbound capacity for the swap!");
            if (result.capacity.div(new BN(2)).lt(amountIn))
                throw new Error("LP's lightning node probably doesn't have enough inbound capacity for the swap!");
        });
    }
    /**
     * Returns a newly created swap, receiving 'amount' on lightning network
     *
     * @param signer                Smart chain signer's address intiating the swap
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     * @param preFetches
     */
    create(signer, amountData, lps, options, additionalParams, abortSignal, preFetches) {
        var _a, _b;
        if (options == null)
            options = {};
        if (preFetches == null)
            preFetches = {};
        if (options.descriptionHash != null && options.descriptionHash.length !== 32)
            throw new UserError_1.UserError("Invalid description hash length");
        const { secret, paymentHash } = this.getSecretAndHash();
        const claimHash = this.contract.getHashForHtlc(paymentHash);
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        (_a = preFetches.pricePrefetchPromise) !== null && _a !== void 0 ? _a : (preFetches.pricePrefetchPromise = this.preFetchPrice(amountData, _abortController.signal));
        (_b = preFetches.feeRatePromise) !== null && _b !== void 0 ? _b : (preFetches.feeRatePromise = this.preFetchFeeRate(signer, amountData, claimHash.toString("hex"), _abortController));
        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: (() => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const abortController = (0, Utils_1.extendAbortController)(_abortController.signal);
                    const liquidityPromise = this.preFetchIntermediaryLiquidity(amountData, lp, abortController);
                    const { lnCapacityPromise, resp } = yield (0, Utils_1.tryWithRetries)((retryCount) => __awaiter(this, void 0, void 0, function* () {
                        const { lnPublicKey, response } = IntermediaryAPI_1.IntermediaryAPI.initFromBTCLN(this.chainIdentifier, lp.url, {
                            paymentHash,
                            amount: amountData.amount,
                            claimer: signer,
                            token: amountData.token.toString(),
                            descriptionHash: options.descriptionHash,
                            exactOut: !amountData.exactIn,
                            feeRate: preFetches.feeRatePromise,
                            additionalParams
                        }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                        return {
                            lnCapacityPromise: this.preFetchLnCapacity(lnPublicKey),
                            resp: yield response
                        };
                    }), null, RequestError_1.RequestError, abortController.signal);
                    const decodedPr = (0, bolt11_1.decode)(resp.pr);
                    const amountIn = new BN(decodedPr.millisatoshis).add(new BN(999)).div(new BN(1000));
                    try {
                        this.verifyReturnedData(resp, amountData, lp, options, decodedPr, amountIn);
                        const [pricingInfo] = yield Promise.all([
                            this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.FROM_BTCLN], false, amountIn, resp.total, amountData.token, resp, preFetches.pricePrefetchPromise, abortController.signal),
                            this.verifyIntermediaryLiquidity(resp.total, liquidityPromise),
                            this.verifyLnNodeCapacity(lp, decodedPr, amountIn, lnCapacityPromise, abortController.signal)
                        ]);
                        const quote = new FromBTCLNSwap_1.FromBTCLNSwap(this, {
                            pricingInfo,
                            url: lp.url,
                            expiry: decodedPr.timeExpireDate * 1000,
                            swapFee: resp.swapFee,
                            feeRate: yield preFetches.feeRatePromise,
                            initialSwapData: yield this.contract.createSwapData(base_1.ChainSwapType.HTLC, lp.getAddress(this.chainIdentifier), signer, amountData.token, resp.total, claimHash.toString("hex"), this.getRandomSequence(), new BN(Math.floor(Date.now() / 1000)), false, true, resp.securityDeposit, new BN(0)),
                            pr: resp.pr,
                            secret: secret.toString("hex"),
                            exactIn: (_a = amountData.exactIn) !== null && _a !== void 0 ? _a : true
                        });
                        yield quote._save();
                        return quote;
                    }
                    catch (e) {
                        abortController.abort(e);
                        throw e;
                    }
                }))()
            };
        });
    }
    /**
     * Parses and fetches lnurl withdraw params from the specified lnurl
     *
     * @param lnurl LNURL to be parsed and fetched
     * @param abortSignal
     * @private
     * @throws {UserError} if the LNURL is invalid or if it's not a LNURL-withdraw
     */
    getLNURLWithdraw(lnurl, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof (lnurl) !== "string")
                return lnurl;
            const res = yield LNURL_1.LNURL.getLNURL(lnurl, true, this.options.getRequestTimeout, abortSignal);
            if (res == null)
                throw new UserError_1.UserError("Invalid LNURL");
            if (res.tag !== "withdrawRequest")
                throw new UserError_1.UserError("Not a LNURL-withdrawal");
            return res;
        });
    }
    /**
     * Returns a newly created swap, receiving 'amount' from the lnurl-withdraw
     *
     * @param signer                Smart chains signer's address intiating the swap
     * @param lnurl                 LNURL-withdraw to withdraw funds from
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    createViaLNURL(signer, lnurl, amountData, lps, additionalParams, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isInitialized)
                throw new Error("Not initialized, call init() first!");
            const abortController = (0, Utils_1.extendAbortController)(abortSignal);
            const preFetches = {
                pricePrefetchPromise: this.preFetchPrice(amountData, abortController.signal),
                feeRatePromise: this.preFetchFeeRate(signer, amountData, null, abortController)
            };
            try {
                const exactOutAmountPromise = !amountData.exactIn ? preFetches.pricePrefetchPromise.then(price => this.prices.getToBtcSwapAmount(this.chainIdentifier, amountData.amount, amountData.token, abortController.signal, price)).catch(e => {
                    abortController.abort(e);
                    return null;
                }) : null;
                const withdrawRequest = yield this.getLNURLWithdraw(lnurl, abortController.signal);
                const min = new BN(withdrawRequest.minWithdrawable).div(new BN(1000));
                const max = new BN(withdrawRequest.maxWithdrawable).div(new BN(1000));
                if (amountData.exactIn) {
                    if (amountData.amount.lt(min))
                        throw new UserError_1.UserError("Amount less than LNURL-withdraw minimum");
                    if (amountData.amount.gt(max))
                        throw new UserError_1.UserError("Amount more than LNURL-withdraw maximum");
                }
                else {
                    const amount = yield exactOutAmountPromise;
                    abortController.signal.throwIfAborted();
                    if (amount.muln(95).divn(100).lt(min))
                        throw new UserError_1.UserError("Amount less than LNURL-withdraw minimum");
                    if (amount.muln(105).divn(100).gt(max))
                        throw new UserError_1.UserError("Amount more than LNURL-withdraw maximum");
                }
                return this.create(signer, amountData, lps, null, additionalParams, abortSignal, preFetches).map(data => {
                    return {
                        quote: data.quote.then(quote => {
                            quote.lnurl = withdrawRequest.url;
                            quote.lnurlK1 = withdrawRequest.k1;
                            quote.lnurlCallback = withdrawRequest.callback;
                            const amountIn = quote.getInput().rawAmount;
                            if (amountIn.lt(min))
                                throw new UserError_1.UserError("Amount less than LNURL-withdraw minimum");
                            if (amountIn.gt(max))
                                throw new UserError_1.UserError("Amount more than LNURL-withdraw maximum");
                            return quote;
                        }),
                        intermediary: data.intermediary
                    };
                });
            }
            catch (e) {
                abortController.abort(e);
                throw e;
            }
        });
    }
}
exports.FromBTCLNWrapper = FromBTCLNWrapper;
