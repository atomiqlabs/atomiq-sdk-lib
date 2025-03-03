"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IToBTCWrapper = void 0;
const IToBTCSwap_1 = require("./IToBTCSwap");
const ISwapWrapper_1 = require("../ISwapWrapper");
const Utils_1 = require("../../utils/Utils");
const IntermediaryError_1 = require("../../errors/IntermediaryError");
class IToBTCWrapper extends ISwapWrapper_1.ISwapWrapper {
    constructor() {
        super(...arguments);
        this.pendingSwapStates = [
            IToBTCSwap_1.ToBTCSwapState.CREATED,
            IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED,
            IToBTCSwap_1.ToBTCSwapState.COMMITED,
            IToBTCSwap_1.ToBTCSwapState.SOFT_CLAIMED,
            IToBTCSwap_1.ToBTCSwapState.REFUNDABLE
        ];
        this.tickSwapState = [IToBTCSwap_1.ToBTCSwapState.CREATED, IToBTCSwap_1.ToBTCSwapState.COMMITED, IToBTCSwap_1.ToBTCSwapState.SOFT_CLAIMED];
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
    async processEventInitialize(swap, event) {
        if (swap.state === IToBTCSwap_1.ToBTCSwapState.CREATED || swap.state === IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED) {
            const swapData = await event.swapData();
            if (swap.data != null && !swap.data.equals(swapData))
                return false;
            if (swap.state === IToBTCSwap_1.ToBTCSwapState.CREATED || swap.state === IToBTCSwap_1.ToBTCSwapState.QUOTE_SOFT_EXPIRED)
                swap.state = IToBTCSwap_1.ToBTCSwapState.COMMITED;
            swap.data = swapData;
            return true;
        }
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
}
exports.IToBTCWrapper = IToBTCWrapper;
