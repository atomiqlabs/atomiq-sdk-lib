"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ISwapPrice = exports.isPriceInfoType = void 0;
function isPriceInfoType(obj) {
    return obj != null &&
        typeof (obj.isValid) === "boolean" &&
        typeof (obj.differencePPM) === "bigint" &&
        typeof (obj.satsBaseFee) === "bigint" &&
        typeof (obj.feePPM) === "bigint" &&
        typeof (obj.realPriceUSatPerToken) === "bigint" &&
        typeof (obj.swapPriceUSatPerToken) === "bigint";
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
        const totalSats = (amountSats * (1000000n + feePPM) / 1000000n)
            + satsBaseFee;
        const totalUSats = totalSats * 1000000n;
        const swapPriceUSatPerToken = totalUSats * (10n ** BigInt(this.getDecimals(chainIdentifier, token))) / paidToken;
        return {
            isValid: true,
            differencePPM: 0n,
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
    async isValidAmountSend(chainIdentifier, amountSats, satsBaseFee, feePPM, paidToken, token, abortSignal, preFetchedPrice) {
        const totalSats = (amountSats * (1000000n + feePPM) / 1000000n)
            + satsBaseFee;
        const totalUSats = totalSats * 1000000n;
        const swapPriceUSatPerToken = totalUSats * (10n ** BigInt(this.getDecimals(chainIdentifier, token))) / paidToken;
        if (this.shouldIgnore(chainIdentifier, token))
            return {
                isValid: true,
                differencePPM: 0n,
                satsBaseFee,
                feePPM,
                realPriceUSatPerToken: null,
                swapPriceUSatPerToken
            };
        const calculatedAmtInToken = await this.getFromBtcSwapAmount(chainIdentifier, totalSats, token, abortSignal, preFetchedPrice);
        const realPriceUSatPerToken = totalUSats * (10n ** BigInt(this.getDecimals(chainIdentifier, token))) / calculatedAmtInToken;
        const difference = paidToken - calculatedAmtInToken; //Will be >0 if we need to pay more than we should've
        const differencePPM = difference * 1000000n / calculatedAmtInToken;
        return {
            isValid: differencePPM <= this.maxAllowedFeeDifferencePPM,
            differencePPM,
            satsBaseFee,
            feePPM,
            realPriceUSatPerToken,
            swapPriceUSatPerToken
        };
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
        const totalSats = (amountSats * (1000000n - feePPM) / 1000000n)
            - satsBaseFee;
        const totalUSats = totalSats * 1000000n;
        const swapPriceUSatPerToken = totalUSats * (10n ** BigInt(this.getDecimals(chainIdentifier, token))) / receiveToken;
        return {
            isValid: true,
            differencePPM: 0n,
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
    async isValidAmountReceive(chainIdentifier, amountSats, satsBaseFee, feePPM, receiveToken, token, abortSignal, preFetchedPrice) {
        const totalSats = (amountSats * (1000000n - feePPM) / 1000000n)
            - satsBaseFee;
        const totalUSats = totalSats * 1000000n;
        const swapPriceUSatPerToken = totalUSats * (10n ** BigInt(this.getDecimals(chainIdentifier, token))) / receiveToken;
        if (this.shouldIgnore(chainIdentifier, token))
            return {
                isValid: true,
                differencePPM: 0n,
                satsBaseFee,
                feePPM,
                realPriceUSatPerToken: null,
                swapPriceUSatPerToken
            };
        const calculatedAmtInToken = await this.getFromBtcSwapAmount(chainIdentifier, totalSats, token, abortSignal, preFetchedPrice);
        const realPriceUSatPerToken = totalUSats * (10n ** BigInt(this.getDecimals(chainIdentifier, token))) / calculatedAmtInToken;
        const difference = calculatedAmtInToken - receiveToken; //Will be >0 if we receive less than we should've
        const differencePPM = difference * 100000n / calculatedAmtInToken;
        return {
            isValid: differencePPM <= this.maxAllowedFeeDifferencePPM,
            differencePPM,
            satsBaseFee,
            feePPM,
            realPriceUSatPerToken,
            swapPriceUSatPerToken
        };
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
    async getFromBtcSwapAmount(chainIdentifier, fromAmount, toToken, abortSignal, preFetchedPrice) {
        if (this.getDecimals(chainIdentifier, toToken.toString()) == null)
            throw new Error("Token not found!");
        const price = preFetchedPrice || await this.getPrice(chainIdentifier, toToken, abortSignal);
        return fromAmount
            * (10n ** BigInt(this.getDecimals(chainIdentifier, toToken.toString())))
            * (1000000n) //To usat
            / (price);
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
    async getToBtcSwapAmount(chainIdentifier, fromAmount, fromToken, abortSignal, preFetchedPrice) {
        if (this.getDecimals(chainIdentifier, fromToken.toString()) == null)
            throw new Error("Token not found");
        const price = preFetchedPrice || await this.getPrice(chainIdentifier, fromToken, abortSignal);
        return fromAmount
            * price
            / 1000000n
            / (10n ** BigInt(this.getDecimals(chainIdentifier, fromToken.toString())));
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
    async getBtcUsdValue(btcSats, abortSignal, preFetchedPrice) {
        return Number(btcSats) * (preFetchedPrice || await this.getUsdPrice(abortSignal));
    }
    async getTokenUsdValue(chainId, tokenAmount, token, abortSignal, preFetchedPrice) {
        const [btcAmount, usdPrice] = await Promise.all([
            this.getToBtcSwapAmount(chainId, tokenAmount, token, abortSignal),
            preFetchedPrice == null ? this.preFetchUsdPrice(abortSignal) : Promise.resolve(preFetchedPrice)
        ]);
        return Number(btcAmount) * usdPrice;
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
