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
exports.BinancePriceProvider = void 0;
const ExchangePriceProvider_1 = require("./abstract/ExchangePriceProvider");
const Utils_1 = require("../../utils/Utils");
class BinancePriceProvider extends ExchangePriceProvider_1.ExchangePriceProvider {
    constructor(coinsMap, url = "https://api.binance.com/api/v3", httpRequestTimeout) {
        super(coinsMap, url, httpRequestTimeout);
    }
    fetchPair(pair, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield (0, Utils_1.httpGet)(this.url + "/ticker/price?symbol=" + pair, this.httpRequestTimeout, abortSignal);
            return parseFloat(response.price);
        });
    }
    fetchUsdPrice(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield (0, Utils_1.httpGet)(this.url + "/ticker/price?symbol=BTCUSDC", this.httpRequestTimeout, abortSignal);
            return parseFloat(response.price) / 100000000;
        });
    }
}
exports.BinancePriceProvider = BinancePriceProvider;
