"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IFromBTCSwap = void 0;
const base_1 = require("@atomiqlabs/base");
const Tokens_1 = require("../../../Tokens");
const IEscrowSwap_1 = require("../IEscrowSwap");
class IFromBTCSwap extends IEscrowSwap_1.IEscrowSwap {
    constructor(wrapper, initOrObj) {
        super(wrapper, initOrObj);
    }
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    tryCalculateSwapFee() {
        if (this.swapFeeBtc == null) {
            this.swapFeeBtc = this.swapFee * this.getInput().rawAmount / this.getOutAmountWithoutFee();
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
    async refreshPriceData() {
        if (this.pricingInfo == null)
            return null;
        const priceData = await this.wrapper.prices.isValidAmountReceive(this.chainIdentifier, this.getInput().rawAmount, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.getSwapData().getAmount(), this.getSwapData().getToken());
        this.pricingInfo = priceData;
        return priceData;
    }
    getSwapPrice() {
        return Number(this.pricingInfo.swapPriceUSatPerToken) / 100000000000000;
    }
    getMarketPrice() {
        return Number(this.pricingInfo.realPriceUSatPerToken) / 100000000000000;
    }
    getRealSwapFeePercentagePPM() {
        const feeWithoutBaseFee = this.swapFeeBtc - this.pricingInfo.satsBaseFee;
        return feeWithoutBaseFee * 1000000n / this.getInputWithoutFee().rawAmount;
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
        return this.getSwapData().getAmount() + this.swapFee;
    }
    getOutputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.getSwapData().getAmount() + this.swapFee, this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices);
    }
    getOutput() {
        return (0, Tokens_1.toTokenAmount)(this.getSwapData().getAmount(), this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices);
    }
    getInputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.getInput().rawAmount - this.swapFeeBtc, this.inputToken, this.wrapper.prices);
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
    async hasEnoughForTxFees() {
        const [balance, commitFee] = await Promise.all([
            this.wrapper.contract.getBalance(this.getInitiator(), this.wrapper.chain.getNativeCurrencyAddress(), false),
            this.getCommitFee()
        ]);
        const totalFee = commitFee + this.getSwapData().getTotalDeposit();
        return {
            enoughBalance: balance >= totalFee,
            balance: (0, Tokens_1.toTokenAmount)(balance, this.wrapper.getNativeToken(), this.wrapper.prices),
            required: (0, Tokens_1.toTokenAmount)(totalFee, this.wrapper.getNativeToken(), this.wrapper.prices)
        };
    }
    /**
     * Returns the transactions required for committing the swap on-chain, locking the tokens from the intermediary
     *  in an HTLC or PTLC
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} When in invalid state to commit the swap
     */
    async txsCommit(skipChecks) {
        if (!this.canCommit())
            throw new Error("Must be in CREATED state!");
        if (!this.initiated) {
            this.initiated = true;
            await this._saveAndEmit();
        }
        return await this.wrapper.contract.txsInit(this.data, this.signatureData, skipChecks, this.feeRate).catch(e => Promise.reject(e instanceof base_1.SignatureVerificationError ? new Error("Request timed out") : e));
    }
}
exports.IFromBTCSwap = IFromBTCSwap;
