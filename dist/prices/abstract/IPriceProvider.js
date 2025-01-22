"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IPriceProvider = void 0;
const BN = require("bn.js");
class IPriceProvider {
    constructor(coins) {
        var _a;
        var _b;
        this.coinsMap = {};
        for (let coinData of coins) {
            for (let chainId in coinData.chains) {
                const { address, decimals } = coinData.chains[chainId];
                (_a = (_b = this.coinsMap)[chainId]) !== null && _a !== void 0 ? _a : (_b[chainId] = {});
                this.coinsMap[chainId][address.toString()] = {
                    coinId: coinData.coinId,
                    decimals
                };
            }
        }
    }
    /**
     * Returns coin price in uSat (microSat)
     *
     * @param chainIdentifier
     * @param token
     * @param abortSignal
     * @throws {Error} if token is not found
     */
    getPrice(chainIdentifier, token, abortSignal) {
        let tokenAddress = token.toString();
        const chainTokens = this.coinsMap[chainIdentifier];
        if (chainTokens == null)
            throw new Error("Chain not found");
        const coin = chainTokens[tokenAddress];
        if (coin == null)
            throw new Error("Token not found");
        if (coin.coinId.startsWith("$fixed-")) {
            const amt = parseFloat(coin.coinId.substring(7));
            return Promise.resolve(new BN(Math.floor(amt * 1000000)));
        }
        return this.fetchPrice(coin, abortSignal);
    }
    /**
     * Returns coin price in uSat (microSat)
     *
     * @param abortSignal
     * @throws {Error} if token is not found
     */
    getUsdPrice(abortSignal) {
        return this.fetchUsdPrice(abortSignal);
    }
    /**
     * Returns the decimal places of the specified token, or -1 if token should be ignored, returns null if
     *  token is not found
     *
     * @param chainIdentifier
     * @param token
     * @protected
     * @throws {Error} If token is not found
     */
    getDecimals(chainIdentifier, token) {
        const chainTokens = this.coinsMap[chainIdentifier];
        if (chainTokens == null)
            throw new Error("Chain not found");
        const coin = chainTokens[token.toString()];
        if (coin == null)
            throw new Error("Token not found");
        return coin.coinId === "$ignore" ? -1 : coin.decimals;
    }
}
exports.IPriceProvider = IPriceProvider;
