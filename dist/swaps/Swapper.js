"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Swapper = void 0;
const base_1 = require("@atomiqlabs/base");
const ToBTCLNWrapper_1 = require("./tobtc/ln/ToBTCLNWrapper");
const ToBTCWrapper_1 = require("./tobtc/onchain/ToBTCWrapper");
const FromBTCLNWrapper_1 = require("./frombtc/ln/FromBTCLNWrapper");
const FromBTCWrapper_1 = require("./frombtc/onchain/FromBTCWrapper");
const IntermediaryDiscovery_1 = require("../intermediaries/IntermediaryDiscovery");
const bolt11_1 = require("@atomiqlabs/bolt11");
const IntermediaryError_1 = require("../errors/IntermediaryError");
const SwapType_1 = require("./SwapType");
const MempoolBtcRelaySynchronizer_1 = require("../btc/mempool/synchronizer/MempoolBtcRelaySynchronizer");
const LnForGasWrapper_1 = require("./swapforgas/ln/LnForGasWrapper");
const events_1 = require("events");
const LNURL_1 = require("../utils/LNURL");
const Utils_1 = require("../utils/Utils");
const RequestError_1 = require("../errors/RequestError");
const SwapperWithChain_1 = require("./SwapperWithChain");
const OnchainForGasWrapper_1 = require("./swapforgas/onchain/OnchainForGasWrapper");
const randomBytes = require("randombytes");
const utils_1 = require("@scure/btc-signer/utils");
const btc_signer_1 = require("@scure/btc-signer");
const IndexedDBUnifiedStorage_1 = require("../browser-storage/IndexedDBUnifiedStorage");
const UnifiedSwapStorage_1 = require("./UnifiedSwapStorage");
const UnifiedSwapEventListener_1 = require("../events/UnifiedSwapEventListener");
class Swapper extends events_1.EventEmitter {
    constructor(bitcoinRpc, chainsData, pricing, tokens, options) {
        super();
        this.logger = (0, Utils_1.getLogger)(this.constructor.name + ": ");
        const storagePrefix = options?.storagePrefix ?? "atomiq-";
        options.bitcoinNetwork = options.bitcoinNetwork == null ? base_1.BitcoinNetwork.TESTNET : options.bitcoinNetwork;
        options.swapStorage ??= (name) => new IndexedDBUnifiedStorage_1.IndexedDBUnifiedStorage(name);
        this._bitcoinNetwork = options.bitcoinNetwork;
        this.bitcoinNetwork = options.bitcoinNetwork === base_1.BitcoinNetwork.MAINNET ? utils_1.NETWORK :
            options.bitcoinNetwork === base_1.BitcoinNetwork.TESTNET ? utils_1.TEST_NETWORK : null;
        this.prices = pricing;
        this.bitcoinRpc = bitcoinRpc;
        this.mempoolApi = bitcoinRpc.api;
        this.tokens = {};
        for (let tokenData of tokens) {
            for (let chainId in tokenData.chains) {
                const chainData = tokenData.chains[chainId];
                this.tokens[chainId] ??= {};
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
            const { swapContract, chainEvents, btcRelay } = chainData;
            const synchronizer = new MempoolBtcRelaySynchronizer_1.MempoolBtcRelaySynchronizer(btcRelay, bitcoinRpc);
            const storageHandler = options.swapStorage(storagePrefix + chainData.chainId);
            const unifiedSwapStorage = new UnifiedSwapStorage_1.UnifiedSwapStorage(storageHandler);
            const unifiedChainEvents = new UnifiedSwapEventListener_1.UnifiedSwapEventListener(unifiedSwapStorage, chainEvents);
            const wrappers = {};
            wrappers[SwapType_1.SwapType.TO_BTCLN] = new ToBTCLNWrapper_1.ToBTCLNWrapper(key, unifiedSwapStorage, unifiedChainEvents, swapContract, pricing, tokens, chainData.swapDataConstructor, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout,
            });
            wrappers[SwapType_1.SwapType.TO_BTC] = new ToBTCWrapper_1.ToBTCWrapper(key, unifiedSwapStorage, unifiedChainEvents, swapContract, pricing, tokens, chainData.swapDataConstructor, this.bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout,
                bitcoinNetwork: this.bitcoinNetwork
            });
            wrappers[SwapType_1.SwapType.FROM_BTCLN] = new FromBTCLNWrapper_1.FromBTCLNWrapper(key, unifiedSwapStorage, unifiedChainEvents, swapContract, pricing, tokens, chainData.swapDataConstructor, bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout
            });
            wrappers[SwapType_1.SwapType.FROM_BTC] = new FromBTCWrapper_1.FromBTCWrapper(key, unifiedSwapStorage, unifiedChainEvents, swapContract, pricing, tokens, chainData.swapDataConstructor, btcRelay, synchronizer, this.bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout,
                bitcoinNetwork: this.bitcoinNetwork
            });
            wrappers[SwapType_1.SwapType.TRUSTED_FROM_BTCLN] = new LnForGasWrapper_1.LnForGasWrapper(key, unifiedSwapStorage, unifiedChainEvents, swapContract, pricing, tokens, chainData.swapDataConstructor, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout
            });
            wrappers[SwapType_1.SwapType.TRUSTED_FROM_BTC] = new OnchainForGasWrapper_1.OnchainForGasWrapper(key, unifiedSwapStorage, unifiedChainEvents, swapContract, pricing, tokens, chainData.swapDataConstructor, bitcoinRpc, {
                getRequestTimeout: options.getRequestTimeout,
                postRequestTimeout: options.postRequestTimeout
            });
            Object.keys(wrappers).forEach(key => wrappers[key].events.on("swapState", this.swapStateListener));
            const reviver = (val) => {
                const wrapper = wrappers[val.type];
                if (wrapper == null)
                    return null;
                return new wrapper.swapDeserializer(wrapper, val);
            };
            return {
                chainEvents,
                swapContract,
                btcRelay,
                synchronizer,
                wrappers,
                unifiedChainEvents,
                unifiedSwapStorage,
                reviver
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
            (0, btc_signer_1.Address)(this.bitcoinNetwork).decode(addr);
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
            return (BigInt(parsed.millisatoshis) + 999n) / 1000n;
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
                return BigInt(max);
        }
        return 0n;
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
                return BigInt(min);
        }
        return 0n;
    }
    /**
     * Initializes the swap storage and loads existing swaps, needs to be called before any other action
     */
    async init() {
        this.logger.info("init(): Intializing swapper: ", this);
        for (let chainIdentifier in this.chains) {
            const { swapContract, unifiedChainEvents, unifiedSwapStorage, wrappers, reviver } = this.chains[chainIdentifier];
            await swapContract.start();
            this.logger.info("init(): Intialized swap contract: " + chainIdentifier);
            await unifiedSwapStorage.init();
            if (unifiedSwapStorage.storage instanceof IndexedDBUnifiedStorage_1.IndexedDBUnifiedStorage) {
                //Try to migrate the data here
                const storagePrefix = chainIdentifier === "SOLANA" ?
                    "SOLv4-" + this._bitcoinNetwork + "-Swaps-" :
                    "atomiqsdk-" + this._bitcoinNetwork + chainIdentifier + "-Swaps-";
                await unifiedSwapStorage.storage.tryMigrate([
                    [storagePrefix + "FromBTC", SwapType_1.SwapType.FROM_BTC],
                    [storagePrefix + "FromBTCLN", SwapType_1.SwapType.FROM_BTCLN],
                    [storagePrefix + "ToBTC", SwapType_1.SwapType.TO_BTC],
                    [storagePrefix + "ToBTCLN", SwapType_1.SwapType.TO_BTCLN]
                ], (obj) => {
                    const swap = reviver(obj);
                    if (swap.randomNonce == null) {
                        const oldIdentifierHash = swap.getIdentifierHashString();
                        swap.randomNonce = randomBytes(16).toString("hex");
                        const newIdentifierHash = swap.getIdentifierHashString();
                        this.logger.info("init(): Found older swap version without randomNonce, replacing, old hash: " + oldIdentifierHash +
                            " new hash: " + newIdentifierHash);
                    }
                    return swap;
                });
            }
            if (!this.options.noEvents)
                await unifiedChainEvents.start();
            this.logger.info("init(): Intialized events: " + chainIdentifier);
            for (let key in wrappers) {
                this.logger.info("init(): Initializing " + SwapType_1.SwapType[key] + ": " + chainIdentifier);
                await wrappers[key].init(this.options.noTimers, this.options.dontCheckPastSwaps);
            }
        }
        this.logger.info("init(): Initializing intermediary discovery");
        if (!this.options.dontFetchLPs)
            await this.intermediaryDiscovery.init();
        if (this.options.defaultTrustedIntermediaryUrl != null) {
            this.defaultTrustedIntermediary = await this.intermediaryDiscovery.getIntermediary(this.options.defaultTrustedIntermediaryUrl);
        }
    }
    /**
     * Stops listening for onchain events and closes this Swapper instance
     */
    async stop() {
        for (let chainIdentifier in this.chains) {
            const { wrappers } = this.chains[chainIdentifier];
            for (let key in wrappers) {
                wrappers[key].off("swapState", this.swapStateListener);
                await wrappers[key].stop();
            }
        }
    }
    /**
     * Returns a set of supported tokens by all the intermediaries offering a specific swap service
     *
     * @param swapType Swap service type to check supported tokens for
     */
    getSupportedTokens(swapType) {
        const tokens = [];
        this.intermediaryDiscovery.intermediaries.forEach(lp => {
            if (lp.services[swapType] == null)
                return;
            if (lp.services[swapType].chainTokens == null)
                return;
            for (let chainId in lp.services[swapType].chainTokens) {
                for (let tokenAddress of lp.services[swapType].chainTokens[chainId]) {
                    const token = this.tokens?.[chainId]?.[tokenAddress];
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
    async createSwap(chainIdentifier, create, amountData, swapType, maxWaitTimeMS = 2000) {
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
            await this.intermediaryDiscovery.reloadIntermediaries();
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
        const quotePromises = await create(candidates, abortController.signal, this.chains[chainIdentifier]);
        const quotes = await new Promise((resolve, reject) => {
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
                            min = (0, Utils_1.bigIntMin)(min, e.min);
                            max = (0, Utils_1.bigIntMax)(max, e.max);
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
                return (0, Utils_1.bigIntCompare)(b.quote.getOutput().rawAmount, a.quote.getOutput().rawAmount);
            }
            else {
                //Compare inputs
                return (0, Utils_1.bigIntCompare)(a.quote.getOutput().rawAmount, b.quote.getOutput().rawAmount);
            }
        });
        this.logger.debug("createSwap(): Sorted quotes, best price to worst: ", quotes);
        return quotes[0].quote;
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
        return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => Promise.resolve(chain.wrappers[SwapType_1.SwapType.TO_BTC].create(signer, address, amountData, candidates, {
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
    async createToBTCLNSwap(chainIdentifier, signer, tokenAddress, paymentRequest, expirySeconds, maxRoutingBaseFee, maxRoutingPPM, additionalParams = this.options.defaultAdditionalParameters) {
        const parsedPR = (0, bolt11_1.decode)(paymentRequest);
        const amountData = {
            amount: (BigInt(parsedPR.millisatoshis) + 999n) / 1000n,
            token: tokenAddress,
            exactIn: false
        };
        expirySeconds ??= 5 * 24 * 3600;
        return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => chain.wrappers[SwapType_1.SwapType.TO_BTCLN].create(signer, paymentRequest, amountData, candidates, {
            expirySeconds,
            maxRoutingPPM,
            maxRoutingBaseFee
        }, additionalParams, abortSignal), amountData, SwapType_1.SwapType.TO_BTCLN);
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
    async createToBTCLNSwapViaLNURL(chainIdentifier, signer, tokenAddress, lnurlPay, amount, comment, expirySeconds, maxRoutingBaseFee, maxRoutingPPM, exactIn, additionalParams = this.options.defaultAdditionalParameters) {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn
        };
        expirySeconds ??= 5 * 24 * 3600;
        return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => chain.wrappers[SwapType_1.SwapType.TO_BTCLN].createViaLNURL(signer, typeof (lnurlPay) === "string" ? lnurlPay : lnurlPay.params, amountData, candidates, {
            expirySeconds,
            comment,
            maxRoutingBaseFee,
            maxRoutingPPM
        }, additionalParams, abortSignal), amountData, SwapType_1.SwapType.TO_BTCLN);
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
    async createFromBTCSwap(chainIdentifier, signer, tokenAddress, amount, exactOut, additionalParams = this.options.defaultAdditionalParameters) {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn: !exactOut
        };
        return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => Promise.resolve(chain.wrappers[SwapType_1.SwapType.FROM_BTC].create(signer, amountData, candidates, null, additionalParams, abortSignal)), amountData, SwapType_1.SwapType.FROM_BTC);
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
    async createFromBTCLNSwap(chainIdentifier, signer, tokenAddress, amount, exactOut, descriptionHash, additionalParams = this.options.defaultAdditionalParameters) {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn: !exactOut
        };
        return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => Promise.resolve(chain.wrappers[SwapType_1.SwapType.FROM_BTCLN].create(signer, amountData, candidates, {
            descriptionHash
        }, additionalParams, abortSignal)), amountData, SwapType_1.SwapType.FROM_BTCLN);
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
    async createFromBTCLNSwapViaLNURL(chainIdentifier, signer, tokenAddress, lnurl, amount, exactOut, additionalParams = this.options.defaultAdditionalParameters) {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn: !exactOut
        };
        return this.createSwap(chainIdentifier, (candidates, abortSignal, chain) => chain.wrappers[SwapType_1.SwapType.FROM_BTCLN].createViaLNURL(signer, typeof (lnurl) === "string" ? lnurl : lnurl.params, amountData, candidates, additionalParams, abortSignal), amountData, SwapType_1.SwapType.FROM_BTCLN);
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
        if (this.chains[chainId] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainId);
        const useUrl = trustedIntermediaryOrUrl ?? this.defaultTrustedIntermediary ?? this.options.defaultTrustedIntermediaryUrl;
        if (useUrl == null)
            throw new Error("No trusted intermediary specified!");
        return this.chains[chainId].wrappers[SwapType_1.SwapType.TRUSTED_FROM_BTCLN].create(signer, amount, useUrl);
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
        if (this.chains[chainId] == null)
            throw new Error("Invalid chain identifier! Unknown chain: " + chainId);
        const useUrl = trustedIntermediaryOrUrl ?? this.defaultTrustedIntermediary ?? this.options.defaultTrustedIntermediaryUrl;
        if (useUrl == null)
            throw new Error("No trusted intermediary specified!");
        return this.chains[chainId].wrappers[SwapType_1.SwapType.TRUSTED_FROM_BTC].create(signer, amount, useUrl, refundAddress);
    }
    async getAllSwaps(chainId, signer) {
        const queryParams = [];
        if (signer != null)
            queryParams.push({ key: "intiator", value: signer });
        if (chainId == null) {
            const res = await Promise.all(Object.keys(this.chains).map((chainId) => {
                const { unifiedSwapStorage, reviver } = this.chains[chainId];
                return unifiedSwapStorage.query([queryParams], reviver);
            }));
            return res.flat();
        }
        else {
            const { unifiedSwapStorage, reviver } = this.chains[chainId];
            return await unifiedSwapStorage.query([queryParams], reviver);
        }
    }
    async getActionableSwaps(chainId, signer) {
        if (chainId == null) {
            const res = await Promise.all(Object.keys(this.chains).map((chainId) => {
                const { unifiedSwapStorage, reviver, wrappers } = this.chains[chainId];
                const queryParams = [];
                for (let key in wrappers) {
                    const wrapper = wrappers[key];
                    const swapTypeQueryParams = [{ key: "type", value: wrapper.TYPE }];
                    if (signer != null)
                        swapTypeQueryParams.push({ key: "intiator", value: signer });
                    swapTypeQueryParams.push({ key: "state", value: wrapper.pendingSwapStates });
                    queryParams.push(swapTypeQueryParams);
                }
                return unifiedSwapStorage.query(queryParams, reviver);
            }));
            return res.flat().filter(swap => swap.isActionable());
        }
        else {
            const { unifiedSwapStorage, reviver, wrappers } = this.chains[chainId];
            const queryParams = [];
            for (let key in wrappers) {
                const wrapper = wrappers[key];
                const swapTypeQueryParams = [{ key: "type", value: wrapper.TYPE }];
                if (signer != null)
                    swapTypeQueryParams.push({ key: "intiator", value: signer });
                swapTypeQueryParams.push({ key: "state", value: wrapper.pendingSwapStates });
                queryParams.push(swapTypeQueryParams);
            }
            return (await unifiedSwapStorage.query(queryParams, reviver)).filter(swap => swap.isActionable());
        }
    }
    async getRefundableSwaps(chainId, signer) {
        if (chainId == null) {
            const res = await Promise.all(Object.keys(this.chains).map((chainId) => {
                const { unifiedSwapStorage, reviver, wrappers } = this.chains[chainId];
                const queryParams = [];
                for (let wrapper of [wrappers[SwapType_1.SwapType.TO_BTCLN], wrappers[SwapType_1.SwapType.TO_BTC]]) {
                    const swapTypeQueryParams = [{ key: "type", value: wrapper.TYPE }];
                    if (signer != null)
                        swapTypeQueryParams.push({ key: "intiator", value: signer });
                    swapTypeQueryParams.push({ key: "state", value: wrapper.pendingSwapStates });
                    queryParams.push(swapTypeQueryParams);
                }
                return unifiedSwapStorage.query(queryParams, reviver);
            }));
            return res.flat().filter(swap => swap.isRefundable());
        }
        else {
            const { unifiedSwapStorage, reviver, wrappers } = this.chains[chainId];
            const queryParams = [];
            for (let wrapper of [wrappers[SwapType_1.SwapType.TO_BTCLN], wrappers[SwapType_1.SwapType.TO_BTC]]) {
                const swapTypeQueryParams = [{ key: "type", value: wrapper.TYPE }];
                if (signer != null)
                    swapTypeQueryParams.push({ key: "intiator", value: signer });
                swapTypeQueryParams.push({ key: "state", value: wrapper.pendingSwapStates });
                queryParams.push(swapTypeQueryParams);
            }
            const result = await unifiedSwapStorage.query(queryParams, reviver);
            return result.filter(swap => swap.isRefundable());
        }
    }
    async getSwapById(id, chainId, signer) {
        const queryParams = [];
        if (signer != null)
            queryParams.push({ key: "intiator", value: signer });
        queryParams.push({ key: "id", value: id });
        if (chainId == null) {
            const res = await Promise.all(Object.keys(this.chains).map((chainId) => {
                const { unifiedSwapStorage, reviver } = this.chains[chainId];
                return unifiedSwapStorage.query([queryParams], reviver);
            }));
            return res.flat()[0];
        }
        else {
            const { unifiedSwapStorage, reviver } = this.chains[chainId];
            return (await unifiedSwapStorage.query([queryParams], reviver))[0];
        }
    }
    /**
     * Synchronizes swaps from chain, this is usually ran when SDK is initialized, deletes expired quotes
     *
     * @param chainId
     * @param signer
     */
    async _syncSwaps(chainId, signer) {
        if (chainId == null) {
            await Promise.all(Object.keys(this.chains).map(async (chainId) => {
                const { unifiedSwapStorage, reviver, wrappers } = this.chains[chainId];
                const queryParams = [];
                for (let key in wrappers) {
                    const wrapper = wrappers[key];
                    const swapTypeQueryParams = [{ key: "type", value: wrapper.TYPE }];
                    if (signer != null)
                        swapTypeQueryParams.push({ key: "intiator", value: signer });
                    swapTypeQueryParams.push({ key: "state", value: wrapper.pendingSwapStates });
                    queryParams.push(swapTypeQueryParams);
                }
                const swaps = await unifiedSwapStorage.query(queryParams, reviver);
                const changedSwaps = [];
                for (let swap of swaps) {
                    const swapChanged = await swap._sync(false).catch(e => this.logger.error("_syncSwaps(): Error in swap: " + swap.getIdentifierHashString(), e));
                    if (swapChanged)
                        changedSwaps.push(swap);
                }
                await unifiedSwapStorage.saveAll(changedSwaps);
            }));
        }
        else {
            const { unifiedSwapStorage, reviver, wrappers } = this.chains[chainId];
            const queryParams = [];
            for (let key in wrappers) {
                const wrapper = wrappers[key];
                const swapTypeQueryParams = [{ key: "type", value: wrapper.TYPE }];
                if (signer != null)
                    swapTypeQueryParams.push({ key: "intiator", value: signer });
                swapTypeQueryParams.push({ key: "state", value: wrapper.pendingSwapStates });
                queryParams.push(swapTypeQueryParams);
            }
            const swaps = await unifiedSwapStorage.query(queryParams, reviver);
            const changedSwaps = [];
            for (let swap of swaps) {
                const swapChanged = await swap._sync(false).catch(e => this.logger.error("_syncSwaps(): Error in swap: " + swap.getIdentifierHashString(), e));
                if (swapChanged)
                    changedSwaps.push(swap);
            }
            await unifiedSwapStorage.saveAll(changedSwaps);
        }
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
    async getSpendableBalance(chainIdentifierOrSigner, signerOrToken, tokenOrFeeMultiplier, feeMultiplier) {
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
            return await this.getBalance(chainIdentifier, signer, token);
        let [balance, commitFee] = await Promise.all([
            this.getBalance(chainIdentifier, signer, token),
            swapContract.getCommitFee(
            //Use large amount, such that the fee for wrapping more tokens is always included!
            await swapContract.createSwapData(base_1.ChainSwapType.HTLC, signer, null, token, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn, swapContract.getHashForHtlc(randomBytes(32)).toString("hex"), base_1.BigIntBufferUtils.fromBuffer(randomBytes(8)), BigInt(Math.floor(Date.now() / 1000)), true, false, base_1.BigIntBufferUtils.fromBuffer(randomBytes(2)), base_1.BigIntBufferUtils.fromBuffer(randomBytes(2))))
        ]);
        if (feeMultiplier != null) {
            commitFee = commitFee * (BigInt(Math.floor(feeMultiplier * 1000000))) / 1000000n;
        }
        return (0, Utils_1.bigIntMax)(balance - commitFee, 0n);
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
