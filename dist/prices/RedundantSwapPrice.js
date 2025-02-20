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
exports.RedundantSwapPrice = void 0;
const BinancePriceProvider_1 = require("./providers/BinancePriceProvider");
const OKXPriceProvider_1 = require("./providers/OKXPriceProvider");
const CoinGeckoPriceProvider_1 = require("./providers/CoinGeckoPriceProvider");
const CoinPaprikaPriceProvider_1 = require("./providers/CoinPaprikaPriceProvider");
const Utils_1 = require("../utils/Utils");
const ICachedSwapPrice_1 = require("./abstract/ICachedSwapPrice");
const RequestError_1 = require("../errors/RequestError");
const KrakenPriceProvider_1 = require("./providers/KrakenPriceProvider");
const logger = (0, Utils_1.getLogger)("RedundantSwapPrice: ");
/**
 * Swap price API using multiple price sources, handles errors on the APIs and automatically switches between them, such
 *  that there always is a functional API
 */
class RedundantSwapPrice extends ICachedSwapPrice_1.ICachedSwapPrice {
    static createFromTokenMap(maxAllowedFeeDiffPPM, assets, cacheTimeout) {
        const priceApis = [
            new BinancePriceProvider_1.BinancePriceProvider(assets.map(coinData => {
                return {
                    coinId: coinData.binancePair,
                    chains: coinData.chains
                };
            })),
            new OKXPriceProvider_1.OKXPriceProvider(assets.map(coinData => {
                return {
                    coinId: coinData.okxPair,
                    chains: coinData.chains
                };
            })),
            new CoinGeckoPriceProvider_1.CoinGeckoPriceProvider(assets.map(coinData => {
                return {
                    coinId: coinData.coinGeckoCoinId,
                    chains: coinData.chains
                };
            })),
            new CoinPaprikaPriceProvider_1.CoinPaprikaPriceProvider(assets.map(coinData => {
                return {
                    coinId: coinData.coinPaprikaCoinId,
                    chains: coinData.chains
                };
            })),
            new KrakenPriceProvider_1.KrakenPriceProvider(assets.map(coinData => {
                return {
                    coinId: coinData.krakenPair,
                    chains: coinData.chains
                };
            }))
        ];
        return new RedundantSwapPrice(maxAllowedFeeDiffPPM, assets, priceApis, cacheTimeout);
    }
    constructor(maxAllowedFeeDiffPPM, coinsDecimals, priceApis, cacheTimeout) {
        var _a;
        var _b;
        super(maxAllowedFeeDiffPPM, cacheTimeout);
        this.coinsDecimals = {};
        for (let coinData of coinsDecimals) {
            for (let chainId in coinData.chains) {
                const { address, decimals } = coinData.chains[chainId];
                (_a = (_b = this.coinsDecimals)[chainId]) !== null && _a !== void 0 ? _a : (_b[chainId] = {});
                this.coinsDecimals[chainId][address.toString()] = decimals;
            }
        }
        this.priceApis = priceApis.map(api => {
            return {
                priceApi: api,
                operational: null
            };
        });
    }
    /**
     * Returns price api that should be operational
     *
     * @private
     */
    getOperationalPriceApi() {
        return this.priceApis.find(e => e.operational === true);
    }
    /**
     * Returns price apis that are maybe operational, in case none is considered operational returns all of the price
     *  apis such that they can be tested again whether they are operational
     *
     * @private
     */
    getMaybeOperationalPriceApis() {
        let operational = this.priceApis.filter(e => e.operational === true || e.operational === null);
        if (operational.length === 0) {
            this.priceApis.forEach(e => e.operational = null);
            operational = this.priceApis;
        }
        return operational;
    }
    /**
     * Fetches price in parallel from multiple maybe operational price APIs
     *
     * @param chainIdentifier
     * @param token
     * @param abortSignal
     * @private
     */
    fetchPriceFromMaybeOperationalPriceApis(chainIdentifier, token, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield (0, Utils_1.promiseAny)(this.getMaybeOperationalPriceApis().map(obj => (() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const price = yield obj.priceApi.getPrice(chainIdentifier, token, abortSignal);
                        logger.debug("fetchPrice(): Price from " + obj.priceApi.constructor.name + ": ", price.toString(10));
                        obj.operational = true;
                        return price;
                    }
                    catch (e) {
                        if (abortSignal != null)
                            abortSignal.throwIfAborted();
                        obj.operational = false;
                        throw e;
                    }
                }))()));
            }
            catch (e) {
                if (abortSignal != null)
                    abortSignal.throwIfAborted();
                throw e.find(err => !(err instanceof RequestError_1.RequestError)) || e[0];
            }
        });
    }
    /**
     * Fetches the prices, first tries to use the operational price API (if any) and if that fails it falls back
     *  to using maybe operational price APIs
     *
     * @param chainIdentifier
     * @param token
     * @param abortSignal
     * @private
     */
    fetchPrice(chainIdentifier, token, abortSignal) {
        return (0, Utils_1.tryWithRetries)(() => {
            const operationalPriceApi = this.getOperationalPriceApi();
            if (operationalPriceApi != null) {
                return operationalPriceApi.priceApi.getPrice(chainIdentifier, token, abortSignal).catch(err => {
                    if (abortSignal != null)
                        abortSignal.throwIfAborted();
                    operationalPriceApi.operational = false;
                    return this.fetchPriceFromMaybeOperationalPriceApis(chainIdentifier, token, abortSignal);
                });
            }
            return this.fetchPriceFromMaybeOperationalPriceApis(chainIdentifier, token, abortSignal);
        }, null, RequestError_1.RequestError, abortSignal);
    }
    getDecimals(chainIdentifier, token) {
        if (this.coinsDecimals[chainIdentifier] == null)
            return null;
        return this.coinsDecimals[chainIdentifier][token.toString()];
    }
    /**
     * Fetches BTC price in USD in parallel from multiple maybe operational price APIs
     *
     * @param abortSignal
     * @private
     */
    fetchUsdPriceFromMaybeOperationalPriceApis(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield (0, Utils_1.promiseAny)(this.getMaybeOperationalPriceApis().map(obj => (() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const price = yield obj.priceApi.getUsdPrice(abortSignal);
                        logger.debug("fetchPrice(): USD price from " + obj.priceApi.constructor.name + ": ", price.toString(10));
                        obj.operational = true;
                        return price;
                    }
                    catch (e) {
                        if (abortSignal != null)
                            abortSignal.throwIfAborted();
                        obj.operational = false;
                        throw e;
                    }
                }))()));
            }
            catch (e) {
                if (abortSignal != null)
                    abortSignal.throwIfAborted();
                throw e.find(err => !(err instanceof RequestError_1.RequestError)) || e[0];
            }
        });
    }
    fetchUsdPrice(abortSignal) {
        return (0, Utils_1.tryWithRetries)(() => {
            const operationalPriceApi = this.getOperationalPriceApi();
            if (operationalPriceApi != null) {
                return operationalPriceApi.priceApi.getUsdPrice(abortSignal).catch(err => {
                    if (abortSignal != null)
                        abortSignal.throwIfAborted();
                    operationalPriceApi.operational = false;
                    return this.fetchUsdPriceFromMaybeOperationalPriceApis(abortSignal);
                });
            }
            return this.fetchUsdPriceFromMaybeOperationalPriceApis(abortSignal);
        }, null, RequestError_1.RequestError, abortSignal);
    }
}
exports.RedundantSwapPrice = RedundantSwapPrice;
