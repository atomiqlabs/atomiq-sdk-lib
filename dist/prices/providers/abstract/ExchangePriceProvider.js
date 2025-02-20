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
exports.ExchangePriceProvider = void 0;
const HttpPriceProvider_1 = require("./HttpPriceProvider");
const BN = require("bn.js");
class ExchangePriceProvider extends HttpPriceProvider_1.HttpPriceProvider {
    fetchPrice(token, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const pairs = token.coinId.split(";");
            const prices = yield Promise.all(pairs.map(pair => {
                let invert = pair.startsWith("!");
                if (invert)
                    pair = pair.substring(1);
                return this.fetchPair(pair, abortSignal).then(value => invert ? 1 / value : value);
            }));
            const price = prices.reduce((previousValue, currentValue) => previousValue * currentValue, 1);
            return new BN(Math.floor(price * 100000000000000).toString(10));
        });
    }
}
exports.ExchangePriceProvider = ExchangePriceProvider;
