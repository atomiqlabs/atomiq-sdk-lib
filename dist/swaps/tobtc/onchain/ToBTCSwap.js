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
exports.ToBTCSwap = exports.isToBTCSwapInit = void 0;
const IToBTCSwap_1 = require("../IToBTCSwap");
const SwapType_1 = require("../../SwapType");
const BN = require("bn.js");
const buffer_1 = require("buffer");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const Tokens_1 = require("../../Tokens");
function isToBTCSwapInit(obj) {
    return typeof (obj.address) === "string" &&
        BN.isBN(obj.amount) &&
        typeof (obj.confirmationTarget) === "number" &&
        typeof (obj.satsPerVByte) === "number" &&
        (0, IToBTCSwap_1.isIToBTCSwapInit)(obj);
}
exports.isToBTCSwapInit = isToBTCSwapInit;
class ToBTCSwap extends IToBTCSwap_1.IToBTCSwap {
    constructor(wrapper, initOrObject) {
        var _a, _b;
        if (isToBTCSwapInit(initOrObject))
            initOrObject.url += "/tobtc";
        super(wrapper, initOrObject);
        this.outputToken = Tokens_1.BitcoinTokens.BTC;
        this.TYPE = SwapType_1.SwapType.TO_BTC;
        if (!isToBTCSwapInit(initOrObject)) {
            this.address = initOrObject.address;
            this.amount = new BN(initOrObject.amount);
            this.confirmationTarget = initOrObject.confirmationTarget;
            this.satsPerVByte = initOrObject.satsPerVByte;
            this.txId = initOrObject.txId;
            this.requiredConfirmations = (_a = initOrObject.requiredConfirmations) !== null && _a !== void 0 ? _a : this.data.getConfirmationsHint();
            this.nonce = (_b = (initOrObject.nonce == null ? null : new BN(initOrObject.nonce))) !== null && _b !== void 0 ? _b : this.data.getNonceHint();
        }
        this.tryCalculateSwapFee();
    }
    _setPaymentResult(result, check = false) {
        return __awaiter(this, void 0, void 0, function* () {
            if (result == null)
                return false;
            if (result.txId == null)
                throw new IntermediaryError_1.IntermediaryError("No btc txId returned!");
            if (check) {
                const btcTx = yield this.wrapper.btcRpc.getTransaction(result.txId);
                if (btcTx == null)
                    return false;
                const foundVout = btcTx.outs.find(vout => this.data.getClaimHash() === this.wrapper.contract.getHashForOnchain(buffer_1.Buffer.from(vout.scriptPubKey.hex, "hex"), new BN(vout.value), this.requiredConfirmations, this.nonce).toString("hex"));
                if (foundVout == null)
                    throw new IntermediaryError_1.IntermediaryError("Invalid btc txId returned");
            }
            this.txId = result.txId;
            return true;
        });
    }
    //////////////////////////////
    //// Amounts & fees
    getOutput() {
        return (0, Tokens_1.toTokenAmount)(this.amount, this.outputToken, this.wrapper.prices);
    }
    //////////////////////////////
    //// Getters & utils
    getOutputTxId() {
        return this.txId;
    }
    /**
     * Returns fee rate of the bitcoin transaction in sats/vB
     */
    getBitcoinFeeRate() {
        return this.satsPerVByte;
    }
    /**
     * Returns the bitcoin address where the BTC will be sent to
     */
    getBitcoinAddress() {
        return this.address;
    }
    /**
     * Returns the transaction ID of the transaction sending the BTC
     */
    getBitcoinTxId() {
        return this.txId;
    }
    getRecipient() {
        return this.address;
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return Object.assign(Object.assign({}, super.serialize()), { address: this.address, amount: this.amount.toString(10), confirmationTarget: this.confirmationTarget, satsPerVByte: this.satsPerVByte, nonce: this.nonce == null ? null : this.nonce.toString(10), requiredConfirmations: this.requiredConfirmations, txId: this.txId });
    }
}
exports.ToBTCSwap = ToBTCSwap;
