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
exports.KrakenPriceProvider = void 0;
const ExchangePriceProvider_1 = require("./abstract/ExchangePriceProvider");
const Utils_1 = require("../../utils/Utils");
const BN = require("bn.js");
class KrakenPriceProvider extends ExchangePriceProvider_1.ExchangePriceProvider {
    constructor(coinsMap, url = "https://api.kraken.com/0", httpRequestTimeout) {
        super(coinsMap, url, httpRequestTimeout);
    }
    fetchPair(pair, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield (0, Utils_1.httpGet)(this.url + "/public/Ticker?pair=" + pair, this.httpRequestTimeout, abortSignal);
            return parseFloat(response.result[pair].c[0]);
        });
    }
    fetchUsdPrice(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield (0, Utils_1.httpGet)(this.url + "/public/Ticker?pair=XBTUSDC", this.httpRequestTimeout, abortSignal);
            return parseFloat(response.result["XBTUSDC"].c[0]) / 100000000;
        });
    }
    fetchPrice(token, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const pairs = token.coinId.split(";");
            const response = yield (0, Utils_1.httpGet)(this.url + "/public/Ticker?pair=" + pairs.map(val => val.startsWith("!") ? val.substring(1) : val).join(","), this.httpRequestTimeout, abortSignal);
            const prices = pairs.map(pair => {
                let invert = pair.startsWith("!");
                if (invert)
                    pair = pair.substring(1);
                return parseFloat(response.result[pair].c[0]);
            });
            const price = prices.reduce((previousValue, currentValue) => previousValue * currentValue, 1);
            return new BN(Math.floor(price * 100000000000000));
        });
    }
}
exports.KrakenPriceProvider = KrakenPriceProvider;
