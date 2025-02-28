"use strict";
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
    async create(signer, amount, lpOrUrl, refundAddress) {
        if (!this.isInitialized)
            throw new Error("Not initialized, call init() first!");
        const lpUrl = typeof (lpOrUrl) === "string" ? lpOrUrl : lpOrUrl.url;
        const token = this.contract.getNativeCurrencyAddress();
        const resp = await TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.initTrustedFromBTC(this.chainIdentifier, lpUrl, {
            address: signer,
            amount,
            refundAddress,
            token
        }, this.options.getRequestTimeout);
        if (resp.total !== amount)
            throw new IntermediaryError_1.IntermediaryError("Invalid total returned");
        const pricingInfo = await this.verifyReturnedPrice(typeof (lpOrUrl) === "string" ?
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
        await quote._save();
        return quote;
    }
    async checkPastSwap(swap) {
        if (swap.state === OnchainForGasSwap_1.OnchainForGasSwapState.PR_CREATED) {
            //Check if it's maybe already paid
            return await swap.checkAddress(false);
        }
        return false;
    }
    isOurSwap(signer, swap) {
        return signer === swap.getRecipient();
    }
    tickSwap(swap) { }
}
exports.OnchainForGasWrapper = OnchainForGasWrapper;
