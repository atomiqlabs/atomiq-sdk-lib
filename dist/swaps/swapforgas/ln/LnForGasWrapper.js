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
exports.LnForGasWrapper = void 0;
const BN = require("bn.js");
const LnForGasSwap_1 = require("./LnForGasSwap");
const ISwapWrapper_1 = require("../../ISwapWrapper");
const TrustedIntermediaryAPI_1 = require("../../../intermediaries/TrustedIntermediaryAPI");
const bolt11_1 = require("bolt11");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const SwapType_1 = require("../../SwapType");
class LnForGasWrapper extends ISwapWrapper_1.ISwapWrapper {
    constructor() {
        super(...arguments);
        this.swapDeserializer = LnForGasSwap_1.LnForGasSwap;
    }
    /**
     * Returns a newly created swap, receiving 'amount' on lightning network
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units (satoshis)
     * @param lpOrUrl           Intermediary/Counterparty swap service Intermediary object or raw url
     */
    create(signer, amount, lpOrUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isInitialized)
                throw new Error("Not initialized, call init() first!");
            const lpUrl = typeof (lpOrUrl) === "string" ? lpOrUrl : lpOrUrl.url;
            const resp = yield TrustedIntermediaryAPI_1.TrustedIntermediaryAPI.initTrustedFromBTCLN(this.chainIdentifier, lpUrl, {
                address: signer,
                amount,
                token: this.contract.getNativeCurrencyAddress()
            }, this.options.getRequestTimeout);
            const decodedPr = (0, bolt11_1.decode)(resp.pr);
            const amountIn = new BN(decodedPr.millisatoshis).add(new BN(999)).div(new BN(1000));
            if (!resp.total.eq(amount))
                throw new IntermediaryError_1.IntermediaryError("Invalid total returned");
            const pricingInfo = yield this.verifyReturnedPrice(typeof (lpOrUrl) === "string" ?
                { swapFeePPM: 10000, swapBaseFee: 10 } :
                lpOrUrl.services[SwapType_1.SwapType.TRUSTED_FROM_BTCLN], false, amountIn, amount, this.contract.getNativeCurrencyAddress(), resp);
            const quote = new LnForGasSwap_1.LnForGasSwap(this, {
                pr: resp.pr,
                outputAmount: resp.total,
                recipient: signer,
                pricingInfo,
                url: lpUrl,
                expiry: decodedPr.timeExpireDate * 1000,
                swapFee: resp.swapFee,
                feeRate: "",
                exactIn: false
            });
            yield quote._save();
            return quote;
        });
    }
    checkPastSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swap.state === LnForGasSwap_1.LnForGasSwapState.PR_CREATED) {
                //Check if it's maybe already paid
                const res = yield swap.checkInvoicePaid(false);
                if (res !== null)
                    return true;
            }
            return false;
        });
    }
    isOurSwap(signer, swap) {
        return signer === swap.getRecipient();
    }
    tickSwap(swap) { }
}
exports.LnForGasWrapper = LnForGasWrapper;
