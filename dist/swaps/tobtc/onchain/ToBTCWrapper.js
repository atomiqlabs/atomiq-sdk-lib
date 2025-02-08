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
exports.ToBTCWrapper = void 0;
const ToBTCSwap_1 = require("./ToBTCSwap");
const IToBTCWrapper_1 = require("../IToBTCWrapper");
const base_1 = require("@atomiqlabs/base");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const BN = require("bn.js");
const buffer_1 = require("buffer");
const randomBytes = require("randombytes");
const UserError_1 = require("../../../errors/UserError");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const SwapType_1 = require("../../SwapType");
const Utils_1 = require("../../../utils/Utils");
const IntermediaryAPI_1 = require("../../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../../errors/RequestError");
class ToBTCWrapper extends IToBTCWrapper_1.IToBTCWrapper {
    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Chain specific swap contract
     * @param prices Swap pricing handler
     * @param chainEvents Smart chain on-chain event listener
     * @param tokens
     * @param swapDataDeserializer Deserializer for chain specific SwapData
     * @param btcRpc Bitcoin RPC api
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, btcRpc, options, events) {
        if (options == null)
            options = {};
        options.bitcoinNetwork = options.bitcoinNetwork || bitcoinjs_lib_1.networks.testnet;
        options.safetyFactor = options.safetyFactor || 2;
        options.maxConfirmations = options.maxConfirmations || 6;
        options.bitcoinBlocktime = options.bitcoinBlocktime || (60 * 10);
        options.maxExpectedOnchainSendSafetyFactor = options.maxExpectedOnchainSendSafetyFactor || 4;
        options.maxExpectedOnchainSendGracePeriodBlocks = options.maxExpectedOnchainSendGracePeriodBlocks || 12;
        super(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events);
        this.swapDeserializer = ToBTCSwap_1.ToBTCSwap;
        this.btcRpc = btcRpc;
    }
    /**
     * Returns randomly generated random escrow nonce to be used for to BTC on-chain swaps
     * @private
     * @returns Escrow nonce
     */
    getRandomNonce() {
        const firstPart = new BN(Math.floor((Date.now() / 1000)) - 700000000);
        const nonceBuffer = buffer_1.Buffer.concat([
            buffer_1.Buffer.from(firstPart.toArray("be", 5)),
            randomBytes(3)
        ]);
        return new BN(nonceBuffer, "be");
    }
    /**
     * Converts bitcoin address to its corresponding output script
     *
     * @param addr Bitcoin address to get the output script for
     * @private
     * @returns Output script as Buffer
     * @throws {UserError} if invalid address is specified
     */
    btcAddressToOutputScript(addr) {
        try {
            return bitcoinjs_lib_1.address.toOutputScript(addr, this.options.bitcoinNetwork);
        }
        catch (e) {
            throw new UserError_1.UserError("Invalid address specified");
        }
    }
    /**
     * Verifies returned LP data
     *
     * @param resp LP's response
     * @param amountData
     * @param lp
     * @param options Options as passed to the swap create function
     * @param data LP's returned parsed swap data
     * @param hash Payment hash of the swap
     * @private
     * @throws {IntermediaryError} if returned data are not correct
     */
    verifyReturnedData(resp, amountData, lp, options, data, hash) {
        if (!resp.totalFee.eq(resp.swapFee.add(resp.networkFee)))
            throw new IntermediaryError_1.IntermediaryError("Invalid totalFee returned");
        if (amountData.exactIn) {
            if (!resp.total.eq(amountData.amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid total returned");
        }
        else {
            if (!resp.amount.eq(amountData.amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid amount returned");
        }
        const maxAllowedBlockDelta = new BN(options.confirmations +
            options.confirmationTarget +
            this.options.maxExpectedOnchainSendGracePeriodBlocks);
        const maxAllowedExpiryDelta = maxAllowedBlockDelta
            .muln(this.options.maxExpectedOnchainSendSafetyFactor)
            .muln(this.options.bitcoinBlocktime);
        const currentTimestamp = new BN(Math.floor(Date.now() / 1000));
        const maxAllowedExpiryTimestamp = currentTimestamp.add(maxAllowedExpiryDelta);
        if (data.getExpiry().gt(maxAllowedExpiryTimestamp)) {
            throw new IntermediaryError_1.IntermediaryError("Expiry time returned too high!");
        }
        if (!data.getAmount().eq(resp.total) ||
            data.getClaimHash() !== hash ||
            data.getType() !== base_1.ChainSwapType.CHAIN_NONCED ||
            !data.isPayIn() ||
            !data.isToken(amountData.token) ||
            data.getClaimer() !== lp.getAddress(this.chainIdentifier)) {
            throw new IntermediaryError_1.IntermediaryError("Invalid data returned");
        }
    }
    /**
     * Returns quotes fetched from LPs, paying to an 'address' - a bitcoin address
     *
     * @param signer                Smart-chain signer address initiating the swap
     * @param address               Bitcoin on-chain address you wish to pay to
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    create(signer, address, amountData, lps, options, additionalParams, abortSignal) {
        var _a, _b;
        if (!this.isInitialized)
            throw new Error("Not initialized, call init() first!");
        options !== null && options !== void 0 ? options : (options = {});
        (_a = options.confirmationTarget) !== null && _a !== void 0 ? _a : (options.confirmationTarget = 3);
        (_b = options.confirmations) !== null && _b !== void 0 ? _b : (options.confirmations = 2);
        const nonce = this.getRandomNonce();
        const outputScript = this.btcAddressToOutputScript(address);
        const _hash = !amountData.exactIn ?
            this.contract.getHashForOnchain(outputScript, amountData.amount, options.confirmations, nonce).toString("hex") :
            null;
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        const pricePreFetchPromise = this.preFetchPrice(amountData, _abortController.signal);
        const feeRatePromise = this.preFetchFeeRate(signer, amountData, _hash, _abortController);
        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: (() => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const abortController = (0, Utils_1.extendAbortController)(_abortController.signal);
                    const reputationPromise = this.preFetchIntermediaryReputation(amountData, lp, abortController);
                    try {
                        const { signDataPromise, resp } = yield (0, Utils_1.tryWithRetries)((retryCount) => __awaiter(this, void 0, void 0, function* () {
                            const { signDataPrefetch, response } = IntermediaryAPI_1.IntermediaryAPI.initToBTC(this.chainIdentifier, lp.url, {
                                btcAddress: address,
                                amount: amountData.amount,
                                confirmationTarget: options.confirmationTarget,
                                confirmations: options.confirmations,
                                nonce: nonce,
                                token: amountData.token,
                                offerer: signer,
                                exactIn: amountData.exactIn,
                                feeRate: feeRatePromise,
                                additionalParams
                            }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                            return {
                                signDataPromise: this.preFetchSignData(signDataPrefetch),
                                resp: yield response
                            };
                        }), null, RequestError_1.RequestError, abortController.signal);
                        let hash = amountData.exactIn ?
                            this.contract.getHashForOnchain(outputScript, resp.amount, options.confirmations, nonce).toString("hex") :
                            _hash;
                        const data = new this.swapDataDeserializer(resp.data);
                        data.setOfferer(signer);
                        this.verifyReturnedData(resp, amountData, lp, options, data, hash);
                        const [pricingInfo, signatureExpiry, reputation] = yield Promise.all([
                            this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.TO_BTC], true, resp.amount, data.getAmount(), amountData.token, resp, pricePreFetchPromise, abortController.signal),
                            this.verifyReturnedSignature(data, resp, feeRatePromise, signDataPromise, abortController.signal),
                            reputationPromise
                        ]);
                        abortController.signal.throwIfAborted();
                        const quote = new ToBTCSwap_1.ToBTCSwap(this, {
                            pricingInfo,
                            url: lp.url,
                            expiry: signatureExpiry,
                            swapFee: resp.swapFee,
                            feeRate: yield feeRatePromise,
                            signatureData: resp,
                            data,
                            networkFee: resp.networkFee,
                            address,
                            amount: resp.amount,
                            confirmationTarget: options.confirmationTarget,
                            satsPerVByte: resp.satsPervByte.toNumber(),
                            exactIn: (_a = amountData.exactIn) !== null && _a !== void 0 ? _a : false,
                            requiredConfirmations: options.confirmations,
                            nonce
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
exports.ToBTCWrapper = ToBTCWrapper;
