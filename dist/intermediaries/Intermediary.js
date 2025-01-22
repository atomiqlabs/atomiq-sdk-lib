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
exports.Intermediary = void 0;
const SwapType_1 = require("../swaps/SwapType");
const Utils_1 = require("../utils/Utils");
class Intermediary {
    constructor(url, addresses, services, reputation = {}) {
        this.reputation = {};
        this.liquidity = {};
        this.url = url;
        this.addresses = addresses;
        this.services = services;
        this.reputation = reputation;
    }
    /**
     * Returns tokens supported by the intermediary, optionally constrained to the specific swap types
     *
     * @param chainIdentifier
     * @param swapTypesArr
     * @private
     */
    getSupportedTokens(chainIdentifier, swapTypesArr = [
        SwapType_1.SwapType.TO_BTC,
        SwapType_1.SwapType.TO_BTCLN,
        SwapType_1.SwapType.FROM_BTC,
        SwapType_1.SwapType.FROM_BTCLN
    ]) {
        const swapTypes = new Set(swapTypesArr);
        let tokens = new Set();
        swapTypes.forEach((swapType) => {
            if (this.services[swapType] != null &&
                this.services[swapType].chainTokens != null &&
                this.services[swapType].chainTokens[chainIdentifier] != null)
                this.services[swapType].chainTokens[chainIdentifier].forEach(token => tokens.add(token));
        });
        return tokens;
    }
    /**
     * Fetches, returns and saves the reputation of the intermediary, either for all or just for a single token
     *
     * @param chainIdentifier
     * @param swapContract
     * @param tokens
     * @param abortSignal
     */
    getReputation(chainIdentifier, swapContract, tokens, abortSignal) {
        var _a, _b;
        var _c;
        return __awaiter(this, void 0, void 0, function* () {
            const checkReputationTokens = tokens == null ?
                this.getSupportedTokens(chainIdentifier, [SwapType_1.SwapType.TO_BTC, SwapType_1.SwapType.TO_BTCLN]) :
                new Set(tokens);
            const promises = [];
            const reputation = {};
            for (let token of checkReputationTokens) {
                promises.push((0, Utils_1.tryWithRetries)(() => swapContract.getIntermediaryReputation(this.getAddress(chainIdentifier), token), null, null, abortSignal).then(result => {
                    reputation[token] = result;
                }));
            }
            yield Promise.all(promises);
            (_a = this.reputation) !== null && _a !== void 0 ? _a : (this.reputation = {});
            (_b = (_c = this.reputation)[chainIdentifier]) !== null && _b !== void 0 ? _b : (_c[chainIdentifier] = {});
            for (let key in reputation) {
                this.reputation[chainIdentifier][key] = reputation[key];
            }
            return reputation;
        });
    }
    /**
     * Fetches, returns and saves the liquidity of the intermediaryfor a specific token
     *
     * @param chainIdentifier
     * @param swapContract
     * @param token
     * @param abortSignal
     */
    getLiquidity(chainIdentifier, swapContract, token, abortSignal) {
        var _a, _b;
        var _c;
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield (0, Utils_1.tryWithRetries)(() => swapContract.getBalance(this.getAddress(chainIdentifier), token, true), null, null, abortSignal);
            (_a = this.liquidity) !== null && _a !== void 0 ? _a : (this.liquidity = {});
            (_b = (_c = this.liquidity)[chainIdentifier]) !== null && _b !== void 0 ? _b : (_c[chainIdentifier] = {});
            this.liquidity[chainIdentifier][token] = result;
            return result;
        });
    }
    supportsChain(chainIdentifier) {
        if (this.addresses[chainIdentifier] == null)
            return false;
        return this.getSupportedTokens(chainIdentifier).size !== 0;
    }
    getAddress(chainIdentifier) {
        return this.addresses[chainIdentifier];
    }
}
exports.Intermediary = Intermediary;
