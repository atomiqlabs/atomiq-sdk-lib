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
exports.ISwapPrice = exports.isPriceInfoType = void 0;
const BN = require("bn.js");
function isPriceInfoType(obj) {
    return obj != null &&
        typeof (obj.isValid) === "boolean" &&
        BN.isBN(obj.differencePPM) &&
        BN.isBN(obj.satsBaseFee) &&
        BN.isBN(obj.feePPM) &&
        BN.isBN(obj.realPriceUSatPerToken) &&
        BN.isBN(obj.swapPriceUSatPerToken);
}
exports.isPriceInfoType = isPriceInfoType;
class ISwapPrice {
    constructor(maxAllowedFeeDifferencePPM) {
        this.maxAllowedFeeDifferencePPM = maxAllowedFeeDifferencePPM;
    }
    /**
     * Recomputes pricing info without fetching the current price
     *
     * @param chainIdentifier
     * @param amountSats
     * @param satsBaseFee
     * @param feePPM
     * @param paidToken
     * @param token
     */
    recomputePriceInfoSend(chainIdentifier, amountSats, satsBaseFee, feePPM, paidToken, token) {
        const totalSats = amountSats.mul(new BN(1000000).add(feePPM)).div(new BN(1000000))
            .add(satsBaseFee);
        const totalUSats = totalSats.mul(new BN(1000000));
        const swapPriceUSatPerToken = totalUSats.mul(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, token)))).div(paidToken);
        return {
            isValid: true,
            differencePPM: new BN(0),
            satsBaseFee,
            feePPM,
            realPriceUSatPerToken: this.shouldIgnore(chainIdentifier, token) ? null : swapPriceUSatPerToken,
            swapPriceUSatPerToken
        };
    }
    /**
     * Checks whether the swap amounts are valid given the current market rate for a given pair
     *
     * @param chainIdentifier
     * @param amountSats Amount of sats (BTC) to be received from the swap
     * @param satsBaseFee Base fee in sats (BTC) as reported by the intermediary
     * @param feePPM PPM fee rate as reported by the intermediary
     * @param paidToken Amount of token to be paid to the swap
     * @param token
     * @param abortSignal
     * @param preFetchedPrice Already pre-fetched price
     */
    isValidAmountSend(chainIdentifier, amountSats, satsBaseFee, feePPM, paidToken, token, abortSignal, preFetchedPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            const totalSats = amountSats.mul(new BN(1000000).add(feePPM)).div(new BN(1000000))
                .add(satsBaseFee);
            const totalUSats = totalSats.mul(new BN(1000000));
            const swapPriceUSatPerToken = totalUSats.mul(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, token)))).div(paidToken);
            if (this.shouldIgnore(chainIdentifier, token))
                return {
                    isValid: true,
                    differencePPM: new BN(0),
                    satsBaseFee,
                    feePPM,
                    realPriceUSatPerToken: null,
                    swapPriceUSatPerToken
                };
            const calculatedAmtInToken = yield this.getFromBtcSwapAmount(chainIdentifier, totalSats, token, abortSignal, preFetchedPrice);
            const realPriceUSatPerToken = totalUSats.mul(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, token)))).div(calculatedAmtInToken);
            const difference = paidToken.sub(calculatedAmtInToken); //Will be >0 if we need to pay more than we should've
            const differencePPM = difference.mul(new BN(1000000)).div(calculatedAmtInToken);
            return {
                isValid: differencePPM.lte(this.maxAllowedFeeDifferencePPM),
                differencePPM,
                satsBaseFee,
                feePPM,
                realPriceUSatPerToken,
                swapPriceUSatPerToken
            };
        });
    }
    /**
     * Recomputes pricing info without fetching the current price
     *
     * @param chainIdentifier
     * @param amountSats
     * @param satsBaseFee
     * @param feePPM
     * @param receiveToken
     * @param token
     */
    recomputePriceInfoReceive(chainIdentifier, amountSats, satsBaseFee, feePPM, receiveToken, token) {
        const totalSats = amountSats.mul(new BN(1000000).sub(feePPM)).div(new BN(1000000))
            .sub(satsBaseFee);
        const totalUSats = totalSats.mul(new BN(1000000));
        const swapPriceUSatPerToken = totalUSats.mul(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, token)))).div(receiveToken);
        return {
            isValid: true,
            differencePPM: new BN(0),
            satsBaseFee,
            feePPM,
            realPriceUSatPerToken: this.shouldIgnore(chainIdentifier, token) ? null : swapPriceUSatPerToken,
            swapPriceUSatPerToken
        };
    }
    /**
     * Checks whether the swap amounts are valid given the current market rate for a given pair
     *
     * @param chainIdentifier
     * @param amountSats Amount of sats (BTC) to be paid to the swap
     * @param satsBaseFee Base fee in sats (BTC) as reported by the intermediary
     * @param feePPM PPM fee rate as reported by the intermediary
     * @param receiveToken Amount of token to be received from the swap
     * @param token
     * @param abortSignal
     * @param preFetchedPrice Already pre-fetched price
     */
    isValidAmountReceive(chainIdentifier, amountSats, satsBaseFee, feePPM, receiveToken, token, abortSignal, preFetchedPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            const totalSats = amountSats.mul(new BN(1000000).sub(feePPM)).div(new BN(1000000))
                .sub(satsBaseFee);
            const totalUSats = totalSats.mul(new BN(1000000));
            const swapPriceUSatPerToken = totalUSats.mul(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, token)))).div(receiveToken);
            if (this.shouldIgnore(chainIdentifier, token))
                return {
                    isValid: true,
                    differencePPM: new BN(0),
                    satsBaseFee,
                    feePPM,
                    realPriceUSatPerToken: null,
                    swapPriceUSatPerToken
                };
            const calculatedAmtInToken = yield this.getFromBtcSwapAmount(chainIdentifier, totalSats, token, abortSignal, preFetchedPrice);
            const realPriceUSatPerToken = totalUSats.mul(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, token)))).div(calculatedAmtInToken);
            const difference = calculatedAmtInToken.sub(receiveToken); //Will be >0 if we receive less than we should've
            const differencePPM = difference.mul(new BN(1000000)).div(calculatedAmtInToken);
            return {
                isValid: differencePPM.lte(this.maxAllowedFeeDifferencePPM),
                differencePPM,
                satsBaseFee,
                feePPM,
                realPriceUSatPerToken,
                swapPriceUSatPerToken
            };
        });
    }
    preFetchPrice(chainIdentifier, token, abortSignal) {
        return this.getPrice(chainIdentifier, token, abortSignal);
    }
    preFetchUsdPrice(abortSignal) {
        return this.getUsdPrice(abortSignal);
    }
    /**
     * Returns amount of {toToken} that are equivalent to {fromAmount} satoshis
     *
     * @param chainIdentifier
     * @param fromAmount        Amount of satoshis
     * @param toToken           Token
     * @param abortSignal
     * @param preFetchedPrice
     * @throws {Error} when token is not found
     */
    getFromBtcSwapAmount(chainIdentifier, fromAmount, toToken, abortSignal, preFetchedPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.getDecimals(chainIdentifier, toToken.toString()) == null)
                throw new Error("Token not found!");
            const price = preFetchedPrice || (yield this.getPrice(chainIdentifier, toToken, abortSignal));
            return fromAmount
                .mul(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, toToken.toString()))))
                .mul(new BN(1000000)) //To usat
                .div(price);
        });
    }
    /**
     * Returns amount of satoshis that are equivalent to {fromAmount} of {fromToken}
     *
     * @param chainIdentifier
     * @param fromAmount Amount of the token
     * @param fromToken Token
     * @param abortSignal
     * @param preFetchedPrice Pre-fetched swap price if available
     * @throws {Error} when token is not found
     */
    getToBtcSwapAmount(chainIdentifier, fromAmount, fromToken, abortSignal, preFetchedPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.getDecimals(chainIdentifier, fromToken.toString()) == null)
                throw new Error("Token not found");
            const price = preFetchedPrice || (yield this.getPrice(chainIdentifier, fromToken, abortSignal));
            return fromAmount
                .mul(price)
                .div(new BN(1000000))
                .div(new BN(10).pow(new BN(this.getDecimals(chainIdentifier, fromToken.toString()))));
        });
    }
    /**
     * Returns whether the token should be ignored and pricing for it not calculated
     * @param chainIdentifier
     * @param tokenAddress
     * @throws {Error} if token is not found
     */
    shouldIgnore(chainIdentifier, tokenAddress) {
        const coin = this.getDecimals(chainIdentifier, tokenAddress.toString());
        if (coin == null)
            throw new Error("Token not found");
        return coin === -1;
    }
    getBtcUsdValue(btcSats, abortSignal, preFetchedPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            return btcSats.toNumber() * (preFetchedPrice || (yield this.getUsdPrice(abortSignal)));
        });
    }
    getTokenUsdValue(chainId, tokenAmount, token, abortSignal, preFetchedPrice) {
        return __awaiter(this, void 0, void 0, function* () {
            const [btcAmount, usdPrice] = yield Promise.all([
                this.getToBtcSwapAmount(chainId, tokenAmount, token, abortSignal),
                preFetchedPrice == null ? this.preFetchUsdPrice(abortSignal) : Promise.resolve(preFetchedPrice)
            ]);
            return btcAmount.toNumber() * usdPrice;
        });
    }
    getUsdValue(amount, token, abortSignal, preFetchedUsdPrice) {
        if (token.chain === "BTC") {
            return this.getBtcUsdValue(amount, abortSignal, preFetchedUsdPrice);
        }
        else {
            return this.getTokenUsdValue(token.chainId, amount, token.address, abortSignal, preFetchedUsdPrice);
        }
    }
}
exports.ISwapPrice = ISwapPrice;
