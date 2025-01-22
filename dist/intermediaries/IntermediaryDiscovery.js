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
exports.IntermediaryDiscovery = exports.SwapHandlerType = void 0;
const Intermediary_1 = require("./Intermediary");
const SwapType_1 = require("../swaps/SwapType");
const BN = require("bn.js");
const events_1 = require("events");
const buffer_1 = require("buffer");
const Utils_1 = require("../utils/Utils");
const IntermediaryAPI_1 = require("./IntermediaryAPI");
var SwapHandlerType;
(function (SwapHandlerType) {
    SwapHandlerType["TO_BTC"] = "TO_BTC";
    SwapHandlerType["FROM_BTC"] = "FROM_BTC";
    SwapHandlerType["TO_BTCLN"] = "TO_BTCLN";
    SwapHandlerType["FROM_BTCLN"] = "FROM_BTCLN";
    SwapHandlerType["FROM_BTC_TRUSTED"] = "FROM_BTC_TRUSTED";
    SwapHandlerType["FROM_BTCLN_TRUSTED"] = "FROM_BTCLN_TRUSTED";
})(SwapHandlerType = exports.SwapHandlerType || (exports.SwapHandlerType = {}));
/**
 * Converts SwapHandlerType (represented as string & used in REST API communication with intermediaries) to regular
 *  SwapType
 *
 * @param swapHandlerType
 */
function swapHandlerTypeToSwapType(swapHandlerType) {
    switch (swapHandlerType) {
        case SwapHandlerType.FROM_BTC:
            return SwapType_1.SwapType.FROM_BTC;
        case SwapHandlerType.TO_BTC:
            return SwapType_1.SwapType.TO_BTC;
        case SwapHandlerType.FROM_BTCLN:
            return SwapType_1.SwapType.FROM_BTCLN;
        case SwapHandlerType.TO_BTCLN:
            return SwapType_1.SwapType.TO_BTCLN;
        case SwapHandlerType.FROM_BTC_TRUSTED:
            return SwapType_1.SwapType.TRUSTED_FROM_BTC;
        case SwapHandlerType.FROM_BTCLN_TRUSTED:
            return SwapType_1.SwapType.TRUSTED_FROM_BTCLN;
    }
}
/**
 * A default intermediary comparator, only takes to announced fee into consideration
 *
 * @param swapType
 * @param tokenAddress
 * @param swapAmount
 */
function getIntermediaryComparator(swapType, tokenAddress, swapAmount) {
    if (swapType === SwapType_1.SwapType.TO_BTC) {
        //TODO: Also take reputation into account
    }
    return (a, b) => {
        if (swapAmount == null) {
            return new BN(a.services[swapType].swapFeePPM).sub(new BN(b.services[swapType].swapFeePPM)).toNumber();
        }
        else {
            const feeA = new BN(a.services[swapType].swapBaseFee).add(swapAmount.mul(new BN(a.services[swapType].swapFeePPM)).div(new BN(1000000)));
            const feeB = new BN(b.services[swapType].swapBaseFee).add(swapAmount.mul(new BN(b.services[swapType].swapFeePPM)).div(new BN(1000000)));
            return feeA.sub(feeB).toNumber();
        }
    };
}
const logger = (0, Utils_1.getLogger)("IntermediaryDiscovery: ");
const REGISTRY_URL = "https://api.github.com/repos/adambor/SolLightning-registry/contents/registry.json?ref=main";
//To allow for legacy responses from not-yet updated LPs
const DEFAULT_CHAIN = "SOLANA";
class IntermediaryDiscovery extends events_1.EventEmitter {
    constructor(swapContracts, registryUrl = REGISTRY_URL, nodeUrls, httpRequestTimeout) {
        super();
        this.swapContracts = swapContracts;
        this.registryUrl = registryUrl;
        this.overrideNodeUrls = nodeUrls;
        this.httpRequestTimeout = httpRequestTimeout;
    }
    /**
     * Fetches the URLs of swap intermediaries from registry or from a pre-defined array of node urls
     *
     * @param abortSignal
     */
    getIntermediaryUrls(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.overrideNodeUrls != null && this.overrideNodeUrls.length > 0) {
                return this.overrideNodeUrls;
            }
            const response = yield (0, Utils_1.httpGet)(this.registryUrl, this.httpRequestTimeout, abortSignal);
            const content = response.content.replace(new RegExp("\\n", "g"), "");
            return JSON.parse(buffer_1.Buffer.from(content, "base64").toString());
        });
    }
    /**
     * Returns data as reported by a specific node (as identified by its URL)
     *
     * @param url
     * @param abortSignal
     */
    getNodeInfo(url, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield IntermediaryAPI_1.IntermediaryAPI.getIntermediaryInfo(url);
            //Handle legacy responses
            if (response.chains == null)
                response.chains = {
                    [DEFAULT_CHAIN]: { address: response.address, signature: response.signature }
                };
            const addresses = {};
            for (let chain in response.chains) {
                if (this.swapContracts[chain] != null) {
                    const { signature, address } = response.chains[chain];
                    yield this.swapContracts[chain].isValidDataSignature(buffer_1.Buffer.from(response.envelope), signature, address);
                    addresses[chain] = address;
                }
            }
            if (abortSignal != null)
                abortSignal.throwIfAborted();
            //Handle legacy responses
            const info = JSON.parse(response.envelope);
            for (let swapType in info.services) {
                const serviceData = info.services[swapType];
                if (serviceData.chainTokens == null)
                    serviceData.chainTokens = {
                        [DEFAULT_CHAIN]: serviceData.tokens
                    };
            }
            return {
                addresses,
                info
            };
        });
    }
    loadIntermediary(url, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const nodeInfo = yield this.getNodeInfo(url, abortSignal);
                const services = {};
                for (let key in nodeInfo.info.services) {
                    services[swapHandlerTypeToSwapType(key)] = nodeInfo.info.services[key];
                }
                return new Intermediary_1.Intermediary(url, nodeInfo.addresses, services);
            }
            catch (e) {
                logger.error("fetchIntermediaries(): Error contacting intermediary " + url + ": ", e);
                return null;
            }
        });
    }
    /**
     * Fetches data about all intermediaries in the network, pinging every one of them and ensuring they are online
     *
     * @param abortSignal
     * @private
     * @throws {Error} When no online intermediary was found
     */
    fetchIntermediaries(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const urls = yield this.getIntermediaryUrls(abortSignal);
            logger.debug("fetchIntermediaries(): Pinging intermediaries: ", urls.join());
            const promises = urls.map(url => this.loadIntermediary(url, abortSignal));
            const activeNodes = (yield Promise.all(promises)).filter(intermediary => intermediary != null);
            if (activeNodes.length === 0)
                throw new Error("No online intermediary found!");
            return activeNodes;
        });
    }
    /**
     * Returns the intermediary at the provided URL, either from the already fetched list of LPs or fetches the data on-demand
     *
     * @param url
     */
    getIntermediary(url) {
        const foundLp = this.intermediaries.find(lp => lp.url === url);
        if (foundLp != null)
            return Promise.resolve(foundLp);
        return this.loadIntermediary(url);
    }
    /**
     * Reloads the saves a list of intermediaries
     * @param abortSignal
     */
    reloadIntermediaries(abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const fetchedIntermediaries = yield (0, Utils_1.tryWithRetries)(() => this.fetchIntermediaries(abortSignal), null, null, abortSignal);
            this.intermediaries = fetchedIntermediaries;
            this.emit("added", fetchedIntermediaries);
            logger.info("reloadIntermediaries(): Using active intermediaries: ", fetchedIntermediaries.map(lp => lp.url).join());
        });
    }
    /**
     * Initializes the discovery by fetching/reloading intermediaries
     *
     * @param abortSignal
     */
    init(abortSignal) {
        logger.info("init(): Initializing with registryUrl: " + this.registryUrl + " intermediary array: " + (this.overrideNodeUrls || []).join());
        return this.reloadIntermediaries(abortSignal);
    }
    getMultichainSwapBounds() {
        const bounds = {};
        this.intermediaries.forEach(intermediary => {
            var _a, _b;
            for (let swapType in intermediary.services) {
                const swapService = intermediary.services[swapType];
                (_a = bounds[swapType]) !== null && _a !== void 0 ? _a : (bounds[swapType] = {});
                const multichainBounds = bounds[swapType];
                for (let chainId in swapService.chainTokens) {
                    (_b = multichainBounds[chainId]) !== null && _b !== void 0 ? _b : (multichainBounds[chainId] = {});
                    const tokenBounds = multichainBounds[chainId];
                    for (let token of swapService.chainTokens[chainId]) {
                        const tokenMinMax = tokenBounds[token];
                        if (tokenMinMax == null) {
                            tokenBounds[token] = {
                                min: new BN(swapService.min),
                                max: new BN(swapService.max)
                            };
                        }
                        else {
                            tokenMinMax.min = BN.min(tokenMinMax.min, new BN(swapService.min));
                            tokenMinMax.max = BN.min(tokenMinMax.max, new BN(swapService.max));
                        }
                    }
                }
            }
        });
        return bounds;
    }
    /**
     * Returns aggregate swap bounds (in sats - BTC) as indicated by the intermediaries
     */
    getSwapBounds(chainIdentifier) {
        const bounds = {};
        this.intermediaries.forEach(intermediary => {
            for (let swapType in intermediary.services) {
                const swapService = intermediary.services[swapType];
                if (bounds[swapType] == null)
                    bounds[swapType] = {};
                const tokenBounds = bounds[swapType];
                if (swapService.chainTokens != null && swapService.chainTokens[chainIdentifier] != null) {
                    for (let token of swapService.chainTokens[chainIdentifier]) {
                        const tokenMinMax = tokenBounds[token];
                        if (tokenMinMax == null) {
                            tokenBounds[token] = {
                                min: new BN(swapService.min),
                                max: new BN(swapService.max)
                            };
                        }
                        else {
                            tokenMinMax.min = BN.min(tokenMinMax.min, new BN(swapService.min));
                            tokenMinMax.max = BN.min(tokenMinMax.max, new BN(swapService.max));
                        }
                    }
                }
            }
        });
        return bounds;
    }
    /**
     * Returns the aggregate swap minimum (in sats - BTC) for a specific swap type & token
     *  as indicated by the intermediaries
     *
     * @param chainIdentifier
     * @param swapType
     * @param token
     */
    getSwapMinimum(chainIdentifier, swapType, token) {
        const tokenStr = token.toString();
        return this.intermediaries.reduce((prevMin, intermediary) => {
            const swapService = intermediary.services[swapType];
            if (swapService != null &&
                swapService.chainTokens != null &&
                swapService.chainTokens[chainIdentifier] != null &&
                swapService.chainTokens[chainIdentifier].includes(tokenStr))
                return prevMin == null ? swapService.min : Math.min(prevMin, swapService.min);
            return prevMin;
        }, null);
    }
    /**
     * Returns the aggregate swap maximum (in sats - BTC) for a specific swap type & token
     *  as indicated by the intermediaries
     *
     * @param chainIdentifier
     * @param swapType
     * @param token
     */
    getSwapMaximum(chainIdentifier, swapType, token) {
        const tokenStr = token.toString();
        return this.intermediaries.reduce((prevMax, intermediary) => {
            const swapService = intermediary.services[swapType];
            if (swapService != null &&
                swapService.chainTokens != null &&
                swapService.chainTokens[chainIdentifier] != null &&
                swapService.chainTokens[chainIdentifier].includes(tokenStr))
                return prevMax == null ? swapService.max : Math.max(prevMax, swapService.max);
            return prevMax;
        }, null);
    }
    /**
     * Returns swap candidates for a specific swap type & token address
     *
     * @param chainIdentifier
     * @param swapType
     * @param tokenAddress
     * @param amount Amount to be swapped in sats - BTC
     * @param count How many intermediaries to return at most
     */
    getSwapCandidates(chainIdentifier, swapType, tokenAddress, amount, count) {
        const candidates = this.intermediaries.filter(e => {
            const swapService = e.services[swapType];
            if (swapService == null)
                return false;
            if (amount != null && amount.lt(new BN(swapService.min)))
                return false;
            if (amount != null && amount.gt(new BN(swapService.max)))
                return false;
            if (swapService.chainTokens == null)
                return false;
            if (swapService.chainTokens[chainIdentifier] == null)
                return false;
            if (!swapService.chainTokens[chainIdentifier].includes(tokenAddress.toString()))
                return false;
            return true;
        });
        candidates.sort(getIntermediaryComparator(swapType, tokenAddress, amount));
        if (count == null) {
            return candidates;
        }
        else {
            return candidates.slice(0, count);
        }
    }
    /**
     * Removes a specific intermediary from the list of active intermediaries (used for blacklisting)
     *
     * @param intermediary
     */
    removeIntermediary(intermediary) {
        const index = this.intermediaries.indexOf(intermediary);
        if (index >= 0) {
            logger.info("removeIntermediary(): Removing intermediary: " + intermediary.url);
            this.intermediaries.splice(index, 1);
            this.emit("removed", [intermediary]);
            return true;
        }
        return false;
    }
}
exports.IntermediaryDiscovery = IntermediaryDiscovery;
