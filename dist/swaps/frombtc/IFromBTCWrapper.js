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
exports.IFromBTCWrapper = void 0;
const ISwapWrapper_1 = require("../ISwapWrapper");
const BN = require("bn.js");
const randomBytes = require("randombytes");
const IntermediaryError_1 = require("../../errors/IntermediaryError");
const Utils_1 = require("../../utils/Utils");
class IFromBTCWrapper extends ISwapWrapper_1.ISwapWrapper {
    /**
     * Returns a random sequence to be used for swaps
     *
     * @protected
     * @returns Random 64-bit sequence number
     */
    getRandomSequence() {
        return new BN(randomBytes(8));
    }
    /**
     * Pre-fetches feeRate for a given swap
     *
     * @param signer Address initiating the swap
     * @param amountData
     * @param hash optional hash of the swap or null
     * @param abortController
     * @protected
     * @returns Fee rate
     */
    preFetchFeeRate(signer, amountData, hash, abortController) {
        return (0, Utils_1.tryWithRetries)(() => this.contract.getInitFeeRate(null, signer, amountData.token, hash), null, null, abortController.signal).catch(e => {
            this.logger.error("preFetchFeeRate(): Error: ", e);
            abortController.abort(e);
            return null;
        });
    }
    /**
     * Pre-fetches intermediary's available SC on-chain liquidity
     * @param amountData
     * @param lp Intermediary
     * @param abortController
     * @protected
     * @returns Intermediary's liquidity balance
     */
    preFetchIntermediaryLiquidity(amountData, lp, abortController) {
        return lp.getLiquidity(this.chainIdentifier, this.contract, amountData.token.toString(), abortController.signal).catch(e => {
            this.logger.error("preFetchIntermediaryLiquidity(): Error: ", e);
            abortController.abort(e);
            return null;
        });
    }
    /**
     * Verifies whether the intermediary has enough available liquidity such that we can initiate the swap
     *
     * @param amount Swap amount that we should receive
     * @param liquidityPromise pre-fetched liquidity promise as obtained from preFetchIntermediaryLiquidity()
     * @protected
     * @throws {IntermediaryError} if intermediary's liquidity is lower than what's required for the swap
     */
    verifyIntermediaryLiquidity(amount, liquidityPromise) {
        return __awaiter(this, void 0, void 0, function* () {
            const liquidity = yield liquidityPromise;
            if (liquidity.lt(amount))
                throw new IntermediaryError_1.IntermediaryError("Intermediary doesn't have enough liquidity");
        });
    }
    isOurSwap(signer, swap) {
        return swap.data.isClaimer(signer);
    }
    /**
     * Returns all swaps that are claimable, and optionally only those initiated with signer's address
     */
    getClaimableSwaps(signer) {
        return Promise.resolve(this.getClaimableSwapsSync(signer));
    }
    /**
     * Returns all swaps that are claimable, and optionally only those initiated with signer's address
     */
    getClaimableSwapsSync(signer) {
        return this.getAllSwapsSync(signer).filter(swap => swap.isClaimable());
    }
}
exports.IFromBTCWrapper = IFromBTCWrapper;
