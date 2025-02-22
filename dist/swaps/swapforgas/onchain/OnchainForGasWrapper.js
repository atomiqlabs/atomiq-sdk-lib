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
exports.OnchainForGasWrapper = void 0;
const ISwapWrapper_1 = require("../../ISwapWrapper");
const TrustedIntermediaryAPI_1 = require("../../../intermediaries/TrustedIntermediaryAPI");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const OnchainForGasSwap_1 = require("./OnchainForGasSwap");
const SwapType_1 = require("../../SwapType");
class OnchainForGasWrapper extends ISwapWrapper_1.ISwapWrapper {
    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param chainEvents On-chain event listener
     * @param prices Pricing to use
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, btcRpc, options, events) {
        super(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events);
        this.swapDeserializer = OnchainForGasSwap_1.OnchainForGasSwap;
        this.btcRpc = btcRpc;
    }
    /**
     * Returns a newly created swap, receiving 'amount' base units of gas token
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units
     * @param lpOrUrl           Intermediary/Counterparty swap service Intermediary object or raw url
     * @param refundAddress     Bitcoin address to receive refund on in case the counterparty cannot execute the swap
     */
    create(signer, amount, lpOrUrl, refundAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isInitialized)
                throw new Error("Not initialized, call init() first!");
            const lpUrl = typeof (lpOrUrl) === "string" ? lpOrUrl : lpOrUrl.url;
            const token = this.contract.getNativeCurrencyAddress();
            const resp = yield TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.initTrustedFromBTC(this.chainIdentifier, lpUrl, {
                address: signer,
                amount,
                refundAddress,
                token
            }, this.options.getRequestTimeout);
            if (!resp.total.eq(amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid total returned");
            const pricingInfo = yield this.verifyReturnedPrice(typeof (lpOrUrl) === "string" ?
                { swapFeePPM: 10000, swapBaseFee: 10 } :
                lpOrUrl.services[SwapType_1.SwapType.TRUSTED_FROM_BTC], false, resp.amountSats, amount, this.contract.getNativeCurrencyAddress(), resp);
            const quote = new OnchainForGasSwap_1.OnchainForGasSwap(this, {
                paymentHash: resp.paymentHash,
                sequence: resp.sequence,
                address: resp.btcAddress,
                inputAmount: resp.amountSats,
                outputAmount: resp.total,
                recipient: signer,
                refundAddress,
                pricingInfo,
                url: lpUrl,
                expiry: resp.expiresAt,
                swapFee: resp.swapFee,
                swapFeeBtc: resp.swapFeeSats,
                feeRate: "",
                exactIn: false,
                token
            });
            yield quote._save();
            return quote;
        });
    }
    checkPastSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swap.state === OnchainForGasSwap_1.OnchainForGasSwapState.PR_CREATED) {
                //Check if it's maybe already paid
                return yield swap.checkAddress(false);
            }
            return false;
        });
    }
    isOurSwap(signer, swap) {
        return signer === swap.getRecipient();
    }
    tickSwap(swap) { }
}
exports.OnchainForGasWrapper = OnchainForGasWrapper;
