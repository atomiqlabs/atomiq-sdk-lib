"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IEscrowSwap = exports.isIEscrowSwapInit = void 0;
const ISwap_1 = require("../ISwap");
const base_1 = require("@atomiqlabs/base");
const Utils_1 = require("../../utils/Utils");
const buffer_1 = require("buffer");
const Tokens_1 = require("../../Tokens");
function isIEscrowSwapInit(obj) {
    return typeof obj === 'object' &&
        obj.feeRate != null &&
        (obj.signatureData == null || (typeof (obj.signatureData) === 'object' &&
            typeof (obj.signatureData.prefix) === "string" &&
            typeof (obj.signatureData.timeout) === "string" &&
            typeof (obj.signatureData.signature) === "string")) &&
        (obj.data == null || typeof obj.data === 'object') &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isIEscrowSwapInit = isIEscrowSwapInit;
class IEscrowSwap extends ISwap_1.ISwap {
    constructor(wrapper, swapInitOrObj) {
        super(wrapper, swapInitOrObj);
        if (!isIEscrowSwapInit(swapInitOrObj)) {
            this.data = swapInitOrObj.data != null ? new wrapper.swapDataDeserializer(swapInitOrObj.data) : null;
            this.signatureData = swapInitOrObj.signature == null ? null : {
                prefix: swapInitOrObj.prefix,
                timeout: swapInitOrObj.timeout,
                signature: swapInitOrObj.signature
            };
            this.feeRate = swapInitOrObj.feeRate;
            this.commitTxId = swapInitOrObj.commitTxId;
            this.claimTxId = swapInitOrObj.claimTxId;
            this.refundTxId = swapInitOrObj.refundTxId;
        }
    }
    //////////////////////////////
    //// Identifiers
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHash() {
        const claimHashBuffer = buffer_1.Buffer.from(this.getClaimHash(), "hex");
        if (this.randomNonce == null)
            return claimHashBuffer;
        return buffer_1.Buffer.concat([claimHashBuffer, buffer_1.Buffer.from(this.randomNonce, "hex")]);
    }
    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHashString() {
        const identifierHash = this.getIdentifierHash();
        if (identifierHash == null)
            return null;
        return identifierHash.toString("hex");
    }
    _getEscrowHash() {
        return this.data?.getEscrowHash();
    }
    /**
     * Returns the escrow hash - i.e. hash of the escrow data
     */
    getEscrowHash() {
        return this._getEscrowHash();
    }
    /**
     * Returns the claim data hash - i.e. hash passed to the claim handler
     */
    getClaimHash() {
        return this.data?.getClaimHash();
    }
    getId() {
        return this.getIdentifierHashString();
    }
    //////////////////////////////
    //// Watchdogs
    /**
     * Periodically checks for init signature's expiry
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    async watchdogWaitTillSignatureExpiry(abortSignal, interval = 5) {
        let expired = false;
        while (!expired) {
            await (0, Utils_1.timeoutPromise)(interval * 1000, abortSignal);
            try {
                expired = await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData);
            }
            catch (e) {
                this.logger.error("watchdogWaitTillSignatureExpiry(): Error when checking signature expiry: ", e);
            }
        }
        if (abortSignal != null)
            abortSignal.throwIfAborted();
    }
    /**
     * Periodically checks the chain to see whether the swap is committed
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    async watchdogWaitTillCommited(abortSignal, interval = 5) {
        let status = base_1.SwapCommitStatus.NOT_COMMITED;
        while (status === base_1.SwapCommitStatus.NOT_COMMITED) {
            await (0, Utils_1.timeoutPromise)(interval * 1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this._getInitiator(), this.data);
                if (status === base_1.SwapCommitStatus.NOT_COMMITED &&
                    await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData))
                    return false;
            }
            catch (e) {
                this.logger.error("watchdogWaitTillCommited(): Error when fetching commit status or signature expiry: ", e);
            }
        }
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        return true;
    }
    /**
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    async watchdogWaitTillResult(abortSignal, interval = 5) {
        let status = base_1.SwapCommitStatus.COMMITED;
        while (status === base_1.SwapCommitStatus.COMMITED || status === base_1.SwapCommitStatus.REFUNDABLE) {
            await (0, Utils_1.timeoutPromise)(interval * 1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this._getInitiator(), this.data);
            }
            catch (e) {
                this.logger.error("watchdogWaitTillResult(): Error when fetching commit status: ", e);
            }
        }
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        return status;
    }
    //////////////////////////////
    //// Quote verification
    /**
     * Checks if the swap's quote is expired for good (i.e. the swap strictly cannot be committed on-chain anymore)
     */
    async verifyQuoteDefinitelyExpired() {
        return (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData));
    }
    /**
     * Checks if the swap's quote is still valid
     */
    async verifyQuoteValid() {
        try {
            await (0, Utils_1.tryWithRetries)(() => this.wrapper.contract.isValidInitAuthorization(this.data, this.signatureData, this.feeRate), null, base_1.SignatureVerificationError);
            return true;
        }
        catch (e) {
            if (e instanceof base_1.SignatureVerificationError) {
                return false;
            }
        }
    }
    //////////////////////////////
    //// Amounts & fees
    /**
     * Get the estimated smart chain fee of the commit transaction
     */
    getCommitFee() {
        return this.wrapper.contract.getCommitFee(this.data, this.feeRate);
    }
    /**
     * Returns the transaction fee paid on the smart chain
     */
    async getSmartChainNetworkFee() {
        const swapContract = this.wrapper.contract;
        return (0, Tokens_1.toTokenAmount)(await (swapContract.getRawCommitFee != null ?
            swapContract.getRawCommitFee(this.data, this.feeRate) :
            swapContract.getCommitFee(this.data, this.feeRate)), this.wrapper.getNativeToken(), this.wrapper.prices);
    }
    serialize() {
        return {
            ...super.serialize(),
            data: this.data != null ? this.data.serialize() : null,
            prefix: this.signatureData?.prefix,
            timeout: this.signatureData?.timeout,
            signature: this.signatureData?.signature,
            feeRate: this.feeRate == null ? null : this.feeRate.toString(),
            commitTxId: this.commitTxId,
            claimTxId: this.claimTxId,
            refundTxId: this.refundTxId
        };
    }
    ;
}
exports.IEscrowSwap = IEscrowSwap;
