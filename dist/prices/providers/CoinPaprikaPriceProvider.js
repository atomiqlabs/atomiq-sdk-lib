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
exports.CoinPaprikaPriceProvider = void 0;
const BN = require("bn.js");
const HttpPriceProvider_1 = require("./abstract/HttpPriceProvider");
const Utils_1 = require("../../utils/Utils");
class CoinPaprikaPriceProvider extends HttpPriceProvider_1.HttpPriceProvider {
    constructor(coinsMap, url = "https://api.coinpaprika.com/v1", httpRequestTimeout) {
        super(coinsMap, url, httpRequestTimeout);
    }
    fetchPrice(token, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield (0, Utils_1.httpGet)(this.url + "/tickers/" + token.coinId + "?quotes=BTC", this.httpRequestTimeout, abortSignal);
            return new BN(response.quotes.BTC.price * 100000000000000);
        });
    }
    fetchUsdPrice(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield (0, Utils_1.httpGet)(this.url + "/tickers/btc-bitcoin?quotes=USD", this.httpRequestTimeout, abortSignal);
            return response.quotes.USD.price / 100000000;
        });
    }
}
exports.CoinPaprikaPriceProvider = CoinPaprikaPriceProvider;
