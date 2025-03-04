import {ISwapPrice} from "../prices/abstract/ISwapPrice";
import {
    BigIntBufferUtils,
    BitcoinNetwork,
    BtcRelay,
    ChainData,
    ChainSwapType,
    ChainType,
    RelaySynchronizer
} from "@atomiqlabs/base";
import {ToBTCLNWrapper} from "./tobtc/ln/ToBTCLNWrapper";
import {ToBTCWrapper} from "./tobtc/onchain/ToBTCWrapper";
import {FromBTCLNWrapper} from "./frombtc/ln/FromBTCLNWrapper";
import {FromBTCWrapper} from "./frombtc/onchain/FromBTCWrapper";
import {IntermediaryDiscovery, MultichainSwapBounds, SwapBounds} from "../intermediaries/IntermediaryDiscovery";
import {decode as bolt11Decode} from "@atomiqlabs/bolt11";
import {ISwap} from "./ISwap";
import {IntermediaryError} from "../errors/IntermediaryError";
import {SwapType} from "./SwapType";
import {FromBTCLNSwap} from "./frombtc/ln/FromBTCLNSwap";
import {FromBTCSwap} from "./frombtc/onchain/FromBTCSwap";
import {ToBTCLNSwap} from "./tobtc/ln/ToBTCLNSwap";
import {ToBTCSwap} from "./tobtc/onchain/ToBTCSwap";
import {MempoolApi} from "../btc/mempool/MempoolApi";
import {MempoolBitcoinRpc} from "../btc/mempool/MempoolBitcoinRpc";
import {MempoolBtcRelaySynchronizer} from "../btc/mempool/synchronizer/MempoolBtcRelaySynchronizer";
import {LnForGasWrapper} from "./swapforgas/ln/LnForGasWrapper";
import {LnForGasSwap} from "./swapforgas/ln/LnForGasSwap";
import {EventEmitter} from "events";
import {Buffer} from "buffer";
import {MempoolBitcoinBlock} from "../btc/mempool/MempoolBitcoinBlock";
import {Intermediary} from "../intermediaries/Intermediary";
import {isLNURLPay, isLNURLWithdraw, LNURL, LNURLPay, LNURLWithdraw} from "../utils/LNURL";
import {AmountData, WrapperCtorTokens} from "./ISwapWrapper";
import {bigIntCompare, bigIntMax, bigIntMin, getLogger, objectMap} from "../utils/Utils";
import {OutOfBoundsError} from "../errors/RequestError";
import {SwapperWithChain} from "./SwapperWithChain";
import {BtcToken, SCToken, Token} from "./Tokens";
import {OnchainForGasSwap} from "./swapforgas/onchain/OnchainForGasSwap";
import {OnchainForGasWrapper} from "./swapforgas/onchain/OnchainForGasWrapper";
import * as randomBytes from "randombytes";
import {BTC_NETWORK, NETWORK, TEST_NETWORK} from "@scure/btc-signer/utils";
import {Address} from "@scure/btc-signer";
import {IUnifiedStorage, QueryParams} from "../storage/IUnifiedStorage";
import {IndexedDBUnifiedStorage} from "../browser-storage/IndexedDBUnifiedStorage";
import {UnifiedSwapStorage} from "./UnifiedSwapStorage";
import {UnifiedSwapEventListener} from "../events/UnifiedSwapEventListener";

export type SwapperOptions = {
    intermediaryUrl?: string | string[],
    registryUrl?: string,

    bitcoinNetwork?: BitcoinNetwork,

    getRequestTimeout?: number,
    postRequestTimeout?: number,
    defaultAdditionalParameters?: {[key: string]: any},
    storagePrefix?: string
    defaultTrustedIntermediaryUrl?: string,

    swapStorage?: <T extends ChainType>(chainId: T["ChainId"]) => IUnifiedStorage,

    noTimers?: boolean,
    noEvents?: boolean,
    dontCheckPastSwaps?: boolean,
    dontFetchLPs?: boolean
};

export type MultiChain = {
    [chainIdentifier in string]: ChainType;
};

export type ChainSpecificData<T extends ChainType> = {
    wrappers: {
        [SwapType.TO_BTCLN]: ToBTCLNWrapper<T>,
        [SwapType.TO_BTC]: ToBTCWrapper<T>,
        [SwapType.FROM_BTCLN]: FromBTCLNWrapper<T>,
        [SwapType.FROM_BTC]: FromBTCWrapper<T>,
        [SwapType.TRUSTED_FROM_BTCLN]: LnForGasWrapper<T>,
        [SwapType.TRUSTED_FROM_BTC]: OnchainForGasWrapper<T>
    }
    chainEvents: T["Events"],
    swapContract: T["Contract"],
    btcRelay: BtcRelay<any, T["TX"], MempoolBitcoinBlock, T["Signer"]>,
    synchronizer: RelaySynchronizer<any, T["TX"], MempoolBitcoinBlock>,
    unifiedChainEvents: UnifiedSwapEventListener<T>,
    unifiedSwapStorage: UnifiedSwapStorage<T>,
    reviver: (val: any) => ISwap<T>
};

export type MultiChainData<T extends MultiChain> = {
    [chainIdentifier in keyof T]: ChainSpecificData<T[chainIdentifier]>
};

export type CtorMultiChainData<T extends MultiChain> = {
    [chainIdentifier in keyof T]: ChainData<T[chainIdentifier]>
};

export type ChainIds<T extends MultiChain> = keyof T & string;

export interface SwapperBtcUtils {
    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr: string): boolean;

    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr: string): boolean;

    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl: string): boolean;

    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl: string, shouldRetry?: boolean): Promise<LNURLPay | LNURLWithdraw | null>;

    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr: string): bigint;
}

export class Swapper<T extends MultiChain> extends EventEmitter implements SwapperBtcUtils {

    protected readonly logger = getLogger(this.constructor.name+": ");

    protected readonly swapStateListener: (swap: ISwap) => void;

    private defaultTrustedIntermediary: Intermediary;

    readonly chains: MultiChainData<T>;

    readonly prices: ISwapPrice<T>;
    readonly intermediaryDiscovery: IntermediaryDiscovery;
    readonly options: SwapperOptions;

    readonly mempoolApi: MempoolApi;
    readonly bitcoinRpc: MempoolBitcoinRpc;
    readonly bitcoinNetwork: BTC_NETWORK;
    readonly tokens: {
        [chainId: string]: {
            [tokenAddress: string]: SCToken
        }
    };

    constructor(
        bitcoinRpc: MempoolBitcoinRpc,
        chainsData: CtorMultiChainData<T>,
        pricing: ISwapPrice<T>,
        tokens: WrapperCtorTokens<T>,
        options?: SwapperOptions
    ) {
        super();
        const storagePrefix = options?.storagePrefix ?? "atomiq-";

        options.bitcoinNetwork = options.bitcoinNetwork==null ? BitcoinNetwork.TESTNET : options.bitcoinNetwork;
        options.swapStorage ??= (name: string) => new IndexedDBUnifiedStorage(name);

        this.bitcoinNetwork = options.bitcoinNetwork===BitcoinNetwork.MAINNET ? NETWORK :
                options.bitcoinNetwork===BitcoinNetwork.TESTNET ? TEST_NETWORK : null;

        this.prices = pricing;
        this.bitcoinRpc = bitcoinRpc;
        this.mempoolApi = bitcoinRpc.api;

        this.tokens = {};
        for(let tokenData of tokens) {
            for(let chainId in tokenData.chains) {
                const chainData = tokenData.chains[chainId];
                this.tokens[chainId] ??= {};
                this.tokens[chainId][chainData.address] = {
                    chain: "SC",
                    chainId,
                    ticker: tokenData.ticker,
                    name: tokenData.name,
                    decimals: chainData.decimals,
                    address: chainData.address
                }
            }
        }

        this.swapStateListener = (swap: ISwap) => {
            this.emit("swapState", swap);
        };

        this.chains = objectMap<CtorMultiChainData<T>, MultiChainData<T>>(chainsData, <InputKey extends keyof CtorMultiChainData<T>>(chainData: CtorMultiChainData<T>[InputKey], key: string) => {
            const {swapContract, chainEvents, btcRelay} = chainData;
            const synchronizer = new MempoolBtcRelaySynchronizer(btcRelay, bitcoinRpc);

            const storageHandler = options.swapStorage(storagePrefix + chainData.chainId);
            const unifiedSwapStorage = new UnifiedSwapStorage<T[InputKey]>(storageHandler);
            const unifiedChainEvents = new UnifiedSwapEventListener<T[InputKey]>(unifiedSwapStorage, chainEvents);

            const wrappers: any = {};

            wrappers[SwapType.TO_BTCLN] = new ToBTCLNWrapper<T[InputKey]>(
                key,
                unifiedSwapStorage,
                unifiedChainEvents,
                swapContract,
                pricing,
                tokens,
                chainData.swapDataConstructor,
                {
                    getRequestTimeout: options.getRequestTimeout,
                    postRequestTimeout: options.postRequestTimeout,
                }
            );
            wrappers[SwapType.TO_BTC] = new ToBTCWrapper<T[InputKey]>(
                key,
                unifiedSwapStorage,
                unifiedChainEvents,
                swapContract,
                pricing,
                tokens,
                chainData.swapDataConstructor,
                this.bitcoinRpc,
                {
                    getRequestTimeout: options.getRequestTimeout,
                    postRequestTimeout: options.postRequestTimeout,
                    bitcoinNetwork: this.bitcoinNetwork
                }
            );
            wrappers[SwapType.FROM_BTCLN] = new FromBTCLNWrapper<T[InputKey]>(
                key,
                unifiedSwapStorage,
                unifiedChainEvents,
                swapContract,
                pricing,
                tokens,
                chainData.swapDataConstructor,
                bitcoinRpc,
                {
                    getRequestTimeout: options.getRequestTimeout,
                    postRequestTimeout: options.postRequestTimeout
                }
            );
            wrappers[SwapType.FROM_BTC] = new FromBTCWrapper<T[InputKey]>(
                key,
                unifiedSwapStorage,
                unifiedChainEvents,
                swapContract,
                pricing,
                tokens,
                chainData.swapDataConstructor,
                btcRelay,
                synchronizer,
                this.bitcoinRpc,
                {
                    getRequestTimeout: options.getRequestTimeout,
                    postRequestTimeout: options.postRequestTimeout,
                    bitcoinNetwork: this.bitcoinNetwork
                }
            );
            wrappers[SwapType.TRUSTED_FROM_BTCLN] = new LnForGasWrapper<T[InputKey]>(
                key,
                unifiedSwapStorage,
                unifiedChainEvents,
                swapContract,
                pricing,
                tokens,
                chainData.swapDataConstructor,
                {
                    getRequestTimeout: options.getRequestTimeout,
                    postRequestTimeout: options.postRequestTimeout
                }
            );
            wrappers[SwapType.TRUSTED_FROM_BTC] = new OnchainForGasWrapper<T[InputKey]>(
                key,
                unifiedSwapStorage,
                unifiedChainEvents,
                swapContract,
                pricing,
                tokens,
                chainData.swapDataConstructor,
                bitcoinRpc,
                {
                    getRequestTimeout: options.getRequestTimeout,
                    postRequestTimeout: options.postRequestTimeout
                }
            );

            Object.keys(wrappers).forEach(key => wrappers[key].events.on("swapState", this.swapStateListener));

            return {
                chainEvents,
                swapContract,
                btcRelay,
                synchronizer,

                wrappers,

                unifiedChainEvents,
                unifiedSwapStorage,

                reviver: (val: any) => {
                    const wrapper = wrappers[val.type];
                    if(wrapper==null) return null;
                    return new wrapper.swapDeserializer(wrapper, val);
                }
            }
        });

        const contracts = objectMap(chainsData, (data) => data.swapContract);
        if(options.intermediaryUrl!=null) {
            this.intermediaryDiscovery = new IntermediaryDiscovery(contracts, options.registryUrl, Array.isArray(options.intermediaryUrl) ? options.intermediaryUrl : [options.intermediaryUrl], options.getRequestTimeout);
        } else {
            this.intermediaryDiscovery = new IntermediaryDiscovery(contracts, options.registryUrl, null, options.getRequestTimeout);
        }

        this.intermediaryDiscovery.on("removed", (intermediaries: Intermediary[]) => {
            this.emit("lpsRemoved", intermediaries);
        });

        this.intermediaryDiscovery.on("added", (intermediaries: Intermediary[]) => {
            this.emit("lpsAdded", intermediaries);
        });

        this.options = options;
    }

    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice
     *
     * @param lnpr
     */
    private isLightningInvoice(lnpr: string): boolean {
        try {
            bolt11Decode(lnpr);
            return true;
        } catch (e) {}
        return false;
    }

    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr: string): boolean {
        try {
            Address(this.bitcoinNetwork).decode(addr);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr: string): boolean {
        try {
            const parsed = bolt11Decode(lnpr);
            if(parsed.millisatoshis!=null) return true;
        } catch (e) {}
        return false;
    }

    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl: string): boolean {
        return LNURL.isLNURL(lnurl);
    }

    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl: string, shouldRetry?: boolean): Promise<LNURLPay | LNURLWithdraw | null> {
        return LNURL.getLNURLType(lnurl, shouldRetry);
    }

    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr: string): bigint {
        const parsed = bolt11Decode(lnpr);
        if(parsed.millisatoshis!=null) return (BigInt(parsed.millisatoshis) + 999n) / 1000n;
        return null;
    }

    getSwapBounds<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): SwapBounds;
    getSwapBounds(): MultichainSwapBounds;

    /**
     * Returns swap bounds (minimums & maximums) for different swap types & tokens
     */
    getSwapBounds<ChainIdentifier extends ChainIds<T>>(chainIdentifier?: ChainIdentifier): SwapBounds | MultichainSwapBounds {
        if(this.intermediaryDiscovery!=null) {
            if(chainIdentifier==null) {
                return this.intermediaryDiscovery.getMultichainSwapBounds();
            } else {
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
    getMaximum<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, type: SwapType, token: string): bigint {
        if(this.intermediaryDiscovery!=null) {
            const max = this.intermediaryDiscovery.getSwapMaximum(chainIdentifier, type, token);
            if(max!=null) return BigInt(max);
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
    getMinimum<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, type: SwapType, token: string): bigint {
        if(this.intermediaryDiscovery!=null) {
            const min = this.intermediaryDiscovery.getSwapMinimum(chainIdentifier, type, token);
            if(min!=null) return BigInt(min);
        }
        return 0n;
    }

    /**
     * Initializes the swap storage and loads existing swaps, needs to be called before any other action
     */
    async init(): Promise<void> {
        this.logger.info("init(): Intializing swapper: ", this);

        for(let chainIdentifier in this.chains) {
            const {
                swapContract,
                unifiedChainEvents,
                unifiedSwapStorage,
                wrappers
            } = this.chains[chainIdentifier];
            await swapContract.start();
            this.logger.info("init(): Intialized swap contract: "+chainIdentifier);

            await unifiedSwapStorage.init();
            if(!this.options.noEvents) await unifiedChainEvents.start();
            this.logger.info("init(): Intialized events: "+chainIdentifier);

            for(let key in wrappers) {
                this.logger.info("init(): Initializing "+SwapType[key]+": "+chainIdentifier);
                wrappers[key].init(this.options.noTimers, this.options.dontCheckPastSwaps);
            }
        }

        this.logger.info("init(): Initializing intermediary discovery");
        if(!this.options.dontFetchLPs) await this.intermediaryDiscovery.init();

        if(this.options.defaultTrustedIntermediaryUrl!=null) {
            this.defaultTrustedIntermediary = await this.intermediaryDiscovery.getIntermediary(this.options.defaultTrustedIntermediaryUrl);
        }
    }

    /**
     * Stops listening for onchain events and closes this Swapper instance
     */
    async stop() {
        for(let chainIdentifier in this.chains) {
            const {
                wrappers
            } = this.chains[chainIdentifier];
            for(let key in wrappers) {
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
    getSupportedTokens(swapType: SwapType): SCToken[] {
        const tokens: SCToken[] = [];
        this.intermediaryDiscovery.intermediaries.forEach(lp => {
            if(lp.services[swapType]==null) return;
            if(lp.services[swapType].chainTokens==null) return;
            for(let chainId in lp.services[swapType].chainTokens) {
                for(let tokenAddress of lp.services[swapType].chainTokens[chainId]) {
                    const token = this.tokens?.[chainId]?.[tokenAddress];
                    if(token!=null) tokens.push(token);
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
    getSupportedTokenAddresses<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, swapType: SwapType): Set<string> {
        const set = new Set<string>();
        this.intermediaryDiscovery.intermediaries.forEach(lp => {
            if(lp.services[swapType]==null) return;
            if(lp.services[swapType].chainTokens==null || lp.services[swapType].chainTokens[chainIdentifier]==null) return;
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
    private async createSwap<ChainIdentifier extends ChainIds<T>, S extends ISwap<T[ChainIdentifier]>>(
        chainIdentifier: ChainIdentifier,
        create: (candidates: Intermediary[], abortSignal: AbortSignal, chain: ChainSpecificData<T[ChainIdentifier]>) => Promise<{
            quote: Promise<S>,
            intermediary: Intermediary
        }[]>,
        amountData: AmountData,
        swapType: SwapType,
        maxWaitTimeMS: number = 2000
    ): Promise<S> {
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);
        let candidates: Intermediary[];

        const inBtc: boolean = swapType===SwapType.TO_BTCLN || swapType===SwapType.TO_BTC ? !amountData.exactIn : amountData.exactIn;

        if(!inBtc) {
            //Get candidates not based on the amount
            candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token);
        } else {
            candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token, amountData.amount);
        }

        if(candidates.length===0)  {
            this.logger.warn("createSwap(): No valid intermediary found, reloading intermediary database...");
            await this.intermediaryDiscovery.reloadIntermediaries();

            if(!inBtc) {
                //Get candidates not based on the amount
                candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token);
            } else {
                candidates = this.intermediaryDiscovery.getSwapCandidates(chainIdentifier, swapType, amountData.token, amountData.amount);
            }

            if(candidates.length===0) throw new Error("No intermediary found!");
        }


        const abortController = new AbortController();
        this.logger.debug("createSwap() Swap candidates: ", candidates.map(lp => lp.url).join());
        const quotePromises: {quote: Promise<S>, intermediary: Intermediary}[] = await create(candidates, abortController.signal, this.chains[chainIdentifier]);

        const quotes = await new Promise<{
            quote: S,
            intermediary: Intermediary
        }[]>((resolve, reject) => {
            let min: bigint;
            let max: bigint;
            let error: Error;
            let numResolved = 0;
            let quotes: {
                quote: S,
                intermediary: Intermediary
            }[] = [];
            let timeout: NodeJS.Timeout;

            quotePromises.forEach(data => {
                data.quote.then(quote => {
                    if(numResolved===0) {
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
                    if(numResolved===quotePromises.length) {
                        clearTimeout(timeout);
                        resolve(quotes);
                        return;
                    }
                }).catch(e => {
                    numResolved++;
                    if(e instanceof IntermediaryError) {
                        //Blacklist that node
                        this.intermediaryDiscovery.removeIntermediary(data.intermediary);
                    }
                    if(e instanceof OutOfBoundsError) {
                        if(min==null || max==null) {
                            min = e.min;
                            max = e.max;
                        } else {
                            min = bigIntMin(min, e.min);
                            max = bigIntMax(max, e.max);
                        }
                    }
                    this.logger.error("createSwap(): Intermediary "+data.intermediary.url+" error: ", e);
                    error = e;

                    if(numResolved===quotePromises.length) {
                        if(timeout!=null) clearTimeout(timeout);
                        if(quotes.length>0) {
                            resolve(quotes);
                            return;
                        }
                        if(min!=null && max!=null) {
                            reject(new OutOfBoundsError("Out of bounds", 400, min, max));
                            return;
                        }
                        reject(error);
                    }
                });
            });
        });

        //TODO: Intermediary's reputation is not taken into account!
        quotes.sort((a, b) => {
            if(amountData.exactIn) {
                //Compare outputs
                return bigIntCompare(b.quote.getOutput().rawAmount, a.quote.getOutput().rawAmount);
            } else {
                //Compare inputs
                return bigIntCompare(a.quote.getOutput().rawAmount, b.quote.getOutput().rawAmount);
            }
        });

        this.logger.debug("createSwap(): Sorted quotes, best price to worst: ", quotes)

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
    createToBTCSwap<ChainIdentifier extends ChainIds<T>>(
        chainIdentifier: ChainIdentifier,
        signer: string,
        tokenAddress: string,
        address: string,
        amount: bigint,
        confirmationTarget?: number,
        confirmations?: number,
        exactIn?: boolean,
        additionalParams: Record<string, any> = this.options.defaultAdditionalParameters
    ): Promise<ToBTCSwap<T[ChainIdentifier]>> {
        if(confirmationTarget==null) confirmationTarget = 3;
        if(confirmations==null) confirmations = 2;
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn
        };
        return this.createSwap(
            chainIdentifier as ChainIdentifier,
            (candidates: Intermediary[], abortSignal, chain) => Promise.resolve(chain.wrappers[SwapType.TO_BTC].create(
                signer,
                address,
                amountData,
                candidates,
                {
                    confirmationTarget,
                    confirmations
                },
                additionalParams,
                abortSignal
            )),
            amountData,
            SwapType.TO_BTC
        );
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
    async createToBTCLNSwap<ChainIdentifier extends ChainIds<T>>(
        chainIdentifier: ChainIdentifier,
        signer: string,
        tokenAddress: string,
        paymentRequest: string,
        expirySeconds?: number,
        maxRoutingBaseFee?: bigint,
        maxRoutingPPM?: bigint,
        additionalParams: Record<string, any> = this.options.defaultAdditionalParameters
    ): Promise<ToBTCLNSwap<T[ChainIdentifier]>> {
        const parsedPR = bolt11Decode(paymentRequest);
        const amountData = {
            amount: (BigInt(parsedPR.millisatoshis) + 999n) / 1000n,
            token: tokenAddress,
            exactIn: false
        };
        expirySeconds ??= 5*24*3600;
        return this.createSwap(
            chainIdentifier as ChainIdentifier,
            (candidates: Intermediary[], abortSignal: AbortSignal, chain) => chain.wrappers[SwapType.TO_BTCLN].create(
                signer,
                paymentRequest,
                amountData,
                candidates,
                {
                    expirySeconds,
                    maxRoutingPPM,
                    maxRoutingBaseFee
                },
                additionalParams,
                abortSignal
            ),
            amountData,
            SwapType.TO_BTCLN
        );
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
    async createToBTCLNSwapViaLNURL<ChainIdentifier extends ChainIds<T>>(
        chainIdentifier: ChainIdentifier,
        signer: string,
        tokenAddress: string,
        lnurlPay: string | LNURLPay,
        amount: bigint,
        comment: string,
        expirySeconds?: number,
        maxRoutingBaseFee?: bigint,
        maxRoutingPPM?: bigint,
        exactIn?: boolean,
        additionalParams: Record<string, any>  = this.options.defaultAdditionalParameters
    ): Promise<ToBTCLNSwap<T[ChainIdentifier]>> {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn
        };
        expirySeconds ??= 5*24*3600;
        return this.createSwap(
            chainIdentifier as ChainIdentifier,
            (candidates: Intermediary[], abortSignal: AbortSignal, chain) => chain.wrappers[SwapType.TO_BTCLN].createViaLNURL(
                signer,
                typeof(lnurlPay)==="string" ? lnurlPay : lnurlPay.params,
                amountData,
                candidates,
                {
                    expirySeconds,
                    comment,
                    maxRoutingBaseFee,
                    maxRoutingPPM
                },
                additionalParams,
                abortSignal
            ),
            amountData,
            SwapType.TO_BTCLN
        );
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
    async createFromBTCSwap<ChainIdentifier extends ChainIds<T>>(
        chainIdentifier: ChainIdentifier,
        signer: string,
        tokenAddress: string,
        amount: bigint,
        exactOut?: boolean,
        additionalParams: Record<string, any> = this.options.defaultAdditionalParameters
    ): Promise<FromBTCSwap<T[ChainIdentifier]>> {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn: !exactOut
        };
        return this.createSwap(
            chainIdentifier as ChainIdentifier,
            (candidates: Intermediary[], abortSignal: AbortSignal, chain) => Promise.resolve(chain.wrappers[SwapType.FROM_BTC].create(
                signer,
                amountData,
                candidates,
                null,
                additionalParams,
                abortSignal
            )),
            amountData,
            SwapType.FROM_BTC
        );
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
    async createFromBTCLNSwap<ChainIdentifier extends ChainIds<T>>(
        chainIdentifier: ChainIdentifier,
        signer: string,
        tokenAddress: string,
        amount: bigint,
        exactOut?: boolean,
        descriptionHash?: Buffer,
        additionalParams: Record<string, any> = this.options.defaultAdditionalParameters
    ): Promise<FromBTCLNSwap<T[ChainIdentifier]>> {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn: !exactOut
        };
        return this.createSwap(
            chainIdentifier as ChainIdentifier,
            (candidates: Intermediary[], abortSignal: AbortSignal, chain) => Promise.resolve(chain.wrappers[SwapType.FROM_BTCLN].create(
                signer,
                amountData,
                candidates,
                {
                    descriptionHash
                },
                additionalParams,
                abortSignal
            )),
            amountData,
            SwapType.FROM_BTCLN
        );
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
    async createFromBTCLNSwapViaLNURL<ChainIdentifier extends ChainIds<T>>(
        chainIdentifier: ChainIdentifier,
        signer: string,
        tokenAddress: string,
        lnurl: string | LNURLWithdraw,
        amount: bigint,
        exactOut?: boolean,
        additionalParams: Record<string, any> = this.options.defaultAdditionalParameters
    ): Promise<FromBTCLNSwap<T[ChainIdentifier]>> {
        const amountData = {
            amount,
            token: tokenAddress,
            exactIn: !exactOut
        };
        return this.createSwap(
            chainIdentifier as ChainIdentifier,
            (candidates: Intermediary[], abortSignal: AbortSignal, chain) => chain.wrappers[SwapType.FROM_BTCLN].createViaLNURL(
                signer,
                typeof(lnurl)==="string" ? lnurl : lnurl.params,
                amountData,
                candidates,
                additionalParams,
                abortSignal
            ),
            amountData,
            SwapType.FROM_BTCLN
        );
    }

    create<C extends ChainIds<T>>(signer: string, srcToken: BtcToken<true>, dstToken: SCToken<C>, amount: bigint, exactIn: boolean, lnurlWithdraw?: string | LNURLWithdraw): Promise<FromBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: BtcToken<false>, dstToken: SCToken<C>, amount: bigint, exactIn: boolean): Promise<FromBTCSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<false>, amount: bigint, exactIn: boolean, address: string): Promise<ToBTCSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<true>, amount: bigint, exactIn: boolean, lnurlPay: string | LNURLPay): Promise<ToBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<true>, amount: bigint, exactIn: false, lightningInvoice: string): Promise<ToBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: Token<C>, dstToken: Token<C>, amount: bigint, exactIn: boolean, addressLnurlLightningInvoice?: string | LNURLWithdraw | LNURLPay): Promise<ISwap<T[C]>>;
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
    create<C extends ChainIds<T>>(signer: string, srcToken: Token<C>, dstToken: Token<C>, amount: bigint, exactIn: boolean, addressLnurlLightningInvoice?: string | LNURLWithdraw | LNURLPay): Promise<ISwap<T[C]>> {
        if(srcToken.chain==="BTC") {
            if(dstToken.chain==="SC") {
                if(srcToken.lightning) {
                    if(addressLnurlLightningInvoice!=null) {
                        if(typeof(addressLnurlLightningInvoice)!=="string" && !isLNURLWithdraw(addressLnurlLightningInvoice)) throw new Error("LNURL must be a string or LNURLWithdraw object!");
                        return this.createFromBTCLNSwapViaLNURL(dstToken.chainId, signer, dstToken.address, addressLnurlLightningInvoice, amount, !exactIn);
                    } else {
                        return this.createFromBTCLNSwap(dstToken.chainId, signer, dstToken.address, amount, !exactIn);
                    }
                } else {
                    return this.createFromBTCSwap(dstToken.chainId, signer, dstToken.address, amount, !exactIn);
                }
            }
        } else {
            if(dstToken.chain==="BTC") {
                if(dstToken.lightning) {
                    if(typeof(addressLnurlLightningInvoice)!=="string" && !isLNURLPay(addressLnurlLightningInvoice)) throw new Error("Destination LNURL link/lightning invoice must be a string or LNURLPay object!");
                    if(isLNURLPay(addressLnurlLightningInvoice) || this.isValidLNURL(addressLnurlLightningInvoice)) {
                        return this.createToBTCLNSwapViaLNURL(srcToken.chainId, signer, srcToken.address, addressLnurlLightningInvoice, amount, null, null, null, null, exactIn);
                    } else if(this.isLightningInvoice(addressLnurlLightningInvoice)) {
                        if(!this.isValidLightningInvoice(addressLnurlLightningInvoice))
                            throw new Error("Invalid lightning invoice specified, lightning invoice MUST contain pre-set amount!");
                        if(exactIn)
                            throw new Error("Only exact out swaps are possible with lightning invoices, use LNURL links for exact in lightning swaps!");
                        return this.createToBTCLNSwap(srcToken.chainId, signer, srcToken.address, addressLnurlLightningInvoice);
                    } else {
                        throw new Error("Supplied parameter is not LNURL link nor lightning invoice (bolt11)!");
                    }
                } else {
                    if(typeof(addressLnurlLightningInvoice)!=="string") throw new Error("Destination bitcoin address must be a string!");
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
    createTrustedLNForGasSwap<C extends ChainIds<T>>(chainId: C, signer: string, amount: bigint, trustedIntermediaryOrUrl?: Intermediary | string): Promise<LnForGasSwap<T[C]>> {
        if(this.chains[chainId]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainId);
        const useUrl = trustedIntermediaryOrUrl ?? this.defaultTrustedIntermediary ?? this.options.defaultTrustedIntermediaryUrl;
        if(useUrl==null) throw new Error("No trusted intermediary specified!");
        return this.chains[chainId as C].wrappers[SwapType.TRUSTED_FROM_BTCLN].create(signer, amount, useUrl);
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
    createTrustedOnchainForGasSwap<C extends ChainIds<T>>(
        chainId: C, signer: string,
        amount: bigint, refundAddress?: string,
        trustedIntermediaryOrUrl?: Intermediary | string
    ): Promise<OnchainForGasSwap<T[C]>> {
        if(this.chains[chainId]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainId);
        const useUrl = trustedIntermediaryOrUrl ?? this.defaultTrustedIntermediary ?? this.options.defaultTrustedIntermediaryUrl;
        if(useUrl==null) throw new Error("No trusted intermediary specified!");
        return this.chains[chainId as C].wrappers[SwapType.TRUSTED_FROM_BTC].create(signer, amount, useUrl, refundAddress);
    }

    /**
     * Returns all swaps
     */
    getAllSwaps(): Promise<ISwap[]>;

    /**
     * Returns all swaps for the specific chain, and optionally also for a specific signer's address
     */
    getAllSwaps<C extends ChainIds<T>>(chainId: C, signer?: string): Promise<ISwap<T[C]>[]>;

    async getAllSwaps<C extends ChainIds<T>>(chainId?: C, signer?: string): Promise<ISwap[]> {
        const queryParams: QueryParams[] = [];
        if(signer!=null) queryParams.push({key: "intiator", value: signer});

        if(chainId==null) {
            const res: ISwap[][] = await Promise.all(Object.keys(this.chains).map((chainId) => {
                const {unifiedSwapStorage, reviver} = this.chains[chainId];
                return unifiedSwapStorage.query([queryParams], reviver);
            }));
            return res.flat();
        } else {
            const {unifiedSwapStorage, reviver} = this.chains[chainId];
            return await unifiedSwapStorage.query([queryParams], reviver);
        }
    }

    /**
     * Returns all swaps where an action is required (either claim or refund)
     */
    getActionableSwaps(): Promise<ISwap[]>;

    /**
     * Returns swaps where an action is required (either claim or refund) for the specific chain, and optionally also for a specific signer's address
     */
    getActionableSwaps<C extends ChainIds<T>>(chainId: C, signer?: string): Promise<ISwap<T[C]>[]>;

    async getActionableSwaps<C extends ChainIds<T>>(chainId?: C, signer?: string): Promise<ISwap[]> {
        if(chainId==null) {
            const res: ISwap[][] = await Promise.all(Object.keys(this.chains).map((chainId) => {
                const {unifiedSwapStorage, reviver, wrappers} = this.chains[chainId];
                const queryParams: Array<QueryParams[]> = [];
                for(let key in wrappers) {
                    const wrapper = wrappers[key];
                    const swapTypeQueryParams: QueryParams[] = [{key: "type", value: wrapper.TYPE}];
                    if(signer!=null) swapTypeQueryParams.push({key: "intiator", value: signer});
                    swapTypeQueryParams.push({key: "state", value: wrapper.pendingSwapStates});
                    queryParams.push(swapTypeQueryParams);
                }
                return unifiedSwapStorage.query(queryParams, reviver);
            }));
            return res.flat().filter(swap => swap.isActionable());
        } else {
            const {unifiedSwapStorage, reviver, wrappers} = this.chains[chainId];
            const queryParams: Array<QueryParams[]> = [];
            for(let key in wrappers) {
                const wrapper = wrappers[key];
                const swapTypeQueryParams: QueryParams[] = [{key: "type", value: wrapper.TYPE}];
                if(signer!=null) swapTypeQueryParams.push({key: "intiator", value: signer});
                swapTypeQueryParams.push({key: "state", value: wrapper.pendingSwapStates});
                queryParams.push(swapTypeQueryParams);
            }
            return await unifiedSwapStorage.query(queryParams, reviver);
        }
    }

    /**
     * Returns swap with a specific id (identifier)
     */
    getSwapById(id: string): Promise<ISwap>;

    /**
     * Returns swap with a specific id (identifier) on a specific chain and optionally with a signer
     */
    getSwapById<C extends ChainIds<T>>(id: string, chainId: C, signer?: string): Promise<ISwap<T[C]>>;

    async getSwapById<C extends ChainIds<T>>(id: string, chainId?: C, signer?: string): Promise<ISwap> {
        const queryParams: QueryParams[] = [];
        if(signer!=null) queryParams.push({key: "intiator", value: signer});
        queryParams.push({key: "id", value: id});
        if(chainId==null) {
            const res: ISwap[][] = await Promise.all(Object.keys(this.chains).map((chainId) => {
                const {unifiedSwapStorage, reviver} = this.chains[chainId];
                return unifiedSwapStorage.query([queryParams], reviver);
            }));
            return res.flat()[0];
        } else {
            const {unifiedSwapStorage, reviver} = this.chains[chainId];
            return (await unifiedSwapStorage.query([queryParams], reviver))[0];
        }
    }

    getBalance<ChainIdentifier extends ChainIds<T>>(signer: string, token: SCToken<ChainIdentifier>): Promise<bigint>;
    getBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, token: string): Promise<bigint>;

    /**
     * Returns the token balance of the wallet
     */
    getBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifierOrSigner: ChainIdentifier, signerOrToken: string | SCToken<ChainIdentifier>, token?: string): Promise<bigint> {
        let chainIdentifier: ChainIdentifier;
        let signer: string;
        if(typeof(signerOrToken)==="string") {
            chainIdentifier = chainIdentifierOrSigner;
            signer = signerOrToken;
        } else {
            chainIdentifier = signerOrToken.chainId;
            token = signerOrToken.address;
            signer = chainIdentifierOrSigner;
        }
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);
        return this.chains[chainIdentifier].swapContract.getBalance(signer, token, false);
    }

    getSpendableBalance<ChainIdentifier extends ChainIds<T>>(signer: string, token: SCToken<ChainIdentifier>, feeMultiplier?: number): Promise<bigint>;
    getSpendableBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, token: string, feeMultiplier?: number): Promise<bigint>;

    /**
     * Returns the maximum spendable balance of the wallet, deducting the fee needed to initiate a swap for native balances
     */
    async getSpendableBalance<ChainIdentifier extends ChainIds<T>>(
        chainIdentifierOrSigner: ChainIdentifier,
        signerOrToken: string | SCToken<ChainIdentifier>,
        tokenOrFeeMultiplier?: string | number,
        feeMultiplier?: number
    ): Promise<bigint> {
        let chainIdentifier: ChainIdentifier | string;
        let signer: string;
        let token: string;
        if(typeof(signerOrToken)==="string") {
            chainIdentifier = chainIdentifierOrSigner;
            signer = signerOrToken;
            token = tokenOrFeeMultiplier as string;
        } else {
            chainIdentifier = signerOrToken.chainId;
            token = signerOrToken.address;
            signer = chainIdentifierOrSigner;
            feeMultiplier = tokenOrFeeMultiplier as number;
        }
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);

        const swapContract = this.chains[chainIdentifier].swapContract;

        if(swapContract.getNativeCurrencyAddress()!==token) return await this.getBalance(chainIdentifier, signer, token);

        let [balance, commitFee] = await Promise.all([
            this.getBalance(chainIdentifier, signer, token),
            swapContract.getCommitFee(
                //Use large amount, such that the fee for wrapping more tokens is always included!
                await swapContract.createSwapData(
                    ChainSwapType.HTLC, signer, null, token,
                    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
                    swapContract.getHashForHtlc(randomBytes(32)).toString("hex"),
                    BigIntBufferUtils.fromBuffer(randomBytes(8)), BigInt(Math.floor(Date.now()/1000)),
                    true, false, BigIntBufferUtils.fromBuffer(randomBytes(2)), BigIntBufferUtils.fromBuffer(randomBytes(2))
                ),
            )
        ]);

        if(feeMultiplier!=null) {
            commitFee = commitFee * (BigInt(Math.floor(feeMultiplier*1000000))) / 1000000n;
        }

        return bigIntMax(balance - commitFee, 0n);
    }

    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string): Promise<bigint> {
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);
        return this.chains[chainIdentifier].swapContract.getBalance(signer, this.getNativeTokenAddress(chainIdentifier), false);
    }

    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): string {
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);
        return this.chains[chainIdentifier].swapContract.getNativeCurrencyAddress();
    }

    /**
     * Returns the address of the native currency of the chain
     */
    getNativeToken<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): SCToken<ChainIdentifier> {
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);
        return this.tokens[chainIdentifier][this.chains[chainIdentifier].swapContract.getNativeCurrencyAddress()] as SCToken<ChainIdentifier>;
    }

    withChain<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): SwapperWithChain<T, ChainIdentifier> {
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);
        return new SwapperWithChain<T, ChainIdentifier>(this, chainIdentifier as ChainIdentifier);
    }

    randomSigner<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): T[ChainIdentifier]["Signer"] {
        if(this.chains[chainIdentifier]==null) throw new Error("Invalid chain identifier! Unknown chain: "+chainIdentifier);
        return this.chains[chainIdentifier].swapContract.randomSigner();
    }

    getChains(): ChainIds<T>[] {
        return Object.keys(this.chains);
    }

}
