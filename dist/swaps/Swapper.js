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
exports.Swapper = void 0;
const base_1 = require("@atomiqlabs/base");
const ToBTCLNWrapper_1 = require("./tobtc/ln/ToBTCLNWrapper");
const ToBTCWrapper_1 = require("./tobtc/onchain/ToBTCWrapper");
const FromBTCLNWrapper_1 = require("./frombtc/ln/FromBTCLNWrapper");
const FromBTCWrapper_1 = require("./frombtc/onchain/FromBTCWrapper");
const IntermediaryDiscovery_1 = require("../intermediaries/IntermediaryDiscovery");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const bolt11_1 = require("bolt11");
const BN = require("bn.js");
const IntermediaryError_1 = require("../errors/IntermediaryError");
const SwapType_1 = require("./SwapType");
const MempoolBtcRelaySynchronizer_1 = require("../btc/mempool/synchronizer/MempoolBtcRelaySynchronizer");
const LnForGasWrapper_1 = require("./swapforgas/ln/LnForGasWrapper");
const events_1 = require("events");
const IndexedDBStorageManager_1 = require("../storage/IndexedDBStorageManager");
const LNURL_1 = require("../utils/LNURL");
const Utils_1 = require("../utils/Utils");
const RequestError_1 = require("../errors/RequestError");
const SwapperWithChain_1 = require("./SwapperWithChain");
const OnchainForGasWrapper_1 = require("./swapforgas/onchain/OnchainForGasWrapper");
const randomBytes = require("randombytes");
class Swapper extends events_1.EventEmitter {
    constructor(bitcoinRpc, chainsData, pricing, tokens, options) {
        var _a, _b;
        var _c;
        super();
        this.logger = (0, Utils_1.getLogger)(this.constructor.name + ": ");
        const storagePrefix = (options === null || options === void 0 ? void 0 : options.storagePrefix) || "";
        options.bitcoinNetwork = options.bitcoinNetwork == null ? base_1.BitcoinNetwork.TESTNET : options.bitcoinNetwork;
        (_a = options.storageCtor) !== null && _a !== void 0 ? _a : (options.storageCtor = (name) => new IndexedDBStorageManager_1.IndexedDBStorageManager(name));
        this.bitcoinNetwork = options.bitcoinNetwork === base_1.BitcoinNetwork.MAINNET ? bitcoinjs_lib_1.networks.bitcoin :
            options.bitcoinNetwork === base_1.BitcoinNetwork.REGTEST ? bitcoinjs_lib_1.networks.regtest :
                options.bitcoinNetwork === base_1.BitcoinNetwork.TESTNET ? bitcoinjs_lib_1.networks.testnet : null;
        this.prices = pricing;
        this.bitcoinRpc = bitcoinRpc;
        this.mempoolApi = bitcoinRpc.api;
        this.tokens = {};
        for (let tokenData of tokens) {
            for (let chainId in tokenData.chains) {
                const chainData = tokenData.chains[chainId];
                (_b = (_c = this.tokens)[chainId]) !== null && _b !== void 0 ? _b : (_c[chainId] = {});
                this.tokens[chainId][chainData.address] = {
                    chain: "SC",
                    chainId,
                    ticker: tokenData.ticker,
                    name: tokenData.name,
                    decimals: chainData.decimals,
                    address: chainData.address
                };
            }
        }
        this.swapStateListener = (swap) => {
            this.emit("swapState", swap);
        };
        this.chains = (0, Utils_1.objectMap)(chainsData, (chainData, key) => {
            var _a;
            const { swapContract, chainEvents, btcRelay } = chainData;
            const synchronizer = new MempoolBtcRelaySynchronizer_1.MempoolBtcRelaySynchronizer(btcRelay, bitcoinRpc);
            const _storagePrefix = (_a = chainData.storagePrefix) !== null && _a !== void 0 ? _a : storagePrefix + key + "-";
            const tobtcln = new ToBTCLNWrapper_1.ToBTCLNWrapper(key, options.storageCtor(_storagePrefix + "Swaps-ToBTCLN"), swapContract, chainEvents, pricing, tokens, chainData.swapDataConstructor, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout,
            });
            const tobtc = new ToBTCWrapper_1.ToBTCWrapper(key, options.storageCtor(_storagePrefix + "Swaps-ToBTC"), swapContract, chainEvents, pricing, tokens, chainData.swapDataConstructor, this.bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout,
                bitcoinNetwork: this.bitcoinNetwork
            });
            const frombtcln = new FromBTCLNWrapper_1.FromBTCLNWrapper(key, options.storageCtor(_storagePrefix + "Swaps-FromBTCLN"), swapContract, chainEvents, pricing, tokens, chainData.swapDataConstructor, bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout
            });
            const frombtc = new FromBTCWrapper_1.FromBTCWrapper(key, options.storageCtor(_storagePrefix + "Swaps-FromBTC"), swapContract, chainEvents, pricing, tokens, chainData.swapDataConstructor, btcRelay, synchronizer, this.bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout,
                bitcoinNetwork: this.bitcoinNetwork
            });
            const lnforgas = new LnForGasWrapper_1.LnForGasWrapper(key, options.storageCtor(_storagePrefix + "LnForGas"), swapContract, chainEvents, pricing, tokens, chainData.swapDataConstructor, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout
            });
            const onchainforgas = new OnchainForGasWrapper_1.OnchainForGasWrapper(key, options.storageCtor(_storagePrefix + "OnchainForGas"), swapContract, chainEvents, pricing, tokens, chainData.swapDataConstructor, bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout
            });
            tobtcln.events.on("swapState", this.swapStateListener);
            tobtc.events.on("swapState", this.swapStateListener);
            frombtcln.events.on("swapState", this.swapStateListener);
            frombtc.events.on("swapState", this.swapStateListener);
            lnforgas.events.on("swapState", this.swapStateListener);
            onchainforgas.events.on("swapState", this.swapStateListener);
            return {
                chainEvents,
                swapContract,
                btcRelay,
                synchronizer,
                tobtcln,
                tobtc,
                frombtcln,
                frombtc,
                lnforgas,
                onchainforgas
            };
        });
        const contracts = (0, Utils_1.objectMap)(chainsData, (data) => data.swapContract);
        if (options.intermediaryUrl != null) {
            this.intermediaryDiscovery = new IntermediaryDiscovery_1.IntermediaryDiscovery(contracts, options.registryUrl, Array.isArray(options.intermediaryUrl) ? options.intermediaryUrl : [options.intermediaryUrl], options.getRequestTimeout);
        }
        else {
            this.intermediaryDiscovery = new IntermediaryDiscovery_1.IntermediaryDiscovery(contracts, options.registryUrl, null, options.getRequestTimeout);
        }
        this.intermediaryDiscovery.on("removed", (intermediaries) => {
            this.emit("lpsRemoved", intermediaries);
        });
        this.intermediaryDiscovery.on("added", (intermediaries) => {
            this.emit("lpsAdded", intermediaries);
        });
        this.options = options;
    }
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice
     *
     * @param lnpr
     */
    isLightningInvoice(lnpr) {
        try {
            (0, bolt11_1.decode)(lnpr);
            return true;
        }
        catch (e) { }
        return false;
    }
    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr) {
        try {
            bitcoinjs_lib_1.address.toOutputScript(addr, this.bitcoinNetwork);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr) {
        try {
            const parsed = (0, bolt11_1.decode)(lnpr);
            if (parsed.millisatoshis != null)
                return true;
        }
        catch (e) { }
        return false;
    }
    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl) {
        return LNURL_1.LNURL.isLNURL(lnurl);
    }
    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl, shouldRetry) {
        return LNURL_1.LNURL.getLNURLType(lnurl, shouldRetry);
    }
    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr) {
        const parsed = (0, bolt11_1.decode)(lnpr);
        if (parsed.millisatoshis != null)
            return new BN(parsed.millisatoshis).add(new BN(999)).div(new BN(1000));
        return null;
    }
    /**
     * Returns swap bounds (minimums & maximums) for different swap types & tokens
     */
    getSwapBounds(chainIdentifier) {
        if (this.intermediaryDiscovery != null) {
            if (chainIdentifier == null) {
                return this.intermediaryDiscovery.getMultichainSwapBounds();
            }
            else {
                return this.intermediaryDiscovery.getSwapBounds(chainIdentifier);
            }
        }
        return null;
    }
    /**
     * Returns maximum possible swap amount
     *
     * @param chainIdentifier
     * @param type      Type of the swap
     * @param token     Token of the swap
     */
    getMaximum(chainIdentifier, type, token) {
        if (this.intermediaryDiscovery != null) {
            const max = this.intermediaryDiscovery.getSwapMaximum(chainIdentifier, type, token);
            if (max != null)
                return new BN(max);
        }
        return new BN(0);
    }
    /**
     * Returns minimum possible swap amount
     *
     * @param chainIdentifier
     * @param type      Type of swap
     * @param token     Token of the swap
     */
    getMinimum(chainIdentifier, type, token) {
        if (this.intermediaryDiscovery != null) {
            const min = this.intermediaryDiscovery.getSwapMinimum(chainIdentifier, type, token);
            if (min != null)
                return new BN(min);
        }
        return new BN(0);
    }
    /**
     * Initializes the swap storage and loads existing swaps, needs to be called before any other action
     *
     * @param noTimers      Whether to run without setting up the watchdog timers
     * @param noEvents      Whether to leave out event handler
     */
    init(noTimers = false, noEvents = false) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.info("init(): Intializing swapper: ", this);
            for (let chainIdentifier in this.chains) {
                const { swapContract, chainEvents, tobtcln, tobtc, frombtcln, frombtc, lnforgas, onchainforgas } = this.chains[chainIdentifier];
                yield swapContract.start();
                this.logger.info("init(): Intialized swap contract: " + chainIdentifier);
                if (!noEvents)
                    yield chainEvents.init();
                this.logger.info("init(): Intialized events: " + chainIdentifier);
                this.logger.info("init(): Initializing To BTCLN: " + chainIdentifier);
                yield tobtcln.init(noTimers);
                this.logger.info("init(): Initializing To BTC: " + chainIdentifier);
                yield tobtc.init(noTimers);
                this.logger.info("init(): Initializing From BTCLN: " + chainIdentifier);
                yield frombtcln.init(noTimers);
                this.logger.info("init(): Initializing From BTC: " + chainIdentifier);
                yield frombtc.init(noTimers);
                this.logger.info("init(): Initializing From BTCLN to gas: " + chainIdentifier);
                yield lnforgas.init(noTimers);
                this.logger.info("init(): Initializing From BTC to gas: " + chainIdentifier);
                yield onchainforgas.init(noTimers);
            }
            this.logger.info("init(): Initializing intermediary discovery");
            yield this.intermediaryDiscovery.init();
            if (this.options.defaultTrustedIntermediaryUrl != null) {
                this.defaultTrustedIntermediary = yield this.intermediaryDiscovery.getIntermediary(this.options.defaultTrustedIntermediaryUrl);
            }
        });
    }
    /**
     * Stops listening for onchain events and closes this Swapper instance
     */
    stop() {
        return __awaiter(this, void 0, void 0, function* () {
            for (let chainIdentifier in this.chains) {
                const { tobtcln, tobtc, frombtcln, frombtc, lnforgas, onchainforgas } = this.chains[chainIdentifier];
                tobtcln.events.off("swapState", this.swapStateListener);
                tobtc.events.off("swapState", this.swapStateListener);
                frombtcln.events.off("swapState", this.swapStateListener);
                frombtc.events.off("swapState", this.swapStateListener);
                lnforgas.events.off("swapState", this.swapStateListener);
                onchainforgas.events.off("swapState", this.swapStateListener);
                yield tobtcln.stop();
                yield tobtc.stop();
                yield frombtcln.stop();
                yield frombtc.stop();
                yield lnforgas.stop();
                yield onchainforgas.stop();
            }
        });
    }
    /**
     * Returns a set of supported tokens by all the intermediaries offering a specific swap service
     *
     * @param swapType Swap service type to check supported tokens for
     */
    getSupportedTokens(swapType) {
        const tokens = [];
        this.intermediaryDiscovery.intermediaries.forEach(lp => {
            var _a, _b;
            if (lp.services[swapType] == null)
                return;
            if (lp.services[swapType].chainTokens == null)
                return;
            for (let chainId in lp.services[swapType].chainTokens) {
                for (let tokenAddress of lp.services[swapType].chainTokens[chainId]) {
                    const token = (_b = (_a = this.tokens) === null || _a === void 0 ? void 0 : _a[chainId]) === null || _b === void 0 ? void 0 : _b[tokenAddress];
                    if (token != null)
                        tokens.push(token);
                }
            }
        });
        return tokens;
    }
    /**
     * Returns the set of supported token addresses by all the intermediaries we know of offering a specific swapType service
     *
     * @param chainIdentifier
     * @param swapType Specific swap type for which to obtain supported tokens
     */
    getSupportedTokenAddresses(chainIdentifier, swapType) {
        const set = new Set();
        this.intermediaryDiscovery.intermediaries.forEach(lp => {
            if (lp.services[swapType] == null)
                return;
            if (lp.services[swapType].chainTokens == null || lp.services[swapType].chainTokens[chainIdentifier] == null)
                return;
            lp.services[swapType].chainTokens[chainIdentifier].forEach(token => set.add(token));
        });
        return set;
    }
    /**
     * Creates swap & handles intermediary, quote selection
     *
     * @param chainIdentifier
     * @param create Callback to create the
     * @param amountData Amount data as passed to the function
     * @param swapType Swap type of the execution
     * @param maxWaitTimeMS Maximum waiting time after the first intermediary returns the quote
     * @private
     * @throws {Error} when no intermediary was found
     * @throws {Error} if the chain with the provided identifier cannot be found
     */
    createSwap(chainIdentifier, create, amountData, swapType, maxWaitTimeMS = 2000) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.chains[chainIdentifier] == null)
                throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
            let candidates;
            const inBtc = swapType === SwapType_1.SwapType.TO_BTCLN || swapType === SwapType_1.SwapType.TO_BTC ? !amountData.exactIn : amountData.exactIn;
            if (!inBtc) {
                //Get candidates not based on the amount
                candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token);
            }
            else {
                candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token, amountData.amount);
            }
            if (candidates.length === 0) {
                this.logger.warn("createSwap(): No valid intermediary found, reloading intermediary database...");
                yield this.intermediaryDiscovery.reloadIntermediaries();
                if (!inBtc) {
                    //Get candidates not based on the amount
                    candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token);
                }
                else {
                    candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token, amountData.amount);
                }
                if (candidates.length === 0)
                    throw new Error("No intermediary found!");
            }
            const abortController = new AbortController();
            this.logger.debug("createSwap() Swap candidates: ", candidates.map(lp => lp.url).join());
            const quotePromises = yield create(candidates, abortController.signal, this.chains[chainIdentifier]);
            const quotes = yield new Promise((resolve, reject) => {
                let min;
                let max;
                let error;
                let numResolved = 0;
                let quotes = [];
                let timeout;
                quotePromises.forEach(data => {
                    data.quote.then(quote => {
                        if (numResolved === 0) {
                            timeout = setTimeout(() => {
                                abortController.abort(new Error("Timed out waiting for quote!"));
                                resolve(quotes);
                            }, maxWaitTimeMS);
                        }
                        numResolved++;
                        quotes.push({
                            quote,
                            intermediary: data.intermediary
                        });
                        if (numResolved === quotePromises.length) {
                            clearTimeout(timeout);
                            resolve(quotes);
                            return;
                        }
                    }).catch(e => {
                        numResolved++;
                        if (e instanceof IntermediaryError_1.IntermediaryError) {
                            //Blacklist that node
                            this.intermediaryDiscovery.removeIntermediary(data.intermediary);
                        }
                        if (e instanceof RequestError_1.OutOfBoundsError) {
                            if (min == null || max == null) {
                                min = e.min;
                                max = e.max;
                            }
                            else {
                                min = BN.min(min, e.min);
                                max = BN.max(max, e.max);
                            }
                        }
                        this.logger.error("createSwap(): Intermediary " + data.intermediary.url + " error: ", e);
                        error = e;
                        if (numResolved === quotePromises.length) {
                            if (timeout != null)
                                clearTimeout(timeout);
                            if (quotes.length > 0) {
                                resolve(quotes);
                                return;
                            }
                            if (min != null && max != null) {
                                reject(new RequestError_1.OutOfBoundsError("Out of bounds", 400, min, max));
                                return;
                            }
                            reject(error);
                        }
                    });
                });
            });
            //TODO: Intermediary's reputation is not taken into account!
            quotes.sort((a, b) => {
                if (amountData.exactIn) {
                    //Compare outputs
                    return b.quote.getOutput().rawAmount.cmp(a.quote.getOutput().rawAmount);
                }
                else {
                    //Compare inputs
                    return a.quote.getInput().rawAmount.cmp(b.quote.getInput().rawAmount);
                }
            });
            this.logger.debug("createSwap(): Sorted quotes, best price to worst: ", quotes);
            return quotes[0].quote;
        });
    }
    /**
     * Creates To BTC swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to pay with
     * @param address               Recipient's bitcoin address
     * @param amount                Amount to send in satoshis (bitcoin's smallest denomination)
     * @param confirmationTarget    How soon should the transaction be confirmed (determines the fee)
     * @param confirmations         How many confirmations must the intermediary wait to claim the funds
     * @param exactIn               Whether to use exact in instead of exact out
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     */
    createToBTCSwap(chainIdentifier, signer, tokenAddress, address, amount, confirmationTarget, confirmations, exactIn, additionalParams = this.options.defaultAdditionalParameters) {
        if (confirmationTarget == null)
            confirmationTarget = 3;
        if (confirmations == null)
            confirmations = 2;
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn
        };
        return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => Promise.resolve(chain.tobtc.create(signer, address, amountData, candidates, {
            confirmationTarget,
            confirmations
        }, additionalParams, abortSignal)), amountData, SwapType_1.SwapType.TO_BTC);
    }
    /**
     * Creates To BTCLN swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to pay with
     * @param paymentRequest        BOLT11 lightning network invoice to be paid (needs to have a fixed amount)
     * @param expirySeconds         For how long to lock your funds (higher expiry means higher probability of payment success)
     * @param maxRoutingBaseFee     Maximum routing fee to use - base fee (higher routing fee means higher probability of payment success)
     * @param maxRoutingPPM         Maximum routing fee to use - proportional fee in PPM (higher routing fee means higher probability of payment success)
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     */
    createToBTCLNSwap(chainIdentifier, signer, tokenAddress, paymentRequest, expirySeconds, maxRoutingBaseFee, maxRoutingPPM, additionalParams = this.options.defaultAdditionalParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            const parsedPR = (0, bolt11_1.decode)(paymentRequest);
            const amountData = {
                amount: new BN(parsedPR.millisatoshis).add(new BN(999)).div(new BN(1000)),
                token: tokenAddress,
                exactIn: false
            };
            expirySeconds !== null && expirySeconds !== void 0 ? expirySeconds : (expirySeconds = 5 * 24 * 3600);
            return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => Promise.resolve(chain.tobtcln.create(signer, paymentRequest, amountData, candidates, {
                expirySeconds,
                maxRoutingPPM,
                maxRoutingBaseFee
            }, additionalParams, abortSignal)), amountData, SwapType_1.SwapType.TO_BTCLN);
        });
    }
    /**
     * Creates To BTCLN swap via LNURL-pay
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to pay with
     * @param lnurlPay              LNURL-pay link to use for the payment
     * @param amount                Amount to be paid in sats
     * @param comment               Optional comment for the payment
     * @param expirySeconds         For how long to lock your funds (higher expiry means higher probability of payment success)
     * @param maxRoutingBaseFee     Maximum routing fee to use - base fee (higher routing fee means higher probability of payment success)
     * @param maxRoutingPPM         Maximum routing fee to use - proportional fee in PPM (higher routing fee means higher probability of payment success)
     * @param exactIn               Whether to do an exact in swap instead of exact out
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     */
    createToBTCLNSwapViaLNURL(chainIdentifier, signer, tokenAddress, lnurlPay, amount, comment, expirySeconds, maxRoutingBaseFee, maxRoutingPPM, exactIn, additionalParams = this.options.defaultAdditionalParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            const amountData = {
                amount,
                token: tokenAddress,
                exactIn
            };
            expirySeconds !== null && expirySeconds !== void 0 ? expirySeconds : (expirySeconds = 5 * 24 * 3600);
            return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => chain.tobtcln.createViaLNURL(signer, typeof (lnurlPay) === "string" ? lnurlPay : lnurlPay.params, amountData, candidates, {
                expirySeconds,
                comment,
                maxRoutingBaseFee,
                maxRoutingPPM
            }, additionalParams, abortSignal), amountData, SwapType_1.SwapType.TO_BTCLN);
        });
    }
    /**
     * Creates From BTC swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to receive
     * @param amount                Amount to receive, in satoshis (bitcoin's smallest denomination)
     * @param exactOut              Whether to use a exact out instead of exact in
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     */
    createFromBTCSwap(chainIdentifier, signer, tokenAddress, amount, exactOut, additionalParams = this.options.defaultAdditionalParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            const amountData = {
                amount,
                token: tokenAddress,
                exactIn: !exactOut
            };
            return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => Promise.resolve(chain.frombtc.create(signer, amountData, candidates, null, additionalParams, abortSignal)), amountData, SwapType_1.SwapType.FROM_BTC);
        });
    }
    /**
     * Creates From BTCLN swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress      Token address to receive
     * @param amount            Amount to receive, in satoshis (bitcoin's smallest denomination)
     * @param exactOut          Whether to use exact out instead of exact in
     * @param descriptionHash   Description hash for ln invoice
     * @param additionalParams  Additional parameters sent to the LP when creating the swap
     */
    createFromBTCLNSwap(chainIdentifier, signer, tokenAddress, amount, exactOut, descriptionHash, additionalParams = this.options.defaultAdditionalParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            const amountData = {
                amount,
                token: tokenAddress,
                exactIn: !exactOut
            };
            return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => Promise.resolve(chain.frombtcln.create(signer, amountData, candidates, {
                descriptionHash
            }, additionalParams, abortSignal)), amountData, SwapType_1.SwapType.FROM_BTCLN);
        });
    }
    /**
     * Creates From BTCLN swap, withdrawing from LNURL-withdraw
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress      Token address to receive
     * @param lnurl             LNURL-withdraw to pull the funds from
     * @param amount            Amount to receive, in satoshis (bitcoin's smallest denomination)
     * @param exactOut          Whether to use exact out instead of exact in
     * @param additionalParams  Additional parameters sent to the LP when creating the swap
     */
    createFromBTCLNSwapViaLNURL(chainIdentifier, signer, tokenAddress, lnurl, amount, exactOut, additionalParams = this.options.defaultAdditionalParameters) {
        return __awaiter(this, void 0, void 0, function* () {
            const amountData = {
                amount,
                token: tokenAddress,
                exactIn: !exactOut
            };
            return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => chain.frombtcln.createViaLNURL(signer, typeof (lnurl) === "string" ? lnurl : lnurl.params, amountData, candidates, additionalParams, abortSignal), amountData, SwapType_1.SwapType.FROM_BTCLN);
        });
    }
    /**
     * Creates a swap from srcToken to dstToken, of a specific token amount, either specifying input amount (exactIn=true)
     *  or output amount (exactIn=false), NOTE: For regular -> BTC-LN (lightning) swaps the passed amount is ignored and
     *  invoice's pre-set amount is used instead.
     *
     * @param signer
     * @param srcToken Source token of the swap, user pays this token
     * @param dstToken Destination token of the swap, user receives this token
     * @param amount Amount of the swap
     * @param exactIn Whether the amount specified is an input amount (exactIn=true) or an output amount (exactIn=false)
     * @param addressLnurlLightningInvoice Bitcoin on-chain address, lightning invoice, LNURL-pay to pay or
     *  LNURL-withdrawal to withdraw money from
     */
    create(signer, srcToken, dstToken, amount, exactIn, addressLnurlLightningInvoice) {
        if (srcToken.chain === "BTC") {
            if (dstToken.chain === "SC") {
                if (srcToken.lightning) {
                    if (addressLnurlLightningInvoice != null) {
                        if (typeof (addressLnurlLightningInvoice) !== "string" && !(0, LNURL_1.isLNURLWithdraw)(addressLnurlLightningInvoice))
                            throw new Error("LNURL must be a string or LNURLWithdraw object!");
                        return this.createFromBTCLNSwapViaLNURL(dstToken.chainId, signer, dstToken.address, addressLnurlLightningInvoice, amount, !exactIn);
                    }
                    else {
                        return this.createFromBTCLNSwap(dstToken.chainId, signer, dstToken.address, amount, !exactIn);
                    }
                }
                else {
                    return this.createFromBTCSwap(dstToken.chainId, signer, dstToken.address, amount, !exactIn);
                }
            }
        }
        else {
            if (dstToken.chain === "BTC") {
                if (dstToken.lightning) {
                    if (typeof (addressLnurlLightningInvoice) !== "string" && !(0, LNURL_1.isLNURLPay)(addressLnurlLightningInvoice))
                        throw new Error("Destination LNURL link/lightning invoice must be a string or LNURLPay object!");
                    if ((0, LNURL_1.isLNURLPay)(addressLnurlLightningInvoice) || this.isValidLNURL(addressLnurlLightningInvoice)) {
                        return this.createToBTCLNSwapViaLNURL(srcToken.chainId, signer, srcToken.address, addressLnurlLightningInvoice, amount, null, null, null, null, exactIn);
                    }
                    else if (this.isLightningInvoice(addressLnurlLightningInvoice)) {
                        if (!this.isValidLightningInvoice(addressLnurlLightningInvoice))
                            throw new Error("Invalid lightning invoice specified, lightning invoice MUST contain pre-set amount!");
                        if (exactIn)
                            throw new Error("Only exact out swaps are possible with lightning invoices, use LNURL links for exact in lightning swaps!");
                        return this.createToBTCLNSwap(srcToken.chainId, signer, srcToken.address, addressLnurlLightningInvoice);
                    }
                    else {
                        throw new Error("Supplied parameter is not LNURL link nor lightning invoice (bolt11)!");
                    }
                }
                else {
                    if (typeof (addressLnurlLightningInvoice) !== "string")
                        throw new Error("Destination bitcoin address must be a string!");
                    return this.createToBTCSwap(srcToken.chainId, signer, srcToken.address, addressLnurlLightningInvoice, amount, null, null, exactIn);
                }
            }
        }
        throw new Error("Unsupported swap type");
    }
    /**
     * Creates trusted LN for Gas swap
     *
     * @param chainId
     * @param signer
     * @param amount                    Amount of native token to receive, in base units
     * @param trustedIntermediaryOrUrl  URL or Intermediary object of the trusted intermediary to use, otherwise uses default
     * @throws {Error}                  If no trusted intermediary specified
     */
    createTrustedLNForGasSwap(chainId, signer, amount, trustedIntermediaryOrUrl) {
        var _a;
        if (this.chains[chainId] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainId);
        const useUrl = (_a = trustedIntermediaryOrUrl !== null && trustedIntermediaryOrUrl !== void 0 ? trustedIntermediaryOrUrl : this.defaultTrustedIntermediary) !== null && _a !== void 0 ? _a : this.options.defaultTrustedIntermediaryUrl;
        if (useUrl == null)
            throw new Error("No trusted intermediary specified!");
        return this.chains[chainId].lnforgas.create(signer, amount, useUrl);
    }
    /**
     * Creates trusted BTC on-chain for Gas swap
     *
     * @param chainId
     * @param signer
     * @param amount                    Amount of native token to receive, in base units
     * @param refundAddress             Bitcoin refund address, in case the swap fails
     * @param trustedIntermediaryOrUrl  URL or Intermediary object of the trusted intermediary to use, otherwise uses default
     * @throws {Error}                  If no trusted intermediary specified
     */
    createTrustedOnchainForGasSwap(chainId, signer, amount, refundAddress, trustedIntermediaryOrUrl) {
        var _a;
        if (this.chains[chainId] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainId);
        const useUrl = (_a = trustedIntermediaryOrUrl !== null && trustedIntermediaryOrUrl !== void 0 ? trustedIntermediaryOrUrl : this.defaultTrustedIntermediary) !== null && _a !== void 0 ? _a : this.options.defaultTrustedIntermediaryUrl;
        if (useUrl == null)
            throw new Error("No trusted intermediary specified!");
        return this.chains[chainId].onchainforgas.create(signer, amount, useUrl, refundAddress);
    }
    getAllSwaps(chainId, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (chainId == null) {
                const res = [];
                for (let chainId in this.chains) {
                    const chainData = this.chains[chainId];
                    [].concat(yield chainData.tobtcln.getAllSwaps(), yield chainData.tobtc.getAllSwaps(), yield chainData.frombtcln.getAllSwaps(), yield chainData.frombtc.getAllSwaps()).forEach(val => res.push(val));
                }
                return res;
            }
            else {
                const chainData = this.chains[chainId];
                return [].concat(yield chainData.tobtcln.getAllSwaps(signer), yield chainData.tobtc.getAllSwaps(signer), yield chainData.frombtcln.getAllSwaps(signer), yield chainData.frombtc.getAllSwaps(signer));
            }
        });
    }
    getActionableSwaps(chainId, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (chainId == null) {
                const res = [];
                for (let chainId in this.chains) {
                    const chainData = this.chains[chainId];
                    [].concat(yield chainData.tobtcln.getActionableSwaps(), yield chainData.tobtc.getActionableSwaps(), yield chainData.frombtcln.getActionableSwaps(), yield chainData.frombtc.getActionableSwaps()).forEach(val => res.push(val));
                }
                return res;
            }
            else {
                const chainData = this.chains[chainId];
                return [].concat(yield chainData.tobtcln.getActionableSwaps(signer), yield chainData.tobtc.getActionableSwaps(signer), yield chainData.frombtcln.getActionableSwaps(signer), yield chainData.frombtc.getActionableSwaps(signer));
            }
        });
    }
    getRefundableSwaps(chainId, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (chainId == null) {
                const res = [];
                for (let chainId in this.chains) {
                    const chainData = this.chains[chainId];
                    [].concat(yield chainData.tobtcln.getRefundableSwaps(), yield chainData.tobtc.getRefundableSwaps()).forEach(val => res.push(val));
                }
                return res;
            }
            else {
                const chainData = this.chains[chainId];
                return [].concat(yield chainData.tobtcln.getRefundableSwaps(signer), yield chainData.tobtc.getRefundableSwaps(signer));
            }
        });
    }
    getClaimableSwaps(chainId, signer) {
        return __awaiter(this, void 0, void 0, function* () {
            if (chainId == null) {
                const res = [];
                for (let chainId in this.chains) {
                    const chainData = this.chains[chainId];
                    [].concat(yield chainData.frombtcln.getClaimableSwaps(), yield chainData.frombtc.getClaimableSwaps()).forEach(val => res.push(val));
                }
                return res;
            }
            else {
                const chainData = this.chains[chainId];
                return [].concat(yield chainData.frombtcln.getClaimableSwaps(signer), yield chainData.frombtc.getClaimableSwaps(signer));
            }
        });
    }
    /**
     * Returns the token balance of the wallet
     */
    getBalance(chainIdentifierOrSigner, signerOrToken, token) {
        let chainIdentifier;
        let signer;
        if (typeof (signerOrToken) === "string") {
            chainIdentifier = chainIdentifierOrSigner;
            signer = signerOrToken;
        }
        else {
            chainIdentifier = signerOrToken.chainId;
            token = signerOrToken.address;
            signer = chainIdentifierOrSigner;
        }
        if (this.chains[chainIdentifier] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
        return this.chains[chainIdentifier].swapContract.getBalance(signer, token, false);
    }
    /**
     * Returns the maximum spendable balance of the wallet, deducting the fee needed to initiate a swap for native balances
     */
    getSpendableBalance(chainIdentifierOrSigner, signerOrToken, tokenOrFeeMultiplier, feeMultiplier) {
        return __awaiter(this, void 0, void 0, function* () {
            let chainIdentifier;
            let signer;
            let token;
            if (typeof (signerOrToken) === "string") {
                chainIdentifier = chainIdentifierOrSigner;
                signer = signerOrToken;
                token = tokenOrFeeMultiplier;
            }
            else {
                chainIdentifier = signerOrToken.chainId;
                token = signerOrToken.address;
                signer = chainIdentifierOrSigner;
                feeMultiplier = tokenOrFeeMultiplier;
            }
            if (this.chains[chainIdentifier] == null)
                throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
            const swapContract = this.chains[chainIdentifier].swapContract;
            if (swapContract.getNativeCurrencyAddress() !== token)
                return yield this.getBalance(chainIdentifier, signer, token);
            let [balance, commitFee] = yield Promise.all([
                this.getBalance(chainIdentifier, signer, token),
                swapContract.getCommitFee(
                //Use large amount, such that the fee for wrapping more tokens is always included!
                yield swapContract.createSwapData(base_1.ChainSwapType.HTLC, signer, null, token, new BN("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", "hex"), swapContract.getHashForHtlc(randomBytes(32)).toString("hex"), new BN(randomBytes(8)), new BN(Math.floor(Date.now() / 1000)), true, false, new BN(randomBytes(2)), new BN(randomBytes(2))))
            ]);
            if (feeMultiplier != null) {
                commitFee = commitFee.mul(new BN(Math.floor(feeMultiplier * 1000000))).div(new BN(1000000));
            }
            return BN.max(balance.sub(commitFee), new BN(0));
        });
    }
    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance(chainIdentifier, signer) {
        if (this.chains[chainIdentifier] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
        return this.chains[chainIdentifier].swapContract.getBalance(signer, this.getNativeTokenAddress(chainIdentifier), false);
    }
    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress(chainIdentifier) {
        if (this.chains[chainIdentifier] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
        return this.chains[chainIdentifier].swapContract.getNativeCurrencyAddress();
    }
    /**
     * Returns the address of the native currency of the chain
     */
    getNativeToken(chainIdentifier) {
        if (this.chains[chainIdentifier] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
        return this.tokens[chainIdentifier][this.chains[chainIdentifier].swapContract.getNativeCurrencyAddress()];
    }
    withChain(chainIdentifier) {
        if (this.chains[chainIdentifier] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
        return new SwapperWithChain_1.SwapperWithChain(this, chainIdentifier);
    }
    randomSigner(chainIdentifier) {
        if (this.chains[chainIdentifier] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainIdentifier);
        return this.chains[chainIdentifier].swapContract.randomSigner();
    }
    getChains() {
        return Object.keys(this.chains);
    }
}
exports.Swapper = Swapper;
