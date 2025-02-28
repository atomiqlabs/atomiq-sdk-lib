"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FromBTCLNSwap = exports.isFromBTCLNSwapInit = exports.FromBTCLNSwapState = void 0;
const bolt11_1 = require("@atomiqlabs/bolt11");
const IFromBTCSwap_1 = require("../IFromBTCSwap");
const SwapType_1 = require("../../SwapType");
const base_1 = require("@atomiqlabs/base");
const ISwap_1 = require("../../ISwap");
const buffer_1 = require("buffer");
const LNURL_1 = require("../../../utils/LNURL");
const UserError_1 = require("../../../errors/UserError");
const IntermediaryAPI_1 = require("../../../intermediaries/IntermediaryAPI");
const IntermediaryError_1 = require("../../../errors/IntermediaryError");
const PaymentAuthError_1 = require("../../../errors/PaymentAuthError");
const Utils_1 = require("../../../utils/Utils");
const Tokens_1 = require("../../Tokens");
var FromBTCLNSwapState;
(function (FromBTCLNSwapState) {
    FromBTCLNSwapState[FromBTCLNSwapState["FAILED"] = -4] = "FAILED";
    FromBTCLNSwapState[FromBTCLNSwapState["QUOTE_EXPIRED"] = -3] = "QUOTE_EXPIRED";
    FromBTCLNSwapState[FromBTCLNSwapState["QUOTE_SOFT_EXPIRED"] = -2] = "QUOTE_SOFT_EXPIRED";
    FromBTCLNSwapState[FromBTCLNSwapState["EXPIRED"] = -1] = "EXPIRED";
    FromBTCLNSwapState[FromBTCLNSwapState["PR_CREATED"] = 0] = "PR_CREATED";
    FromBTCLNSwapState[FromBTCLNSwapState["PR_PAID"] = 1] = "PR_PAID";
    FromBTCLNSwapState[FromBTCLNSwapState["CLAIM_COMMITED"] = 2] = "CLAIM_COMMITED";
    FromBTCLNSwapState[FromBTCLNSwapState["CLAIM_CLAIMED"] = 3] = "CLAIM_CLAIMED";
})(FromBTCLNSwapState = exports.FromBTCLNSwapState || (exports.FromBTCLNSwapState = {}));
function isFromBTCLNSwapInit(obj) {
    return typeof obj.pr === "string" &&
        typeof obj.secret === "string" &&
        (obj.lnurl == null || typeof (obj.lnurl) === "string") &&
        (obj.lnurlK1 == null || typeof (obj.lnurlK1) === "string") &&
        (obj.lnurlCallback == null || typeof (obj.lnurlCallback) === "string") &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isFromBTCLNSwapInit = isFromBTCLNSwapInit;
class FromBTCLNSwap extends IFromBTCSwap_1.IFromBTCSwap {
    getSwapData() {
        return this.data ?? this.initialSwapData;
    }
    constructor(wrapper, initOrObject) {
        if (isFromBTCLNSwapInit(initOrObject))
            initOrObject.url += "/frombtcln";
        super(wrapper, initOrObject);
        this.inputToken = Tokens_1.BitcoinTokens.BTCLN;
        this.TYPE = SwapType_1.SwapType.FROM_BTCLN;
        this.lnurlFailSignal = new AbortController();
        this.prPosted = false;
        if (isFromBTCLNSwapInit(initOrObject)) {
            this.state = FromBTCLNSwapState.PR_CREATED;
        }
        else {
            this.pr = initOrObject.pr;
            this.secret = initOrObject.secret;
            this.initialSwapData = initOrObject.initialSwapData == null ? null : base_1.SwapData.deserialize(initOrObject.initialSwapData);
            this.lnurl = initOrObject.lnurl;
            this.lnurlK1 = initOrObject.lnurlK1;
            this.lnurlCallback = initOrObject.lnurlCallback;
            this.prPosted = initOrObject.prPosted;
            if (this.state === FromBTCLNSwapState.PR_CREATED && this.data != null) {
                this.initialSwapData = this.data;
                delete this.data;
            }
        }
        this.tryCalculateSwapFee();
        this.logger = (0, Utils_1.getLogger)("FromBTCLN(" + this.getIdentifierHashString() + "): ");
    }
    upgradeVersion() {
        if (this.version == null) {
            switch (this.state) {
                case -2:
                    this.state = FromBTCLNSwapState.QUOTE_EXPIRED;
                    break;
                case -1:
                    this.state = FromBTCLNSwapState.FAILED;
                    break;
                case 0:
                    this.state = FromBTCLNSwapState.PR_CREATED;
                    break;
                case 1:
                    this.state = FromBTCLNSwapState.PR_PAID;
                    break;
                case 2:
                    this.state = FromBTCLNSwapState.CLAIM_COMMITED;
                    break;
                case 3:
                    this.state = FromBTCLNSwapState.CLAIM_CLAIMED;
                    break;
            }
            this.version = 1;
        }
    }
    //////////////////////////////
    //// Getters & utils
    getInputTxId() {
        return this.getPaymentHash().toString("hex");
    }
    getIdentifierHash() {
        const paymentHashBuffer = this.getPaymentHash();
        if (this.randomNonce == null)
            return paymentHashBuffer;
        return buffer_1.Buffer.concat([paymentHashBuffer, buffer_1.Buffer.from(this.randomNonce, "hex")]);
    }
    getPaymentHash() {
        if (this.pr == null)
            return null;
        const decodedPR = (0, bolt11_1.decode)(this.pr);
        return buffer_1.Buffer.from(decodedPR.tagsObject.payment_hash, "hex");
    }
    getAddress() {
        return this.pr;
    }
    /**
     * Returns the lightning network BOLT11 invoice that needs to be paid as an input to the swap
     */
    getLightningInvoice() {
        return this.pr;
    }
    getQrData() {
        return "lightning:" + this.getLightningInvoice().toUpperCase();
    }
    /**
     * Returns timeout time (in UNIX milliseconds) when the LN invoice will expire
     */
    getTimeoutTime() {
        if (this.pr == null)
            return null;
        const decoded = (0, bolt11_1.decode)(this.pr);
        return (decoded.timeExpireDate * 1000);
    }
    /**
     * Returns timeout time (in UNIX milliseconds) when the on-chain address will expire and no funds should be sent
     *  to that address anymore
     */
    getHtlcTimeoutTime() {
        return Number(this.wrapper.getHtlcTimeout(this.data)) * 1000;
    }
    isFinished() {
        return this.state === FromBTCLNSwapState.CLAIM_CLAIMED || this.state === FromBTCLNSwapState.QUOTE_EXPIRED || this.state === FromBTCLNSwapState.FAILED;
    }
    isClaimable() {
        return this.state === FromBTCLNSwapState.PR_PAID || this.state === FromBTCLNSwapState.CLAIM_COMMITED;
    }
    isSuccessful() {
        return this.state === FromBTCLNSwapState.CLAIM_CLAIMED;
    }
    isFailed() {
        return this.state === FromBTCLNSwapState.FAILED || this.state === FromBTCLNSwapState.EXPIRED;
    }
    isQuoteExpired() {
        return this.state === FromBTCLNSwapState.QUOTE_EXPIRED;
    }
    isQuoteSoftExpired() {
        return this.state === FromBTCLNSwapState.QUOTE_EXPIRED || this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED;
    }
    isQuoteValid() {
        if (this.state === FromBTCLNSwapState.PR_CREATED ||
            (this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData == null)) {
            return Promise.resolve(this.getTimeoutTime() > Date.now());
        }
        return super.isQuoteValid();
    }
    canCommit() {
        return this.state === FromBTCLNSwapState.PR_PAID;
    }
    canClaim() {
        return this.state === FromBTCLNSwapState.CLAIM_COMMITED;
    }
    //////////////////////////////
    //// Amounts & fees
    getInput() {
        const parsed = (0, bolt11_1.decode)(this.pr);
        const amount = (BigInt(parsed.millisatoshis) + 999n) / 1000n;
        return (0, Tokens_1.toTokenAmount)(amount, this.inputToken, this.wrapper.prices);
    }
    /**
     * Estimated transaction fee for commit & claim txs combined
     */
    async getCommitAndClaimFee() {
        const swapContract = this.wrapper.contract;
        const feeRate = this.feeRate ?? await swapContract.getInitFeeRate(this.getSwapData().getOfferer(), this.getSwapData().getClaimer(), this.getSwapData().getToken(), this.getSwapData().getClaimHash());
        const commitFee = await (swapContract.getRawCommitFee != null ?
            swapContract.getRawCommitFee(this.getSwapData(), feeRate) :
            swapContract.getCommitFee(this.getSwapData(), feeRate));
        const claimFee = await (swapContract.getRawClaimFee != null ?
            swapContract.getRawClaimFee(this.getInitiator(), this.getSwapData(), feeRate) :
            swapContract.getClaimFee(this.getInitiator(), this.getSwapData(), feeRate));
        return commitFee + claimFee;
    }
    async getSmartChainNetworkFee() {
        return (0, Tokens_1.toTokenAmount)(await this.getCommitAndClaimFee(), this.wrapper.getNativeToken(), this.wrapper.prices);
    }
    async hasEnoughForTxFees() {
        const [balance, feeRate] = await Promise.all([
            this.wrapper.contract.getBalance(this.getInitiator(), this.wrapper.contract.getNativeCurrencyAddress(), false),
            this.feeRate != null ? Promise.resolve(this.feeRate) : this.wrapper.contract.getInitFeeRate(this.getSwapData().getOfferer(), this.getSwapData().getClaimer(), this.getSwapData().getToken(), this.getSwapData().getClaimHash())
        ]);
        const commitFee = await this.wrapper.contract.getCommitFee(this.getSwapData(), feeRate);
        const claimFee = await this.wrapper.contract.getClaimFee(this.getInitiator(), this.getSwapData(), feeRate);
        const totalFee = commitFee + claimFee + this.getSwapData().getTotalDeposit();
        return {
            enoughBalance: balance >= totalFee,
            balance: (0, Tokens_1.toTokenAmount)(balance, this.wrapper.getNativeToken(), this.wrapper.prices),
            required: (0, Tokens_1.toTokenAmount)(totalFee, this.wrapper.getNativeToken(), this.wrapper.prices)
        };
    }
    //////////////////////////////
    //// Payment
    /**
     * Waits till an LN payment is received by the intermediary and client can continue commiting & claiming the HTLC
     *
     * @param abortSignal Abort signal to stop waiting for payment
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     */
    async waitForPayment(abortSignal, checkIntervalSeconds = 5) {
        if (this.state !== FromBTCLNSwapState.PR_CREATED &&
            (this.state !== FromBTCLNSwapState.QUOTE_SOFT_EXPIRED || this.signatureData != null))
            throw new Error("Must be in PR_CREATED state!");
        const abortController = new AbortController();
        if (abortSignal != null)
            abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
        if (this.lnurl != null && !this.prPosted) {
            LNURL_1.LNURL.postInvoiceToLNURLWithdraw({ k1: this.lnurlK1, callback: this.lnurlCallback }, this.pr).catch(e => {
                this.lnurlFailSignal.abort(e);
            });
            this.prPosted = true;
        }
        this.initiated = true;
        await this._saveAndEmit();
        let lnurlFailListener = () => abortController.abort(this.lnurlFailSignal.signal.reason);
        this.lnurlFailSignal.signal.addEventListener("abort", lnurlFailListener);
        this.lnurlFailSignal.signal.throwIfAborted();
        let resp = { code: IntermediaryAPI_1.PaymentAuthorizationResponseCodes.PENDING, msg: "" };
        while (!abortController.signal.aborted && resp.code === IntermediaryAPI_1.PaymentAuthorizationResponseCodes.PENDING) {
            resp = await IntermediaryAPI_1.IntermediaryAPI.getPaymentAuthorization(this.url, this.getPaymentHash().toString("hex"));
            if (resp.code === IntermediaryAPI_1.PaymentAuthorizationResponseCodes.PENDING)
                await (0, Utils_1.timeoutPromise)(checkIntervalSeconds * 1000, abortController.signal);
        }
        this.lnurlFailSignal.signal.removeEventListener("abort", lnurlFailListener);
        abortController.signal.throwIfAborted();
        if (resp.code === IntermediaryAPI_1.PaymentAuthorizationResponseCodes.AUTH_DATA) {
            const sigData = resp.data;
            const swapData = new this.wrapper.swapDataDeserializer(resp.data.data);
            await this.checkIntermediaryReturnedAuthData(this.getInitiator(), swapData, sigData);
            this.expiry = await (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.getInitAuthorizationExpiry(swapData, sigData));
            if (this.state === FromBTCLNSwapState.PR_CREATED || this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
                delete this.initialSwapData;
                this.data = swapData;
                this.signatureData = {
                    prefix: sigData.prefix,
                    timeout: sigData.timeout,
                    signature: sigData.signature
                };
                await this._saveAndEmit(FromBTCLNSwapState.PR_PAID);
            }
            return;
        }
        if (this.state === FromBTCLNSwapState.PR_CREATED || this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
            if (resp.code === IntermediaryAPI_1.PaymentAuthorizationResponseCodes.EXPIRED) {
                await this._saveAndEmit(FromBTCLNSwapState.QUOTE_EXPIRED);
            }
            throw new PaymentAuthError_1.PaymentAuthError(resp.msg, resp.code, resp.data);
        }
    }
    /**
     * Checks whether the LP received the LN payment and we can continue by committing & claiming the HTLC on-chain
     *
     * @param save If the new swap state should be saved
     */
    async checkIntermediaryPaymentReceived(save = true) {
        if (this.state === FromBTCLNSwapState.PR_PAID ||
            this.state === FromBTCLNSwapState.CLAIM_COMMITED ||
            this.state === FromBTCLNSwapState.CLAIM_CLAIMED ||
            this.state === FromBTCLNSwapState.FAILED)
            return true;
        if (this.state === FromBTCLNSwapState.QUOTE_EXPIRED || (this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData != null))
            return false;
        const resp = await IntermediaryAPI_1.IntermediaryAPI.getPaymentAuthorization(this.url, this.getPaymentHash().toString("hex"));
        switch (resp.code) {
            case IntermediaryAPI_1.PaymentAuthorizationResponseCodes.AUTH_DATA:
                const data = new this.wrapper.swapDataDeserializer(resp.data.data);
                try {
                    await this.checkIntermediaryReturnedAuthData(this.getInitiator(), data, resp.data);
                    this.expiry = await (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.getInitAuthorizationExpiry(data, resp.data));
                    this.state = FromBTCLNSwapState.PR_PAID;
                    delete this.initialSwapData;
                    this.data = data;
                    this.signatureData = {
                        prefix: resp.data.prefix,
                        timeout: resp.data.timeout,
                        signature: resp.data.signature
                    };
                    this.initiated = true;
                    if (save)
                        await this._saveAndEmit();
                    return true;
                }
                catch (e) { }
                return null;
            case IntermediaryAPI_1.PaymentAuthorizationResponseCodes.EXPIRED:
                this.state = FromBTCLNSwapState.QUOTE_EXPIRED;
                this.initiated = true;
                if (save)
                    await this._saveAndEmit();
                return false;
            default:
                return null;
        }
    }
    /**
     * Checks the data returned by the intermediary in the payment auth request
     *
     * @param signer Smart chain signer's address initiating the swap
     * @param data Parsed swap data as returned by the intermediary
     * @param signature Signature data as returned by the intermediary
     * @protected
     * @throws {IntermediaryError} If the returned are not valid
     * @throws {SignatureVerificationError} If the returned signature is not valid
     * @throws {Error} If the swap is already committed on-chain
     */
    async checkIntermediaryReturnedAuthData(signer, data, signature) {
        data.setClaimer(signer);
        if (data.getOfferer() !== this.getSwapData().getOfferer())
            throw new IntermediaryError_1.IntermediaryError("Invalid offerer used");
        if (!data.isToken(this.getSwapData().getToken()))
            throw new IntermediaryError_1.IntermediaryError("Invalid token used");
        if (data.getSecurityDeposit() > this.getSwapData().getSecurityDeposit())
            throw new IntermediaryError_1.IntermediaryError("Invalid security deposit!");
        if (data.getAmount() < this.getSwapData().getAmount())
            throw new IntermediaryError_1.IntermediaryError("Invalid amount received!");
        if (data.getClaimHash() !== this.getSwapData().getClaimHash())
            throw new IntermediaryError_1.IntermediaryError("Invalid payment hash used!");
        if (!data.isDepositToken(this.getSwapData().getDepositToken()))
            throw new IntermediaryError_1.IntermediaryError("Invalid deposit token used!");
        await Promise.all([
            (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.isValidInitAuthorization(data, signature, this.feeRate), null, base_1.SignatureVerificationError),
            (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.getCommitStatus(data.getClaimer(), data)).then(status => {
                if (status !== base_1.SwapCommitStatus.NOT_COMMITED)
                    throw new Error("Swap already committed on-chain!");
            })
        ]);
    }
    //////////////////////////////
    //// Commit
    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in an HTLC
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    async commit(signer, abortSignal, skipChecks) {
        this.checkSigner(signer);
        const result = await this.wrapper.contract.sendAndConfirm(signer, await this.txsCommit(skipChecks), true, abortSignal);
        this.commitTxId = result[0];
        if (this.state === FromBTCLNSwapState.PR_PAID || this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
            await this._saveAndEmit(FromBTCLNSwapState.CLAIM_COMMITED);
        }
        return result[0];
    }
    async waitTillCommited(abortSignal) {
        if (this.state === FromBTCLNSwapState.CLAIM_COMMITED || this.state === FromBTCLNSwapState.CLAIM_CLAIMED)
            return Promise.resolve();
        if (this.state !== FromBTCLNSwapState.PR_PAID && (this.state !== FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData != null))
            throw new Error("Invalid state");
        const abortController = (0, Utils_1.extendAbortController)(abortSignal);
        const result = await Promise.race([
            this.watchdogWaitTillCommited(abortController.signal),
            this.waitTillState(FromBTCLNSwapState.CLAIM_COMMITED, "gte", abortController.signal).then(() => 0)
        ]);
        abortController.abort();
        if (result === 0)
            this.logger.debug("waitTillCommited(): Resolved from state changed");
        if (result === true)
            this.logger.debug("waitTillCommited(): Resolved from watchdog - commited");
        if (result === false) {
            this.logger.debug("waitTillCommited(): Resolved from watchdog - signature expired");
            if (this.state === FromBTCLNSwapState.PR_PAID ||
                this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
                await this._saveAndEmit(FromBTCLNSwapState.QUOTE_EXPIRED);
            }
            return;
        }
        if (this.state === FromBTCLNSwapState.PR_PAID ||
            this.state === FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
            await this._saveAndEmit(FromBTCLNSwapState.CLAIM_COMMITED);
        }
    }
    //////////////////////////////
    //// Claim
    /**
     * Returns transactions required for claiming the HTLC and finishing the swap by revealing the HTLC secret
     *  (hash preimage)
     *
     * @param signer Optional signer address to use for claiming the swap, can also be different from the initializer
     * @throws {Error} If in invalid state (must be CLAIM_COMMITED)
     */
    txsClaim(signer) {
        if (this.state !== FromBTCLNSwapState.CLAIM_COMMITED)
            throw new Error("Must be in CLAIM_COMMITED state!");
        return this.wrapper.contract.txsClaimWithSecret(signer ?? this.getInitiator(), this.data, this.secret, true, true);
    }
    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    async claim(signer, abortSignal) {
        const result = await this.wrapper.contract.sendAndConfirm(signer, await this.txsClaim(), true, abortSignal);
        this.claimTxId = result[0];
        await this._saveAndEmit(FromBTCLNSwapState.CLAIM_CLAIMED);
        return result[0];
    }
    /**
     * Waits till the swap is successfully claimed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be BTC_TX_CONFIRMED)
     * @throws {Error} If the LP refunded sooner than we were able to claim
     */
    async waitTillClaimed(abortSignal) {
        if (this.state === FromBTCLNSwapState.CLAIM_CLAIMED)
            return Promise.resolve();
        if (this.state !== FromBTCLNSwapState.CLAIM_COMMITED)
            throw new Error("Invalid state (not CLAIM_COMMITED)");
        const abortController = new AbortController();
        if (abortSignal != null)
            abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
        const res = await Promise.race([
            this.watchdogWaitTillResult(abortController.signal),
            this.waitTillState(FromBTCLNSwapState.CLAIM_CLAIMED, "eq", abortController.signal).then(() => 0),
            this.waitTillState(FromBTCLNSwapState.EXPIRED, "eq", abortController.signal).then(() => 1),
        ]);
        abortController.abort();
        if (res === 0) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (CLAIM_CLAIMED)");
            return;
        }
        if (res === 1) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (EXPIRED)");
            throw new Error("Swap expired during claiming");
        }
        this.logger.debug("waitTillClaimed(): Resolved from watchdog");
        if (res === base_1.SwapCommitStatus.PAID) {
            if (this.state !== FromBTCLNSwapState.CLAIM_CLAIMED)
                await this._saveAndEmit(FromBTCLNSwapState.CLAIM_CLAIMED);
        }
        if (res === base_1.SwapCommitStatus.NOT_COMMITED || res === base_1.SwapCommitStatus.EXPIRED) {
            if (this.state !== FromBTCLNSwapState.CLAIM_CLAIMED &&
                this.state !== FromBTCLNSwapState.FAILED)
                await this._saveAndEmit(FromBTCLNSwapState.FAILED);
        }
    }
    //////////////////////////////
    //// Commit & claim
    canCommitAndClaimInOneShot() {
        return this.wrapper.contract.initAndClaimWithSecret != null;
    }
    /**
     * Commits and claims the swap, in a way that the transactions can be signed together by the underlying provider and
     *  then sent sequentially
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If in invalid state (must be PR_PAID or CLAIM_COMMITED)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    async commitAndClaim(signer, abortSignal, skipChecks) {
        if (!this.canCommitAndClaimInOneShot())
            throw new Error("Cannot commitAndClaim in single action, please run commit and claim separately!");
        this.checkSigner(signer);
        if (this.state === FromBTCLNSwapState.CLAIM_COMMITED)
            return [null, await this.claim(signer)];
        const result = await this.wrapper.contract.sendAndConfirm(signer, await this.txsCommitAndClaim(skipChecks), true, abortSignal);
        this.commitTxId = result[0] || this.commitTxId;
        this.claimTxId = result[result.length - 1] || this.claimTxId;
        await this._saveAndEmit(FromBTCLNSwapState.CLAIM_CLAIMED);
    }
    /**
     * Returns transactions for both commit & claim operation together, such that they can be signed all at once by
     *  the wallet. CAUTION: transactions must be sent sequentially, such that the claim (2nd) transaction is only
     *  sent after the commit (1st) transaction confirms. Failure to do so can reveal the HTLC pre-image too soon,
     *  opening a possibility for the LP to steal funds.
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     *
     * @throws {Error} If in invalid state (must be PR_PAID or CLAIM_COMMITED)
     */
    async txsCommitAndClaim(skipChecks) {
        if (this.state === FromBTCLNSwapState.CLAIM_COMMITED)
            return await this.txsClaim();
        if (this.state !== FromBTCLNSwapState.PR_PAID && (this.state !== FromBTCLNSwapState.QUOTE_SOFT_EXPIRED || this.signatureData == null))
            throw new Error("Must be in PR_PAID state!");
        const initTxs = await this.txsCommit(skipChecks);
        const claimTxs = await this.wrapper.contract.txsClaimWithSecret(this.getInitiator(), this.data, this.secret, true, true, null, true);
        return initTxs.concat(claimTxs);
    }
    //////////////////////////////
    //// LNURL
    /**
     * Is this an LNURL-withdraw swap?
     */
    isLNURL() {
        return this.lnurl != null;
    }
    /**
     * Gets the used LNURL or null if this is not an LNURL-withdraw swap
     */
    getLNURL() {
        return this.lnurl;
    }
    /**
     * Pay the generated lightning network invoice with LNURL-withdraw
     */
    async settleWithLNURLWithdraw(lnurl) {
        if (this.lnurl != null)
            throw new Error("Cannot settle LNURL-withdraw swap with different LNURL");
        let lnurlParams;
        if (typeof (lnurl) === "string") {
            const parsedLNURL = await LNURL_1.LNURL.getLNURL(lnurl);
            if (parsedLNURL == null || parsedLNURL.tag !== "withdrawRequest")
                throw new UserError_1.UserError("Invalid LNURL-withdraw to settle the swap");
            lnurlParams = parsedLNURL;
        }
        else {
            lnurlParams = lnurl.params;
        }
        LNURL_1.LNURL.useLNURLWithdraw(lnurlParams, this.pr).catch(e => this.lnurlFailSignal.abort(e));
        this.lnurl = lnurlParams.url;
        this.lnurlCallback = lnurlParams.callback;
        this.lnurlK1 = lnurlParams.k1;
        this.prPosted = true;
        await this._saveAndEmit();
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return {
            ...super.serialize(),
            pr: this.pr,
            secret: this.secret,
            lnurl: this.lnurl,
            lnurlK1: this.lnurlK1,
            lnurlCallback: this.lnurlCallback,
            prPosted: this.prPosted,
            initialSwapData: this.initialSwapData == null ? null : this.initialSwapData.serialize()
        };
    }
}
exports.FromBTCLNSwap = FromBTCLNSwap;
