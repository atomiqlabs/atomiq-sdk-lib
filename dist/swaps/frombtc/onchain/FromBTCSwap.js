"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FromBTCSwap = exports.isFromBTCSwapInit = exports.FromBTCSwapState = void 0;
const IFromBTCSwap_1 = require("../IFromBTCSwap");
const SwapType_1 = require("../../SwapType");
const base_1 = require("@atomiqlabs/base");
const ISwap_1 = require("../../ISwap");
const buffer_1 = require("buffer");
const Tokens_1 = require("../../Tokens");
const Utils_1 = require("../../../utils/Utils");
var FromBTCSwapState;
(function (FromBTCSwapState) {
    FromBTCSwapState[FromBTCSwapState["FAILED"] = -4] = "FAILED";
    FromBTCSwapState[FromBTCSwapState["EXPIRED"] = -3] = "EXPIRED";
    FromBTCSwapState[FromBTCSwapState["QUOTE_EXPIRED"] = -2] = "QUOTE_EXPIRED";
    FromBTCSwapState[FromBTCSwapState["QUOTE_SOFT_EXPIRED"] = -1] = "QUOTE_SOFT_EXPIRED";
    FromBTCSwapState[FromBTCSwapState["PR_CREATED"] = 0] = "PR_CREATED";
    FromBTCSwapState[FromBTCSwapState["CLAIM_COMMITED"] = 1] = "CLAIM_COMMITED";
    FromBTCSwapState[FromBTCSwapState["BTC_TX_CONFIRMED"] = 2] = "BTC_TX_CONFIRMED";
    FromBTCSwapState[FromBTCSwapState["CLAIM_CLAIMED"] = 3] = "CLAIM_CLAIMED";
})(FromBTCSwapState = exports.FromBTCSwapState || (exports.FromBTCSwapState = {}));
function isFromBTCSwapInit(obj) {
    return typeof (obj.address) === "string" &&
        typeof (obj.amount) === "bigint" &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isFromBTCSwapInit = isFromBTCSwapInit;
class FromBTCSwap extends IFromBTCSwap_1.IFromBTCSwap {
    constructor(wrapper, initOrObject) {
        if (isFromBTCSwapInit(initOrObject))
            initOrObject.url += "/frombtc";
        super(wrapper, initOrObject);
        this.inputToken = Tokens_1.BitcoinTokens.BTC;
        this.TYPE = SwapType_1.SwapType.FROM_BTC;
        if (isFromBTCSwapInit(initOrObject)) {
            this.state = FromBTCSwapState.PR_CREATED;
        }
        else {
            this.address = initOrObject.address;
            this.amount = BigInt(initOrObject.amount);
            this.txId = initOrObject.txId;
            this.vout = initOrObject.vout;
            this.requiredConfirmations = initOrObject.requiredConfirmations ?? this.data.getConfirmationsHint();
        }
        this.tryCalculateSwapFee();
        this.logger = (0, Utils_1.getLogger)("FromBTC(" + this.getIdentifierHashString() + "): ");
    }
    upgradeVersion() {
        if (this.version == null) {
            switch (this.state) {
                case -2:
                    this.state = FromBTCSwapState.FAILED;
                    break;
                case -1:
                    this.state = FromBTCSwapState.QUOTE_EXPIRED;
                    break;
                case 0:
                    this.state = FromBTCSwapState.PR_CREATED;
                    break;
                case 1:
                    this.state = FromBTCSwapState.CLAIM_COMMITED;
                    break;
                case 2:
                    this.state = FromBTCSwapState.BTC_TX_CONFIRMED;
                    break;
                case 3:
                    this.state = FromBTCSwapState.CLAIM_CLAIMED;
                    break;
            }
            this.version = 1;
        }
    }
    //////////////////////////////
    //// Getters & utils
    getInputTxId() {
        return this.txId;
    }
    getAddress() {
        return this.address;
    }
    /**
     * Returns bitcoin address where the on-chain BTC should be sent to
     */
    getBitcoinAddress() {
        if (this.state === FromBTCSwapState.PR_CREATED)
            return null;
        return this.address;
    }
    getQrData() {
        if (this.state === FromBTCSwapState.PR_CREATED)
            return null;
        return "bitcoin:" + this.address + "?amount=" + encodeURIComponent((Number(this.amount) / 100000000).toString(10));
    }
    /**
     * Returns timeout time (in UNIX milliseconds) when the on-chain address will expire and no funds should be sent
     *  to that address anymore
     */
    getTimeoutTime() {
        return Number(this.wrapper.getOnchainSendTimeout(this.data, this.requiredConfirmations)) * 1000;
    }
    isFinished() {
        return this.state === FromBTCSwapState.CLAIM_CLAIMED || this.state === FromBTCSwapState.QUOTE_EXPIRED || this.state === FromBTCSwapState.FAILED;
    }
    isClaimable() {
        return this.state === FromBTCSwapState.BTC_TX_CONFIRMED;
    }
    isActionable() {
        return this.isClaimable() || (this.state === FromBTCSwapState.CLAIM_COMMITED && this.getTimeoutTime() > Date.now());
    }
    isSuccessful() {
        return this.state === FromBTCSwapState.CLAIM_CLAIMED;
    }
    isFailed() {
        return this.state === FromBTCSwapState.FAILED || (this.state === FromBTCSwapState.EXPIRED && this.txId != null);
    }
    isQuoteExpired() {
        return this.state === FromBTCSwapState.QUOTE_EXPIRED;
    }
    isQuoteSoftExpired() {
        return this.state === FromBTCSwapState.QUOTE_EXPIRED || this.state === FromBTCSwapState.QUOTE_SOFT_EXPIRED;
    }
    canCommit() {
        if (this.state !== FromBTCSwapState.PR_CREATED)
            return false;
        const expiry = this.wrapper.getOnchainSendTimeout(this.data, this.requiredConfirmations);
        const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
        return (expiry - currentTimestamp) >= this.wrapper.options.minSendWindow;
    }
    canClaim() {
        return this.state === FromBTCSwapState.BTC_TX_CONFIRMED;
    }
    //////////////////////////////
    //// Amounts & fees
    getInput() {
        return (0, Tokens_1.toTokenAmount)(this.amount, this.inputToken, this.wrapper.prices);
    }
    /**
     * Returns claimer bounty, acting as a reward for watchtowers to claim the swap automatically
     */
    getClaimerBounty() {
        return (0, Tokens_1.toTokenAmount)(this.data.getClaimerBounty(), this.wrapper.tokens[this.data.getDepositToken()], this.wrapper.prices);
    }
    //////////////////////////////
    //// Bitcoin tx
    /**
     * Waits till the bitcoin transaction confirms and swap becomes claimable
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    async waitForBitcoinTransaction(abortSignal, checkIntervalSeconds, updateCallback) {
        if (this.state !== FromBTCSwapState.CLAIM_COMMITED && this.state !== FromBTCSwapState.EXPIRED)
            throw new Error("Must be in COMMITED state!");
        const result = await this.wrapper.btcRpc.waitForAddressTxo(this.address, buffer_1.Buffer.from(this.data.getTxoHashHint(), "hex"), this.requiredConfirmations, (confirmations, txId, vout, txEtaMs) => {
            if (updateCallback != null)
                updateCallback(txId, confirmations, this.requiredConfirmations, txEtaMs);
        }, abortSignal, checkIntervalSeconds);
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        this.txId = result.tx.txid;
        this.vout = result.vout;
        if (this.state !== FromBTCSwapState.CLAIM_CLAIMED &&
            this.state !== FromBTCSwapState.FAILED) {
            this.state = FromBTCSwapState.BTC_TX_CONFIRMED;
        }
        await this._saveAndEmit();
    }
    /**
     * Checks whether a bitcoin payment was already made, returns the payment or null when no payment has been made.
     */
    async getBitcoinPayment() {
        const result = await this.wrapper.btcRpc.checkAddressTxos(this.address, buffer_1.Buffer.from(this.data.getTxoHashHint(), "hex"));
        if (result == null)
            return null;
        return {
            txId: result.tx.txid,
            vout: result.vout,
            confirmations: result.tx.confirmations,
            targetConfirmations: this.requiredConfirmations
        };
    }
    //////////////////////////////
    //// Commit
    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in a PTLC
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
        if (this.state === FromBTCSwapState.PR_CREATED || this.state === FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            await this._saveAndEmit(FromBTCSwapState.CLAIM_COMMITED);
        }
        return result[0];
    }
    async waitTillCommited(abortSignal) {
        if (this.state === FromBTCSwapState.CLAIM_COMMITED || this.state === FromBTCSwapState.CLAIM_CLAIMED)
            return Promise.resolve();
        if (this.state !== FromBTCSwapState.PR_CREATED && this.state !== FromBTCSwapState.QUOTE_SOFT_EXPIRED)
            throw new Error("Invalid state");
        const abortController = (0, Utils_1.extendAbortController)(abortSignal);
        const result = await Promise.race([
            this.watchdogWaitTillCommited(abortController.signal),
            this.waitTillState(FromBTCSwapState.CLAIM_COMMITED, "gte", abortController.signal).then(() => 0)
        ]);
        abortController.abort();
        if (result === 0)
            this.logger.debug("waitTillCommited(): Resolved from state changed");
        if (result === true)
            this.logger.debug("waitTillCommited(): Resolved from watchdog - commited");
        if (result === false) {
            this.logger.debug("waitTillCommited(): Resolved from watchdog - signature expired");
            if (this.state === FromBTCSwapState.PR_CREATED || this.state === FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
                await this._saveAndEmit(FromBTCSwapState.QUOTE_EXPIRED);
            }
            return;
        }
        if (this.state === FromBTCSwapState.PR_CREATED || this.state === FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            await this._saveAndEmit(FromBTCSwapState.CLAIM_COMMITED);
        }
    }
    //////////////////////////////
    //// Claim
    /**
     * Returns transactions required to claim the swap on-chain (and possibly also sync the bitcoin light client)
     *  after a bitcoin transaction was sent and confirmed
     *
     * @throws {Error} If the swap is in invalid state (must be BTC_TX_CONFIRMED)
     */
    async txsClaim(signer) {
        if (!this.canClaim())
            throw new Error("Must be in BTC_TX_CONFIRMED state!");
        const tx = await this.wrapper.btcRpc.getTransaction(this.txId);
        return await this.wrapper.contract.txsClaimWithTxData(signer ?? this.getInitiator(), this.data, {
            blockhash: tx.blockhash,
            confirmations: tx.confirmations,
            txid: tx.txid,
            hex: tx.hex,
            height: tx.blockheight
        }, this.requiredConfirmations, this.vout, null, this.wrapper.synchronizer, true);
    }
    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    async claim(signer, abortSignal) {
        let txIds;
        try {
            txIds = await this.wrapper.contract.sendAndConfirm(signer, await this.txsClaim(signer), true, abortSignal);
        }
        catch (e) {
            this.logger.info("claim(): Failed to claim ourselves, checking swap claim state...");
            if (this.state === FromBTCSwapState.CLAIM_CLAIMED) {
                this.logger.info("claim(): Transaction state is CLAIM_CLAIMED, swap was successfully claimed by the watchtower");
                return this.claimTxId;
            }
            if ((await this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data)) === base_1.SwapCommitStatus.PAID) {
                this.logger.info("claim(): Transaction commit status is PAID, swap was successfully claimed by the watchtower");
                await this._saveAndEmit(FromBTCSwapState.CLAIM_CLAIMED);
                return null;
            }
            throw e;
        }
        this.claimTxId = txIds[0];
        if (this.state === FromBTCSwapState.CLAIM_COMMITED || this.state === FromBTCSwapState.BTC_TX_CONFIRMED ||
            this.state === FromBTCSwapState.EXPIRED || this.state === FromBTCSwapState.FAILED) {
            await this._saveAndEmit(FromBTCSwapState.CLAIM_CLAIMED);
        }
        return txIds[0];
    }
    /**
     * Waits till the swap is successfully claimed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be BTC_TX_CONFIRMED)
     * @throws {Error} If the LP refunded sooner than we were able to claim
     */
    async waitTillClaimed(abortSignal) {
        if (this.state === FromBTCSwapState.CLAIM_CLAIMED)
            return Promise.resolve();
        if (this.state !== FromBTCSwapState.BTC_TX_CONFIRMED)
            throw new Error("Invalid state (not BTC_TX_CONFIRMED)");
        const abortController = new AbortController();
        if (abortSignal != null)
            abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
        const res = await Promise.race([
            this.watchdogWaitTillResult(abortController.signal),
            this.waitTillState(FromBTCSwapState.CLAIM_CLAIMED, "eq", abortController.signal).then(() => 0),
            this.waitTillState(FromBTCSwapState.FAILED, "eq", abortController.signal).then(() => 1),
        ]);
        abortController.abort();
        if (res === 0) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (CLAIM_CLAIMED)");
            return;
        }
        if (res === 1) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (FAILED)");
            throw new Error("Offerer refunded during claiming");
        }
        this.logger.debug("waitTillClaimed(): Resolved from watchdog");
        if (res === base_1.SwapCommitStatus.PAID) {
            if (this.state !== FromBTCSwapState.CLAIM_CLAIMED)
                await this._saveAndEmit(FromBTCSwapState.CLAIM_CLAIMED);
        }
        if (res === base_1.SwapCommitStatus.NOT_COMMITED || res === base_1.SwapCommitStatus.EXPIRED) {
            if (this.state !== FromBTCSwapState.CLAIM_CLAIMED &&
                this.state !== FromBTCSwapState.FAILED)
                await this._saveAndEmit(FromBTCSwapState.FAILED);
        }
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return {
            ...super.serialize(),
            address: this.address,
            amount: this.amount.toString(10),
            requiredConfirmations: this.requiredConfirmations,
            txId: this.txId,
            vout: this.vout
        };
    }
    //////////////////////////////
    //// Swap ticks & sync
    /**
     * Checks the swap's state on-chain and compares it to its internal state, updates/changes it according to on-chain
     *  data
     *
     * @private
     */
    async syncStateFromChain() {
        if (this.state === FromBTCSwapState.PR_CREATED || this.state === FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            const status = await (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data));
            switch (status) {
                case base_1.SwapCommitStatus.COMMITED:
                    this.state = FromBTCSwapState.CLAIM_COMMITED;
                    return true;
                case base_1.SwapCommitStatus.EXPIRED:
                    this.state = FromBTCSwapState.QUOTE_EXPIRED;
                    return true;
                case base_1.SwapCommitStatus.PAID:
                    this.state = FromBTCSwapState.CLAIM_CLAIMED;
                    return true;
            }
            if (!await this.isQuoteValid()) {
                this.state = FromBTCSwapState.QUOTE_EXPIRED;
                return true;
            }
            return false;
        }
        if (this.state === FromBTCSwapState.CLAIM_COMMITED || this.state === FromBTCSwapState.BTC_TX_CONFIRMED || this.state === FromBTCSwapState.EXPIRED) {
            const status = await (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data));
            switch (status) {
                case base_1.SwapCommitStatus.PAID:
                    this.state = FromBTCSwapState.CLAIM_CLAIMED;
                    return true;
                case base_1.SwapCommitStatus.NOT_COMMITED:
                case base_1.SwapCommitStatus.EXPIRED:
                    this.state = FromBTCSwapState.FAILED;
                    return true;
                case base_1.SwapCommitStatus.COMMITED:
                    const res = await this.getBitcoinPayment();
                    if (res != null && res.confirmations >= this.requiredConfirmations) {
                        this.txId = res.txId;
                        this.vout = res.vout;
                        this.state = FromBTCSwapState.BTC_TX_CONFIRMED;
                        return true;
                    }
                    break;
            }
        }
    }
    async _sync(save) {
        const changed = await this.syncStateFromChain();
        if (changed && save)
            await this._saveAndEmit();
        return changed;
    }
    async _tick(save) {
        switch (this.state) {
            case FromBTCSwapState.PR_CREATED:
                if (this.expiry < Date.now()) {
                    this.state = FromBTCSwapState.QUOTE_SOFT_EXPIRED;
                    if (save)
                        await this._saveAndEmit();
                    return true;
                }
                break;
            case FromBTCSwapState.CLAIM_COMMITED:
                if (this.getTimeoutTime() < Date.now()) {
                    this.state = FromBTCSwapState.EXPIRED;
                    if (save)
                        await this._saveAndEmit();
                    return true;
                }
            case FromBTCSwapState.EXPIRED:
                //Check if bitcoin payment was received every 2 minutes
                if (Math.floor(Date.now() / 1000) % 120 === 0) {
                    try {
                        const res = await this.getBitcoinPayment();
                        if (res != null && res.confirmations >= this.requiredConfirmations) {
                            this.txId = res.txId;
                            this.vout = res.vout;
                            this.state = FromBTCSwapState.BTC_TX_CONFIRMED;
                            if (save)
                                await this._saveAndEmit();
                            return true;
                        }
                    }
                    catch (e) {
                        this.logger.warn("tickSwap(" + this.getIdentifierHashString() + "): ", e);
                    }
                }
                break;
        }
    }
}
exports.FromBTCSwap = FromBTCSwap;
