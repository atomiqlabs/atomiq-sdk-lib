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
exports.IFromBTCSwap = void 0;
const ISwap_1 = require("../ISwap");
const BN = require("bn.js");
const base_1 = require("@atomiqlabs/base");
const Tokens_1 = require("../Tokens");
class IFromBTCSwap extends ISwap_1.ISwap {
    constructor(wrapper, initOrObj) {
        super(wrapper, initOrObj);
    }
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    tryCalculateSwapFee() {
        if (this.swapFeeBtc == null) {
            this.swapFeeBtc = this.swapFee.mul(this.getInput().rawAmount).div(this.getOutAmountWithoutFee());
        }
        if (this.pricingInfo.swapPriceUSatPerToken == null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(this.chainIdentifier, this.getInput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.getSwapData().getAmount(), this.getSwapData().getToken());
        }
    }
    getSwapData() {
        return this.data;
    }
    //////////////////////////////
    //// Pricing
    refreshPriceData() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.pricingInfo == null)
                return null;
            const priceData = yield this.wrapper.prices.isValidAmountReceive(this.chainIdentifier, this.getInput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.getSwapData().getAmount(), this.getSwapData().getToken());
            this.pricingInfo = priceData;
            return priceData;
        });
    }
    getSwapPrice() {
        return this.pricingInfo.swapPriceUSatPerToken.toNumber() / 100000000000000;
    }
    getMarketPrice() {
        return this.pricingInfo.realPriceUSatPerToken.toNumber() / 100000000000000;
    }
    getRealSwapFeePercentagePPM() {
        const feeWithoutBaseFee = this.swapFeeBtc.sub(this.pricingInfo.satsBaseFee);
        return feeWithoutBaseFee.mul(new BN(1000000)).div(this.getInputWithoutFee().rawAmount);
    }
    getOutputTxId() {
        return this.claimTxId;
    }
    getInputAddress() {
        return this.getAddress();
    }
    getOutputAddress() {
        return this.getInitiator();
    }
    isActionable() {
        return this.isClaimable();
    }
    //////////////////////////////
    //// Amounts & fees
    getOutAmountWithoutFee() {
        return this.getSwapData().getAmount().add(this.swapFee);
    }
    getOutputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.getSwapData().getAmount().add(this.swapFee), this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices);
    }
    getOutput() {
        return (0, Tokens_1.toTokenAmount)(this.getSwapData().getAmount(), this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices);
    }
    getInputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.getInput().rawAmount.sub(this.swapFeeBtc), this.inputToken, this.wrapper.prices);
    }
    getSwapFee() {
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.swapFeeBtc, this.inputToken, this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(this.swapFee, this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }
    getSecurityDeposit() {
        return (0, Tokens_1.toTokenAmount)(this.getSwapData().getSecurityDeposit(), this.wrapper.getNativeToken(), this.wrapper.prices);
    }
    getTotalDeposit() {
        return (0, Tokens_1.toTokenAmount)(this.getSwapData().getTotalDeposit(), this.wrapper.getNativeToken(), this.wrapper.prices);
    }
    getInitiator() {
        return this.getSwapData().getClaimer();
    }
    getClaimFee() {
        return this.wrapper.contract.getClaimFee(this.getInitiator(), this.getSwapData());
    }
    hasEnoughForTxFees() {
        return __awaiter(this, void 0, void 0, function* () {
            const [balance, commitFee] = yield Promise.all([
                this.wrapper.contract.getBalance(this.getInitiator(), this.wrapper.contract.getNativeCurrencyAddress(), false),
                this.getCommitFee()
            ]);
            const totalFee = commitFee.add(this.getSwapData().getTotalDeposit());
            return {
                enoughBalance: balance.gte(totalFee),
                balance: (0, Tokens_1.toTokenAmount)(balance, this.wrapper.getNativeToken(), this.wrapper.prices),
                required: (0, Tokens_1.toTokenAmount)(totalFee, this.wrapper.getNativeToken(), this.wrapper.prices)
            };
        });
    }
    /**
     * Returns the transactions required for committing the swap on-chain, locking the tokens from the intermediary
     *  in an HTLC or PTLC
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} When in invalid state to commit the swap
     */
    txsCommit(skipChecks) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.canCommit())
                throw new Error("Must be in CREATED state!");
            this.initiated = true;
            yield this._saveAndEmit();
            return yield this.wrapper.contract.txsInit(this.data, this.signatureData, skipChecks, this.feeRate).catch(e => Promise.reject(e instanceof base_1.SignatureVerificationError ? new Error("Request timed out") : e));
        });
    }
}
exports.IFromBTCSwap = IFromBTCSwap;
