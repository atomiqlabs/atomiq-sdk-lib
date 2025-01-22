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
exports.CoinGeckoPriceProvider = void 0;
const BN = require("bn.js");
const HttpPriceProvider_1 = require("./abstract/HttpPriceProvider");
const Utils_1 = require("../../utils/Utils");
class CoinGeckoPriceProvider extends HttpPriceProvider_1.HttpPriceProvider {
    constructor(coinsMap, url = "https://api.coingecko.com/api/v3", httpRequestTimeout) {
        super(coinsMap, url, httpRequestTimeout);
    }
    fetchPrice(token, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield (0, Utils_1.httpGet)(this.url + "/simple/price?ids=" + token.coinId + "&vs_currencies=sats&precision=6", this.httpRequestTimeout, abortSignal);
            return new BN(response[token.coinId].sats * 1000000);
        });
    }
    fetchUsdPrice(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield (0, Utils_1.httpGet)(this.url + "/simple/price?ids=bitcoin&vs_currencies=usd&precision=9", this.httpRequestTimeout, abortSignal);
            return response["bitcoin"].usd / 100000000;
        });
    }
}
exports.CoinGeckoPriceProvider = CoinGeckoPriceProvider;
