"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FromBTCLNAutoWrapper = void 0;
const bolt11_1 = require("@atomiqlabs/bolt11");
const base_1 = require("@atomiqlabs/base");
const buffer_1 = require("buffer");
const UserError_1 = require("../../../../errors/UserError");
const IntermediaryError_1 = require("../../../../errors/IntermediaryError");
const SwapType_1 = require("../../../enums/SwapType");
const Utils_1 = require("../../../../utils/Utils");
const IntermediaryAPI_1 = require("../../../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../../../errors/RequestError");
const FromBTCLNAutoSwap_1 = require("./FromBTCLNAutoSwap");
const IFromBTCLNWrapper_1 = require("../IFromBTCLNWrapper");
class FromBTCLNAutoWrapper extends IFromBTCLNWrapper_1.IFromBTCLNWrapper {
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
     * @param messenger
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, contract, prices, tokens, swapDataDeserializer, lnApi, messenger, options, events) {
        super(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, contract, prices, tokens, swapDataDeserializer, lnApi, options, events);
        this.TYPE = SwapType_1.SwapType.FROM_BTCLN_AUTO;
        this.swapDeserializer = FromBTCLNAutoSwap_1.FromBTCLNAutoSwap;
        this.pendingSwapStates = [
            FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.PR_CREATED,
            FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.PR_PAID,
            FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.CLAIM_COMMITED,
            FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.EXPIRED
        ];
        this.tickSwapState = [
            FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.PR_CREATED,
            FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.PR_PAID,
            FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.CLAIM_COMMITED
        ];
        this.messenger = messenger;
    }
    processEventInitialize(swap, event) {
        if (swap.state === FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.PR_PAID || swap.state === FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.PR_CREATED) {
            swap.state = FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.CLAIM_COMMITED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventClaim(swap, event) {
        if (swap.state !== FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.FAILED && swap.state !== FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.CLAIM_CLAIMED) {
            swap.state = FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.CLAIM_CLAIMED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventRefund(swap, event) {
        if (swap.state !== FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.CLAIM_CLAIMED && swap.state !== FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.FAILED) {
            swap.state = FromBTCLNAutoSwap_1.FromBTCLNAutoSwapState.FAILED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    /**
     * Pre-fetches claimer (watchtower) bounty data for the swap. Doesn't throw, instead returns null and aborts the
     *  provided abortController
     *
     * @param signer Smartchain signer address initiating the swap
     * @param amountData
     * @param options Options as passed to the swap creation function
     * @param abortController
     * @private
     */
    async preFetchClaimerBounty(signer, amountData, options, abortController) {
        if (options.unsafeZeroWatchtowerFee)
            return 0n;
        const dummyAmount = BigInt(Math.floor(Math.random() * 0x1000000));
        const dummySwapData = await this.contract.createSwapData(base_1.ChainSwapType.CHAIN, this.chain.randomAddress(), signer, amountData.token, dummyAmount, this.contract.getHashForOnchain((0, Utils_1.randomBytes)(20), dummyAmount, 3).toString("hex"), this.getRandomSequence(), BigInt(Math.floor(Date.now() / 1000)), false, true, BigInt(Math.floor(Math.random() * 0x10000)), BigInt(Math.floor(Math.random() * 0x10000)));
        return (0, Utils_1.tryWithRetries)(() => this.contract.getClaimFee(this.chain.randomAddress(), dummySwapData), null, null, abortController.signal).catch(e => {
            abortController.abort(e);
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
     * @param paymentHash Expected payment hash of the bolt11 lightning network invoice
     * @param claimerBounty Claimer bounty as request by the user
     * @private
     * @throws {IntermediaryError} in case the response is invalid
     */
    verifyReturnedData(resp, amountData, lp, options, decodedPr, paymentHash, claimerBounty) {
        if (lp.getAddress(this.chainIdentifier) !== resp.intermediaryKey)
            throw new IntermediaryError_1.IntermediaryError("Invalid intermediary address/pubkey");
        if (options.descriptionHash != null && decodedPr.tagsObject.purpose_commit_hash !== options.descriptionHash.toString("hex"))
            throw new IntermediaryError_1.IntermediaryError("Invalid pr returned - description hash");
        if (!buffer_1.Buffer.from(decodedPr.tagsObject.payment_hash, "hex").equals(paymentHash))
            throw new IntermediaryError_1.IntermediaryError("Invalid pr returned - payment hash");
        const amountIn = (BigInt(decodedPr.millisatoshis) + 999n) / 1000n;
        if (resp.btcAmountGas + resp.btcAmountSwap !== amountIn)
            throw new IntermediaryError_1.IntermediaryError("Invalid total btc returned");
        if (resp.gasSwapFeeBtc + resp.swapFeeBtc !== resp.totalFeeBtc)
            throw new IntermediaryError_1.IntermediaryError("Invalid total btc fee returned");
        if (resp.claimerBounty !== claimerBounty)
            throw new IntermediaryError_1.IntermediaryError("Invalid claimer bounty");
        if (resp.totalGas !== claimerBounty + options.gasAmount)
            throw new IntermediaryError_1.IntermediaryError("Invalid total gas amount");
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
        options.gasAmount ??= 0n;
        if (preFetches == null)
            preFetches = {};
        if (options.descriptionHash != null && options.descriptionHash.length !== 32)
            throw new UserError_1.UserError("Invalid description hash length");
        const { secret, paymentHash } = this.getSecretAndHash();
        const claimHash = this.contract.getHashForHtlc(paymentHash);
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        preFetches.pricePrefetchPromise ??= this.preFetchPrice(amountData, _abortController.signal);
        const nativeTokenAddress = this.chain.getNativeCurrencyAddress();
        preFetches.claimerBountyPrefetch ??= this.preFetchClaimerBounty(signer, amountData, options, _abortController);
        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: (async () => {
                    const abortController = (0, Utils_1.extendAbortController)(_abortController.signal);
                    const liquidityPromise = this.preFetchIntermediaryLiquidity(amountData, lp, abortController);
                    const { lnCapacityPromise, resp } = await (0, Utils_1.tryWithRetries)(async (retryCount) => {
                        const { lnPublicKey, response } = IntermediaryAPI_1.IntermediaryAPI.initFromBTCLNAuto(this.chainIdentifier, lp.url, {
                            paymentHash,
                            amount: amountData.amount,
                            claimer: signer,
                            token: amountData.token.toString(),
                            descriptionHash: options.descriptionHash,
                            exactOut: !amountData.exactIn,
                            additionalParams,
                            gasToken: this.chain.getNativeCurrencyAddress(),
                            gasAmount: options.gasAmount,
                            claimerBounty: preFetches.claimerBountyPrefetch
                        }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                        return {
                            lnCapacityPromise: options.unsafeSkipLnNodeCheck ? null : this.preFetchLnCapacity(lnPublicKey),
                            resp: await response
                        };
                    }, null, RequestError_1.RequestError, abortController.signal);
                    const decodedPr = (0, bolt11_1.decode)(resp.pr);
                    const amountIn = (BigInt(decodedPr.millisatoshis) + 999n) / 1000n;
                    const claimerBounty = await preFetches.claimerBountyPrefetch;
                    try {
                        this.verifyReturnedData(resp, amountData, lp, options, decodedPr, paymentHash, claimerBounty);
                        const [pricingInfo] = await Promise.all([
                            this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.FROM_BTCLN], false, amountIn, resp.total, amountData.token, {}, preFetches.pricePrefetchPromise, abortController.signal),
                            this.verifyIntermediaryLiquidity(resp.total, liquidityPromise),
                            options.unsafeSkipLnNodeCheck ? Promise.resolve() : this.verifyLnNodeCapacity(lp, decodedPr, lnCapacityPromise, abortController.signal)
                        ]);
                        const swapInit = {
                            pricingInfo,
                            url: lp.url,
                            expiry: decodedPr.timeExpireDate * 1000,
                            swapFee: resp.swapFee,
                            gasSwapFee: resp.gasSwapFee,
                            swapFeeBtc: resp.swapFeeBtc,
                            gasSwapFeeBtc: resp.gasSwapFeeBtc,
                            btcAmountGas: resp.btcAmountGas,
                            btcAmountSwap: resp.btcAmountSwap,
                            initialSwapData: await this.contract.createSwapData(base_1.ChainSwapType.HTLC, lp.getAddress(this.chainIdentifier), signer, amountData.token, resp.total, claimHash.toString("hex"), this.getRandomSequence(), BigInt(Math.floor(Date.now() / 1000)), false, true, options.gasAmount + claimerBounty, claimerBounty, nativeTokenAddress),
                            pr: resp.pr,
                            secret: secret.toString("hex"),
                            exactIn: amountData.exactIn ?? true
                        };
                        const quote = new FromBTCLNAutoSwap_1.FromBTCLNAutoSwap(this, swapInit);
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
     * Returns a newly created swap, receiving 'amount' from the lnurl-withdraw
     *
     * @param signer                Smart chains signer's address intiating the swap
     * @param lnurl                 LNURL-withdraw to withdraw funds from
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    async createViaLNURL(signer, lnurl, amountData, lps, options, additionalParams, abortSignal) {
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
            return this.create(signer, amountData, lps, options, additionalParams, abortSignal, preFetches).map(data => {
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
exports.FromBTCLNAutoWrapper = FromBTCLNAutoWrapper;
