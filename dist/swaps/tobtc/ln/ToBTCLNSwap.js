"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToBTCLNSwap = exports.isToBTCLNSwapInit = void 0;
const bolt11_1 = require("bolt11");
const IToBTCSwap_1 = require("../IToBTCSwap");
const SwapType_1 = require("../../SwapType");
const BN = require("bn.js");
const buffer_1 = require("buffer");
const createHash = require("create-hash");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const LNURL_1 = require("../../../utils/LNURL");
const Tokens_1 = require("../../Tokens");
function isToBTCLNSwapInit(obj) {
    return typeof (obj.confidence) === "number" &&
        typeof (obj.pr) === "string" &&
        (obj.lnurl == null || typeof (obj.lnurl) === "string") &&
        (obj.successAction == null || (0, LNURL_1.isLNURLPaySuccessAction)(obj.successAction)) &&
        (0, IToBTCSwap_1.isIToBTCSwapInit)(obj);
}
exports.isToBTCLNSwapInit = isToBTCLNSwapInit;
class ToBTCLNSwap extends IToBTCSwap_1.IToBTCSwap {
    constructor(wrapper, initOrObj) {
        if (isToBTCLNSwapInit(initOrObj))
            initOrObj.url += "/tobtcln";
        super(wrapper, initOrObj);
        this.outputToken = Tokens_1.BitcoinTokens.BTCLN;
        this.TYPE = SwapType_1.SwapType.TO_BTCLN;
        if (!isToBTCLNSwapInit(initOrObj)) {
            this.confidence = initOrObj.confidence;
            this.pr = initOrObj.pr;
            this.lnurl = initOrObj.lnurl;
            this.successAction = initOrObj.successAction;
            this.secret = initOrObj.secret;
        }
        this.tryCalculateSwapFee();
    }
    _setPaymentResult(result, check = false) {
        if (result == null)
            return Promise.resolve(false);
        if (result.secret == null)
            throw new IntermediaryError_1.IntermediaryError("No payment secret returned!");
        if (check) {
            const secretBuffer = buffer_1.Buffer.from(result.secret, "hex");
            const hash = createHash("sha256").update(secretBuffer).digest();
            const paymentHashBuffer = buffer_1.Buffer.from(this.data.getHash(), "hex");
            if (!hash.equals(paymentHashBuffer))
                throw new IntermediaryError_1.IntermediaryError("Invalid payment secret returned");
        }
        this.secret = result.secret;
        return Promise.resolve(true);
    }
    //////////////////////////////
    //// Amounts & fees
    getOutput() {
        const parsedPR = (0, bolt11_1.decode)(this.pr);
        const amount = new BN(parsedPR.millisatoshis).add(new BN(999)).div(new BN(1000));
        return (0, Tokens_1.toTokenAmount)(amount, this.outputToken, this.wrapper.prices);
    }
    //////////////////////////////
    //// Getters & utils
    /**
     * Returns the lightning BOLT11 invoice where the BTC will be sent to
     */
    getLightningInvoice() {
        return this.pr;
    }
    /**
     * Returns payment secret (pre-image) as a proof of payment
     */
    getSecret() {
        return this.secret;
    }
    /**
     * Returns the confidence of the intermediary that this payment will succeed
     * Value between 0 and 1, where 0 is not likely and 1 is very likely
     */
    getConfidence() {
        return this.confidence;
    }
    getPaymentHash() {
        if (this.pr == null)
            return null;
        const parsed = (0, bolt11_1.decode)(this.pr);
        return buffer_1.Buffer.from(parsed.tagsObject.payment_hash, "hex");
    }
    getRecipient() {
        var _a;
        return (_a = this.lnurl) !== null && _a !== void 0 ? _a : this.pr;
    }
    //////////////////////////////
    //// LNURL-pay
    /**
     * Is this an LNURL-pay swap?
     */
    isLNURL() {
        return this.lnurl != null;
    }
    /**
     * Gets the used LNURL or null if this is not an LNURL-pay swap
     */
    getLNURL() {
        return this.lnurl;
    }
    /**
     * Checks whether this LNURL payment contains a success message
     */
    hasSuccessAction() {
        return this.successAction != null;
    }
    /**
     * Returns the success action after a successful payment, else null
     */
    getSuccessAction() {
        return LNURL_1.LNURL.decodeSuccessAction(this.successAction, this.secret);
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return Object.assign(Object.assign({}, super.serialize()), { pr: this.pr, confidence: this.confidence, secret: this.secret, lnurl: this.lnurl, successAction: this.successAction });
    }
}
exports.ToBTCLNSwap = ToBTCLNSwap;
