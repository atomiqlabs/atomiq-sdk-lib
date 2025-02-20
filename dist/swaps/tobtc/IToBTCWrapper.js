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
exports.IToBTCWrapper = void 0;
const IToBTCSwap_1 = require("./IToBTCSwap");
const base_1 = require("@atomiqlabs/base");
const ISwapWrapper_1 = require("../ISwapWrapper");
const Utils_1 = require("../../utils/Utils");
const IntermediaryError_1 = require("../../errors/IntermediaryError");
class IToBTCWrapper extends ISwapWrapper_1.ISwapWrapper {
    /**
     * Checks the swap's state on-chain and compares it to its internal state, updates/changes it according to on-chain
     *  data
     *
     * @param swap Swap to be checked
     * @private
     */
    syncStateFromChain(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swap.state === IToBTCSwap_1.ToBTCSwapState.CREATED ||
                swap.state === IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED ||
                swap.state === IToBTCSwap_1.ToBTCSwapState.COMMITED ||
                swap.state === IToBTCSwap_1.ToBTCSwapState.SOFT_CLAIMED ||
                swap.state === IToBTCSwap_1.ToBTCSwapState.REFUNDABLE) {
                const res = yield (0, Utils_1.tryWithRetries)(() => this.contract.getCommitStatus(swap.getInitiator(), swap.data));
                switch (res) {
                    case base_1.SwapCommitStatus.PAID:
                        swap.state = IToBTCSwap_1.ToBTCSwapState.CLAIMED;
                        return true;
                    case base_1.SwapCommitStatus.REFUNDABLE:
                        swap.state = IToBTCSwap_1.ToBTCSwapState.REFUNDABLE;
                        return true;
                    case base_1.SwapCommitStatus.EXPIRED:
                        swap.state = IToBTCSwap_1.ToBTCSwapState.QUOTE_EXPIRED;
                        return true;
                    case base_1.SwapCommitStatus.NOT_COMMITED:
                        if (swap.state === IToBTCSwap_1.ToBTCSwapState.COMMITED || swap.state === IToBTCSwap_1.ToBTCSwapState.REFUNDABLE) {
                            swap.state = IToBTCSwap_1.ToBTCSwapState.REFUNDED;
                            return true;
                        }
                        break;
                    case base_1.SwapCommitStatus.COMMITED:
                        if (swap.state !== IToBTCSwap_1.ToBTCSwapState.COMMITED && swap.state !== IToBTCSwap_1.ToBTCSwapState.REFUNDABLE) {
                            swap.state = IToBTCSwap_1.ToBTCSwapState.COMMITED;
                            return true;
                        }
                        break;
                }
            }
        });
    }
    /**
     * Pre-fetches intermediary's reputation, doesn't throw, instead aborts via abortController and returns null
     *
     * @param amountData
     * @param lp Intermediary
     * @param abortController
     * @protected
     * @returns Intermediary's reputation or null if failed
     * @throws {IntermediaryError} If the intermediary vault doesn't exist
     */
    preFetchIntermediaryReputation(amountData, lp, abortController) {
        return lp.getReputation(this.chainIdentifier, this.contract, [amountData.token.toString()], abortController.signal).then(res => {
            if (res == null)
                throw new IntermediaryError_1.IntermediaryError("Invalid data returned - invalid LP vault");
            return res;
        }).catch(e => {
            this.logger.error("preFetchIntermediaryReputation(): Error: ", e);
            abortController.abort(e);
            return null;
        });
    }
    /**
     * Pre-fetches feeRate for a given swap
     *
     * @param signer Address of the swap initiator
     * @param amountData
     * @param claimHash optional hash of the swap or null
     * @param abortController
     * @protected
     * @returns Fee rate
     */
    preFetchFeeRate(signer, amountData, claimHash, abortController) {
        return (0, Utils_1.tryWithRetries)(() => this.contract.getInitPayInFeeRate(signer, null, amountData.token, claimHash), null, null, abortController.signal).catch(e => {
            this.logger.error("preFetchFeeRate(): Error: ", e);
            abortController.abort(e);
            return null;
        });
    }
    checkPastSwap(swap) {
        return __awaiter(this, void 0, void 0, function* () {
            let changed = yield this.syncStateFromChain(swap);
            if ((swap.state === IToBTCSwap_1.ToBTCSwapState.CREATED || swap.state === IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED) && !(yield swap.isQuoteValid())) {
                //Check if quote is still valid
                swap.state = IToBTCSwap_1.ToBTCSwapState.QUOTE_EXPIRED;
                changed || (changed = true);
            }
            if (swap.state === IToBTCSwap_1.ToBTCSwapState.COMMITED || swap.state === IToBTCSwap_1.ToBTCSwapState.SOFT_CLAIMED) {
                //Check if that maybe already concluded
                changed || (changed = yield swap.checkIntermediarySwapProcessed(false));
            }
            return changed;
        });
    }
    tickSwap(swap) {
        switch (swap.state) {
            case IToBTCSwap_1.ToBTCSwapState.CREATED:
                if (swap.expiry < Date.now())
                    swap._saveAndEmit(IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED);
                break;
            case IToBTCSwap_1.ToBTCSwapState.COMMITED:
            case IToBTCSwap_1.ToBTCSwapState.SOFT_CLAIMED:
                this.contract.isExpired(swap.getInitiator(), swap.data).then(expired => {
                    if (expired)
                        swap._saveAndEmit(IToBTCSwap_1.ToBTCSwapState.REFUNDABLE);
                });
                break;
        }
    }
    processEventInitialize(swap, event) {
        return __awaiter(this, void 0, void 0, function* () {
            if (swap.state === IToBTCSwap_1.ToBTCSwapState.CREATED || swap.state === IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED) {
                const swapData = yield event.swapData();
                if (swap.data != null && !swap.data.equals(swapData))
                    return false;
                if (swap.state === IToBTCSwap_1.ToBTCSwapState.CREATED || swap.state === IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED)
                    swap.state = IToBTCSwap_1.ToBTCSwapState.COMMITED;
                swap.data = swapData;
                return true;
            }
        });
    }
    processEventClaim(swap, event) {
        if (swap.state !== IToBTCSwap_1.ToBTCSwapState.REFUNDED) {
            swap.state = IToBTCSwap_1.ToBTCSwapState.CLAIMED;
            swap._setPaymentResult({ secret: event.result, txId: Buffer.from(event.result, "hex").reverse().toString("hex") });
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    processEventRefund(swap, event) {
        if (swap.state !== IToBTCSwap_1.ToBTCSwapState.CLAIMED) {
            swap.state = IToBTCSwap_1.ToBTCSwapState.REFUNDED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }
    isOurSwap(signer, swap) {
        return swap.data.isOfferer(signer);
    }
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getRefundableSwaps(signer) {
        return Promise.resolve(this.getRefundableSwapsSync(signer));
    }
    /**
     * Returns all swaps that are refundable, and optionally only those initiated with signer's address
     */
    getRefundableSwapsSync(signer) {
        return this.getAllSwapsSync(signer).filter(swap => swap.isRefundable());
    }
}
exports.IToBTCWrapper = IToBTCWrapper;
