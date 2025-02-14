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
exports.FromBTCWrapper = void 0;
const IFromBTCWrapper_1 = require("../IFromBTCWrapper");
const FromBTCSwap_1 = require("./FromBTCSwap");
const BN = require("bn.js");
const base_1 = require("@atomiqlabs/base");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const buffer_1 = require("buffer");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const SwapType_1 = require("../../SwapType");
const Utils_1 = require("../../../utils/Utils");
const IntermediaryAPI_1 = require("../../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../../errors/RequestError");
const randomBytes = require("randombytes");
class FromBTCWrapper extends IFromBTCWrapper_1.IFromBTCWrapper {
    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param chainEvents On-chain event listener
     * @param prices Pricing to use
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param btcRelay
     * @param synchronizer Btc relay synchronizer
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, btcRelay, synchronizer, btcRpc, options, events) {
        if (options == null)
            options = {};
        options.bitcoinNetwork = options.bitcoinNetwork || bitcoinjs_lib_1.networks.testnet;
        options.safetyFactor = options.safetyFactor || 2;
        options.blocksTillTxConfirms = options.blocksTillTxConfirms || 12;
        options.maxConfirmations = options.maxConfirmations || 6;
        options.minSendWindow = options.minSendWindow || 30 * 60; //Minimum time window for user to send in the on-chain funds for From BTC swap
        options.bitcoinBlocktime = options.bitcoinBlocktime || 10 * 60;
        super(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events);
        this.swapDeserializer = FromBTCSwap_1.FromBTCSwap;
        this.btcRelay = btcRelay;
        this.synchronizer = synchronizer;
        this.btcRpc = btcRpc;
    }
    checkPastSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swap.state === FromBTCSwap_1.FromBTCSwapState.PR_CREATED || swap.state === FromBTCSwap_1.FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
                const status = yield (0, Utils_1.tryWithRetries)(() => this.contract.getCommitStatus(swap.getInitiator(), swap.data));
                switch (status) {
                    case base_1.SwapCommitStatus.COMMITED:
                        swap.state = FromBTCSwap_1.FromBTCSwapState.CLAIM_COMMITED;
                        return true;
                    case base_1.SwapCommitStatus.EXPIRED:
                        swap.state = FromBTCSwap_1.FromBTCSwapState.QUOTE_EXPIRED;
                        return true;
                    case base_1.SwapCommitStatus.PAID:
                        swap.state = FromBTCSwap_1.FromBTCSwapState.CLAIM_CLAIMED;
                        return true;
                }
                if (!(yield swap.isQuoteValid())) {
                    swap.state = FromBTCSwap_1.FromBTCSwapState.QUOTE_EXPIRED;
                    return true;
                }
                return false;
            }
            if (swap.state === FromBTCSwap_1.FromBTCSwapState.CLAIM_COMMITED || swap.state === FromBTCSwap_1.FromBTCSwapState.BTC_TX_CONFIRMED || swap.state === FromBTCSwap_1.FromBTCSwapState.EXPIRED) {
                const status = yield (0, Utils_1.tryWithRetries)(() => this.contract.getCommitStatus(swap.getInitiator(), swap.data));
                switch (status) {
                    case base_1.SwapCommitStatus.PAID:
                        swap.state = FromBTCSwap_1.FromBTCSwapState.CLAIM_CLAIMED;
                        return true;
                    case base_1.SwapCommitStatus.NOT_COMMITED:
                    case base_1.SwapCommitStatus.EXPIRED:
                        swap.state = FromBTCSwap_1.FromBTCSwapState.FAILED;
                        return true;
                    case base_1.SwapCommitStatus.COMMITED:
                        const res = yield swap.getBitcoinPayment();
                        if (res != null && res.confirmations >= swap.requiredConfirmations) {
                            swap.txId = res.txId;
                            swap.vout = res.vout;
                            swap.state = FromBTCSwap_1.FromBTCSwapState.BTC_TX_CONFIRMED;
                            return true;
                        }
                        break;
                }
            }
        });
    }
    tickSwap(swap) {
        switch (swap.state) {
            case FromBTCSwap_1.FromBTCSwapState.PR_CREATED:
                if (swap.expiry < Date.now())
                    swap._saveAndEmit(FromBTCSwap_1.FromBTCSwapState.QUOTE_SOFT_EXPIRED);
                break;
            case FromBTCSwap_1.FromBTCSwapState.CLAIM_COMMITED:
                if (swap.getTimeoutTime() < Date.now())
                    swap._saveAndEmit(FromBTCSwap_1.FromBTCSwapState.EXPIRED);
            case FromBTCSwap_1.FromBTCSwapState.EXPIRED:
                //Check if bitcoin payment was received every 2 minutes
                if (Math.floor(Date.now() / 1000) % 120 === 0)
                    swap.getBitcoinPayment().then(res => {
                        if (res != null && res.confirmations >= swap.requiredConfirmations) {
                            swap.txId = res.txId;
                            swap.vout = res.vout;
                            return swap._saveAndEmit(FromBTCSwap_1.FromBTCSwapState.BTC_TX_CONFIRMED);
                        }
                    }).catch(e => this.logger.error("tickSwap(" + swap.getIdentifierHashString() + "): ", e));
                break;
        }
    }
    processEventInitialize(swap, event) {
        if (swap.state === FromBTCSwap_1.FromBTCSwapState.PR_CREATED || swap.state === FromBTCSwap_1.FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            swap.state = FromBTCSwap_1.FromBTCSwapState.CLAIM_COMMITED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventClaim(swap, event) {
        if (swap.state !== FromBTCSwap_1.FromBTCSwapState.FAILED) {
            swap.state = FromBTCSwap_1.FromBTCSwapState.CLAIM_CLAIMED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventRefund(swap, event) {
        if (swap.state !== FromBTCSwap_1.FromBTCSwapState.CLAIM_CLAIMED) {
            swap.state = FromBTCSwap_1.FromBTCSwapState.FAILED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    /**
     * Returns the swap expiry, leaving enough time for the user to send a transaction and for it to confirm
     *
     * @param data Parsed swap data
     * @param requiredConfirmations Confirmations required to claim the tx
     */
    getOnchainSendTimeout(data, requiredConfirmations) {
        const tsDelta = (this.options.blocksTillTxConfirms + requiredConfirmations) * this.options.bitcoinBlocktime * this.options.safetyFactor;
        return data.getExpiry().sub(new BN(tsDelta));
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
    preFetchClaimerBounty(signer, amountData, options, abortController) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTimestamp = new BN(Math.floor(Date.now() / 1000));
            const dummyAmount = new BN(randomBytes(3));
            const dummySwapData = yield this.contract.createSwapData(base_1.ChainSwapType.CHAIN, signer, signer, amountData.token, dummyAmount, this.contract.getHashForOnchain(randomBytes(20), dummyAmount, 3).toString("hex"), this.getRandomSequence(), new BN(Math.floor(Date.now() / 1000)), false, true, new BN(randomBytes(2)), new BN(randomBytes(2)));
            try {
                const [feePerBlock, btcRelayData, currentBtcBlock, claimFeeRate] = yield Promise.all([
                    (0, Utils_1.tryWithRetries)(() => this.btcRelay.getFeePerBlock(), null, null, abortController.signal),
                    (0, Utils_1.tryWithRetries)(() => this.btcRelay.getTipData(), null, null, abortController.signal),
                    this.btcRpc.getTipHeight(),
                    (0, Utils_1.tryWithRetries)(() => this.contract.getClaimFee(signer, dummySwapData), null, null, abortController.signal)
                ]);
                const currentBtcRelayBlock = btcRelayData.blockheight;
                const addBlock = Math.max(currentBtcBlock - currentBtcRelayBlock, 0);
                return {
                    feePerBlock: feePerBlock.mul(options.feeSafetyFactor),
                    safetyFactor: options.blockSafetyFactor,
                    startTimestamp: startTimestamp,
                    addBlock,
                    addFee: claimFeeRate.mul(options.feeSafetyFactor)
                };
            }
            catch (e) {
                abortController.abort(e);
                return null;
            }
        });
    }
    /**
     * Returns calculated claimer bounty calculated from the claimer bounty data as fetched from preFetchClaimerBounty()
     *
     * @param data Parsed swap data returned from the intermediary
     * @param options Options as passed to the swap creation function
     * @param claimerBounty Claimer bounty data as fetched from preFetchClaimerBounty() function
     * @private
     */
    getClaimerBounty(data, options, claimerBounty) {
        const tsDelta = data.getExpiry().sub(claimerBounty.startTimestamp);
        const blocksDelta = tsDelta.div(new BN(this.options.bitcoinBlocktime)).mul(new BN(options.blockSafetyFactor));
        const totalBlock = blocksDelta.add(new BN(claimerBounty.addBlock));
        return claimerBounty.addFee.add(totalBlock.mul(claimerBounty.feePerBlock));
    }
    /**
     * Verifies response returned from intermediary
     *
     * @param resp Response as returned by the intermediary
     * @param amountData
     * @param lp Intermediary
     * @param options Options as passed to the swap creation function
     * @param data Parsed swap data returned by the intermediary
     * @param sequence Required swap sequence
     * @param claimerBounty Claimer bount data as returned from the preFetchClaimerBounty() pre-fetch promise
     * @param depositToken
     * @private
     * @throws {IntermediaryError} in case the response is invalid
     */
    verifyReturnedData(resp, amountData, lp, options, data, sequence, claimerBounty, depositToken) {
        var _a;
        if (amountData.exactIn) {
            if (!resp.amount.eq(amountData.amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid amount returned");
        }
        else {
            if (!resp.total.eq(amountData.amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid total returned");
        }
        const requiredConfirmations = (_a = resp.confirmations) !== null && _a !== void 0 ? _a : lp.services[SwapType_1.SwapType.FROM_BTC].data.confirmations;
        if (requiredConfirmations > this.options.maxConfirmations)
            throw new IntermediaryError_1.IntermediaryError("Requires too many confirmations");
        const totalClaimerBounty = this.getClaimerBounty(data, options, claimerBounty);
        if (!data.getClaimerBounty().eq(totalClaimerBounty) ||
            data.getType() != base_1.ChainSwapType.CHAIN ||
            !data.getSequence().eq(sequence) ||
            !data.getAmount().eq(resp.total) ||
            data.isPayIn() ||
            !data.isToken(amountData.token) ||
            data.getOfferer() !== lp.getAddress(this.chainIdentifier) ||
            data.isDepositToken(depositToken)) {
            throw new IntermediaryError_1.IntermediaryError("Invalid data returned");
        }
        //Check that we have enough time to send the TX and for it to confirm
        const expiry = this.getOnchainSendTimeout(data, requiredConfirmations);
        const currentTimestamp = new BN(Math.floor(Date.now() / 1000));
        if (expiry.sub(currentTimestamp).lt(new BN(this.options.minSendWindow))) {
            throw new IntermediaryError_1.IntermediaryError("Send window too low");
        }
        const lockingScript = bitcoinjs_lib_1.address.toOutputScript(resp.btcAddress, this.options.bitcoinNetwork);
        const desiredExtraData = this.contract.getExtraData(lockingScript, resp.amount, requiredConfirmations);
        const desiredClaimHash = this.contract.getHashForOnchain(lockingScript, resp.amount, requiredConfirmations);
        if (!desiredClaimHash.equals(buffer_1.Buffer.from(data.getClaimHash(), "hex"))) {
            throw new IntermediaryError_1.IntermediaryError("Invalid claim hash returned!");
        }
        if (!desiredExtraData.equals(buffer_1.Buffer.from(data.getExtraData(), "hex"))) {
            throw new IntermediaryError_1.IntermediaryError("Invalid extra data returned!");
        }
    }
    /**
     * Returns a newly created swap, receiving 'amount' on chain
     *
     * @param signer                Smartchain signer's address intiating the swap
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    create(signer, amountData, lps, options, additionalParams, abortSignal) {
        var _a, _b;
        options !== null && options !== void 0 ? options : (options = {});
        (_a = options.blockSafetyFactor) !== null && _a !== void 0 ? _a : (options.blockSafetyFactor = 1);
        (_b = options.feeSafetyFactor) !== null && _b !== void 0 ? _b : (options.feeSafetyFactor = new BN(2));
        const sequence = this.getRandomSequence();
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        const pricePrefetchPromise = this.preFetchPrice(amountData, _abortController.signal);
        const claimerBountyPrefetchPromise = this.preFetchClaimerBounty(signer, amountData, options, _abortController);
        const nativeTokenAddress = this.contract.getNativeCurrencyAddress();
        const feeRatePromise = this.preFetchFeeRate(signer, amountData, null, _abortController);
        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: (() => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b;
                    const abortController = (0, Utils_1.extendAbortController)(_abortController.signal);
                    const liquidityPromise = this.preFetchIntermediaryLiquidity(amountData, lp, abortController);
                    try {
                        const { signDataPromise, resp } = yield (0, Utils_1.tryWithRetries)((retryCount) => __awaiter(this, void 0, void 0, function* () {
                            const { signDataPrefetch, response } = IntermediaryAPI_1.IntermediaryAPI.initFromBTC(this.chainIdentifier, lp.url, nativeTokenAddress, {
                                claimer: signer,
                                amount: amountData.amount,
                                token: amountData.token.toString(),
                                exactOut: !amountData.exactIn,
                                sequence,
                                claimerBounty: claimerBountyPrefetchPromise,
                                feeRate: feeRatePromise,
                                additionalParams
                            }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                            return {
                                signDataPromise: this.preFetchSignData(signDataPrefetch),
                                resp: yield response
                            };
                        }), null, e => e instanceof RequestError_1.RequestError, abortController.signal);
                        const data = new this.swapDataDeserializer(resp.data);
                        data.setClaimer(signer);
                        this.verifyReturnedData(resp, amountData, lp, options, data, sequence, yield claimerBountyPrefetchPromise, nativeTokenAddress);
                        const [pricingInfo, signatureExpiry] = yield Promise.all([
                            //Get intermediary's liquidity
                            this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.FROM_BTC], false, resp.amount, resp.total, amountData.token, resp, pricePrefetchPromise, abortController.signal),
                            this.verifyReturnedSignature(data, resp, feeRatePromise, signDataPromise, abortController.signal),
                            this.verifyIntermediaryLiquidity(data.getAmount(), liquidityPromise),
                        ]);
                        const quote = new FromBTCSwap_1.FromBTCSwap(this, {
                            pricingInfo,
                            url: lp.url,
                            expiry: signatureExpiry,
                            swapFee: resp.swapFee,
                            feeRate: yield feeRatePromise,
                            signatureData: resp,
                            data,
                            address: resp.btcAddress,
                            amount: resp.amount,
                            exactIn: (_a = amountData.exactIn) !== null && _a !== void 0 ? _a : true,
                            requiredConfirmations: (_b = resp.confirmations) !== null && _b !== void 0 ? _b : lp.services[SwapType_1.SwapType.FROM_BTC].data.confirmations
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
}
exports.FromBTCWrapper = FromBTCWrapper;
