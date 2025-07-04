"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FromBTCLNWrapper = void 0;
const FromBTCLNSwap_1 = require("./FromBTCLNSwap");
const IFromBTCWrapper_1 = require("../IFromBTCWrapper");
const bolt11_1 = require("@atomiqlabs/bolt11");
const base_1 = require("@atomiqlabs/base");
const buffer_1 = require("buffer");
const UserError_1 = require("../../../../errors/UserError");
const sha2_1 = require("@noble/hashes/sha2");
const IntermediaryError_1 = require("../../../../errors/IntermediaryError");
const SwapType_1 = require("../../../enums/SwapType");
const Utils_1 = require("../../../../utils/Utils");
const IntermediaryAPI_1 = require("../../../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../../../errors/RequestError");
const LNURL_1 = require("../../../../utils/LNURL");
class FromBTCLNWrapper extends IFromBTCWrapper_1.IFromBTCWrapper {
    /**
     * @param chainIdentifier
     * @param unifiedStorage Storage interface for the current environment
     * @param unifiedChainEvents On-chain event listener
     * @param chain
     * @param contract Underlying contract handling the swaps
     * @param prices Swap pricing handler
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param lnApi
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, contract, prices, tokens, swapDataDeserializer, lnApi, options, events) {
        super(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, contract, prices, tokens, swapDataDeserializer, options, events);
        this.TYPE = SwapType_1.SwapType.FROM_BTCLN;
        this.swapDeserializer = FromBTCLNSwap_1.FromBTCLNSwap;
        this.pendingSwapStates = [
            FromBTCLNSwap_1.FromBTCLNSwapState.PR_CREATED,
            FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED,
            FromBTCLNSwap_1.FromBTCLNSwapState.PR_PAID,
            FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_COMMITED,
            FromBTCLNSwap_1.FromBTCLNSwapState.EXPIRED
        ];
        this.tickSwapState = [
            FromBTCLNSwap_1.FromBTCLNSwapState.PR_CREATED,
            FromBTCLNSwap_1.FromBTCLNSwapState.PR_PAID,
            FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_COMMITED
        ];
        this.lnApi = lnApi;
    }
    processEventInitialize(swap, event) {
        if (swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.PR_PAID || swap.state === FromBTCLNSwap_1.FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
            swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_COMMITED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventClaim(swap, event) {
        if (swap.state !== FromBTCLNSwap_1.FromBTCLNSwapState.FAILED && swap.state !== FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_CLAIMED) {
            swap.state = FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_CLAIMED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventRefund(swap, event) {
        if (swap.state !== FromBTCLNSwap_1.FromBTCLNSwapState.CLAIM_CLAIMED && swap.state !== FromBTCLNSwap_1.FromBTCLNSwapState.FAILED) {
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
        return data.getExpiry() - 600n;
    }
    /**
     * Generates a new 32-byte secret to be used as pre-image for lightning network invoice & HTLC swap\
     *
     * @private
     * @returns Hash pre-image & payment hash
     */
    getSecretAndHash() {
        const secret = (0, Utils_1.randomBytes)(32);
        const paymentHash = buffer_1.Buffer.from((0, sha2_1.sha256)(secret));
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
            this.logger.warn("preFetchLnCapacity(): Error: ", e);
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
            if (resp.total != amountData.amount)
                throw new IntermediaryError_1.IntermediaryError("Invalid amount returned");
        }
        else {
            if (amountIn !== amountData.amount)
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
    async verifyLnNodeCapacity(lp, decodedPr, amountIn, lnCapacityPrefetchPromise, abortSignal) {
        let result = await lnCapacityPrefetchPromise;
        if (result == null)
            result = await this.lnApi.getLNNodeLiquidity(decodedPr.payeeNodeKey);
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        if (result === null)
            throw new IntermediaryError_1.IntermediaryError("LP's lightning node not found in the lightning network graph!");
        lp.lnData = result;
        if (decodedPr.payeeNodeKey !== result.publicKey)
            throw new IntermediaryError_1.IntermediaryError("Invalid pr returned - payee pubkey");
        if (result.capacity < amountIn)
            throw new IntermediaryError_1.IntermediaryError("LP's lightning node doesn't have enough inbound capacity for the swap!");
        if ((result.capacity / 2n) < amountIn)
            throw new Error("LP's lightning node probably doesn't have enough inbound capacity for the swap!");
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
        if (options == null)
            options = {};
        if (preFetches == null)
            preFetches = {};
        if (options.descriptionHash != null && options.descriptionHash.length !== 32)
            throw new UserError_1.UserError("Invalid description hash length");
        const { secret, paymentHash } = this.getSecretAndHash();
        const claimHash = this.contract.getHashForHtlc(paymentHash);
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        preFetches.pricePrefetchPromise ??= this.preFetchPrice(amountData, _abortController.signal);
        const nativeTokenAddress = this.chain.getNativeCurrencyAddress();
        preFetches.feeRatePromise ??= this.preFetchFeeRate(signer, amountData, claimHash.toString("hex"), _abortController);
        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: (async () => {
                    const abortController = (0, Utils_1.extendAbortController)(_abortController.signal);
                    const liquidityPromise = this.preFetchIntermediaryLiquidity(amountData, lp, abortController);
                    const { lnCapacityPromise, resp } = await (0, Utils_1.tryWithRetries)(async (retryCount) => {
                        const { lnPublicKey, response } = IntermediaryAPI_1.IntermediaryAPI.initFromBTCLN(this.chainIdentifier, lp.url, nativeTokenAddress, {
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
                            resp: await response
                        };
                    }, null, RequestError_1.RequestError, abortController.signal);
                    const decodedPr = (0, bolt11_1.decode)(resp.pr);
                    const amountIn = (BigInt(decodedPr.millisatoshis) + 999n) / 1000n;
                    try {
                        this.verifyReturnedData(resp, amountData, lp, options, decodedPr, amountIn);
                        const [pricingInfo] = await Promise.all([
                            this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.FROM_BTCLN], false, amountIn, resp.total, amountData.token, {}, preFetches.pricePrefetchPromise, abortController.signal),
                            this.verifyIntermediaryLiquidity(resp.total, liquidityPromise),
                            options.unsafeSkipLnNodeCheck ? Promise.resolve() : this.verifyLnNodeCapacity(lp, decodedPr, amountIn, lnCapacityPromise, abortController.signal)
                        ]);
                        const quote = new FromBTCLNSwap_1.FromBTCLNSwap(this, {
                            pricingInfo,
                            url: lp.url,
                            expiry: decodedPr.timeExpireDate * 1000,
                            swapFee: resp.swapFee,
                            feeRate: await preFetches.feeRatePromise,
                            initialSwapData: await this.contract.createSwapData(base_1.ChainSwapType.HTLC, lp.getAddress(this.chainIdentifier), signer, amountData.token, resp.total, claimHash.toString("hex"), this.getRandomSequence(), BigInt(Math.floor(Date.now() / 1000)), false, true, resp.securityDeposit, 0n, nativeTokenAddress),
                            pr: resp.pr,
                            secret: secret.toString("hex"),
                            exactIn: amountData.exactIn ?? true
                        });
                        await quote._save();
                        return quote;
                    }
                    catch (e) {
                        abortController.abort(e);
                        throw e;
                    }
                })()
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
    async getLNURLWithdraw(lnurl, abortSignal) {
        if (typeof (lnurl) !== "string")
            return lnurl;
        const res = await LNURL_1.LNURL.getLNURL(lnurl, true, this.options.getRequestTimeout, abortSignal);
        if (res == null)
            throw new UserError_1.UserError("Invalid LNURL");
        if (res.tag !== "withdrawRequest")
            throw new UserError_1.UserError("Not a LNURL-withdrawal");
        return res;
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
    async createViaLNURL(signer, lnurl, amountData, lps, additionalParams, abortSignal) {
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
            const withdrawRequest = await this.getLNURLWithdraw(lnurl, abortController.signal);
            const min = BigInt(withdrawRequest.minWithdrawable) / 1000n;
            const max = BigInt(withdrawRequest.maxWithdrawable) / 1000n;
            if (amountData.exactIn) {
                if (amountData.amount < min)
                    throw new UserError_1.UserError("Amount less than LNURL-withdraw minimum");
                if (amountData.amount > max)
                    throw new UserError_1.UserError("Amount more than LNURL-withdraw maximum");
            }
            else {
                const amount = await exactOutAmountPromise;
                abortController.signal.throwIfAborted();
                if ((amount * 95n / 100n) < min)
                    throw new UserError_1.UserError("Amount less than LNURL-withdraw minimum");
                if ((amount * 105n / 100n) > max)
                    throw new UserError_1.UserError("Amount more than LNURL-withdraw maximum");
            }
            return this.create(signer, amountData, lps, null, additionalParams, abortSignal, preFetches).map(data => {
                return {
                    quote: data.quote.then(quote => {
                        quote.lnurl = withdrawRequest.url;
                        quote.lnurlK1 = withdrawRequest.k1;
                        quote.lnurlCallback = withdrawRequest.callback;
                        const amountIn = quote.getInput().rawAmount;
                        if (amountIn < min)
                            throw new UserError_1.UserError("Amount less than LNURL-withdraw minimum");
                        if (amountIn > max)
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
    }
}
exports.FromBTCLNWrapper = FromBTCLNWrapper;
