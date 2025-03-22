/// <reference types="node" />
import { ISwapPrice } from "../../prices/abstract/ISwapPrice";
import { BitcoinNetwork, BtcRelay, ChainData, ChainType, RelaySynchronizer } from "@atomiqlabs/base";
import { ToBTCLNOptions, ToBTCLNWrapper } from "../tobtc/ln/ToBTCLNWrapper";
import { ToBTCOptions, ToBTCWrapper } from "../tobtc/onchain/ToBTCWrapper";
import { FromBTCLNOptions, FromBTCLNWrapper } from "../frombtc/ln/FromBTCLNWrapper";
import { FromBTCOptions, FromBTCWrapper } from "../frombtc/onchain/FromBTCWrapper";
import { IntermediaryDiscovery, MultichainSwapBounds, SwapBounds } from "../../intermediaries/IntermediaryDiscovery";
import { ISwap } from "../ISwap";
import { SwapType } from "../enums/SwapType";
import { FromBTCLNSwap } from "../frombtc/ln/FromBTCLNSwap";
import { FromBTCSwap } from "../frombtc/onchain/FromBTCSwap";
import { ToBTCLNSwap } from "../tobtc/ln/ToBTCLNSwap";
import { ToBTCSwap } from "../tobtc/onchain/ToBTCSwap";
import { MempoolApi } from "../../btc/mempool/MempoolApi";
import { MempoolBitcoinRpc } from "../../btc/mempool/MempoolBitcoinRpc";
import { LnForGasWrapper } from "../swapforgas/ln/LnForGasWrapper";
import { LnForGasSwap } from "../swapforgas/ln/LnForGasSwap";
import { EventEmitter } from "events";
import { MempoolBitcoinBlock } from "../../btc/mempool/MempoolBitcoinBlock";
import { Intermediary } from "../../intermediaries/Intermediary";
import { LNURLPay, LNURLWithdraw } from "../../utils/LNURL";
import { WrapperCtorTokens } from "../ISwapWrapper";
import { SwapperWithChain } from "./SwapperWithChain";
import { BtcToken, SCToken, Token } from "../../Tokens";
import { OnchainForGasSwap } from "../swapforgas/onchain/OnchainForGasSwap";
import { OnchainForGasWrapper } from "../swapforgas/onchain/OnchainForGasWrapper";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
import { IUnifiedStorage } from "../../storage/IUnifiedStorage";
import { UnifiedSwapStorage } from "../../storage/UnifiedSwapStorage";
import { UnifiedSwapEventListener } from "../../events/UnifiedSwapEventListener";
import { IToBTCSwap } from "../tobtc/IToBTCSwap";
export type SwapperOptions = {
    intermediaryUrl?: string | string[];
    registryUrl?: string;
    bitcoinNetwork?: BitcoinNetwork;
    getRequestTimeout?: number;
    postRequestTimeout?: number;
    defaultAdditionalParameters?: {
        [key: string]: any;
    };
    storagePrefix?: string;
    defaultTrustedIntermediaryUrl?: string;
    swapStorage?: <T extends ChainType>(chainId: T["ChainId"]) => IUnifiedStorage;
    noTimers?: boolean;
    noEvents?: boolean;
    noSwapCache?: boolean;
    dontCheckPastSwaps?: boolean;
    dontFetchLPs?: boolean;
};
export type MultiChain = {
    [chainIdentifier in string]: ChainType;
};
export type ChainSpecificData<T extends ChainType> = {
    wrappers: {
        [SwapType.TO_BTCLN]: ToBTCLNWrapper<T>;
        [SwapType.TO_BTC]: ToBTCWrapper<T>;
        [SwapType.FROM_BTCLN]: FromBTCLNWrapper<T>;
        [SwapType.FROM_BTC]: FromBTCWrapper<T>;
        [SwapType.TRUSTED_FROM_BTCLN]: LnForGasWrapper<T>;
        [SwapType.TRUSTED_FROM_BTC]: OnchainForGasWrapper<T>;
    };
    chainEvents: T["Events"];
    swapContract: T["Contract"];
    btcRelay: BtcRelay<any, T["TX"], MempoolBitcoinBlock, T["Signer"]>;
    synchronizer: RelaySynchronizer<any, T["TX"], MempoolBitcoinBlock>;
    unifiedChainEvents: UnifiedSwapEventListener<T>;
    unifiedSwapStorage: UnifiedSwapStorage<T>;
    reviver: (val: any) => ISwap<T>;
};
export type MultiChainData<T extends MultiChain> = {
    [chainIdentifier in keyof T]: ChainSpecificData<T[chainIdentifier]>;
};
export type CtorMultiChainData<T extends MultiChain> = {
    [chainIdentifier in keyof T]: ChainData<T[chainIdentifier]>;
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
export declare class Swapper<T extends MultiChain> extends EventEmitter implements SwapperBtcUtils {
    protected readonly logger: import("../../utils/Utils").LoggerType;
    protected readonly swapStateListener: (swap: ISwap) => void;
    private defaultTrustedIntermediary;
    readonly chains: MultiChainData<T>;
    readonly prices: ISwapPrice<T>;
    readonly intermediaryDiscovery: IntermediaryDiscovery;
    readonly options: SwapperOptions;
    readonly mempoolApi: MempoolApi;
    readonly bitcoinRpc: MempoolBitcoinRpc;
    readonly bitcoinNetwork: BTC_NETWORK;
    private readonly _bitcoinNetwork;
    readonly tokens: {
        [chainId: string]: {
            [tokenAddress: string]: SCToken;
        };
    };
    constructor(bitcoinRpc: MempoolBitcoinRpc, chainsData: CtorMultiChainData<T>, pricing: ISwapPrice<T>, tokens: WrapperCtorTokens<T>, options?: SwapperOptions);
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice
     *
     * @param lnpr
     */
    private isLightningInvoice;
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
    getSwapBounds<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): SwapBounds;
    getSwapBounds(): MultichainSwapBounds;
    /**
     * Returns maximum possible swap amount
     *
     * @param chainIdentifier
     * @param type      Type of the swap
     * @param token     Token of the swap
     */
    getMaximum<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, type: SwapType, token: string): bigint;
    /**
     * Returns minimum possible swap amount
     *
     * @param chainIdentifier
     * @param type      Type of swap
     * @param token     Token of the swap
     */
    getMinimum<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, type: SwapType, token: string): bigint;
    /**
     * Initializes the swap storage and loads existing swaps, needs to be called before any other action
     */
    init(): Promise<void>;
    /**
     * Stops listening for onchain events and closes this Swapper instance
     */
    stop(): Promise<void>;
    /**
     * Returns a set of supported tokens by all the intermediaries offering a specific swap service
     *
     * @param swapType Swap service type to check supported tokens for
     */
    getSupportedTokens(swapType: SwapType): SCToken[];
    /**
     * Returns the set of supported token addresses by all the intermediaries we know of offering a specific swapType service
     *
     * @param chainIdentifier
     * @param swapType Specific swap type for which to obtain supported tokens
     */
    getSupportedTokenAddresses<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, swapType: SwapType): Set<string>;
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
    private createSwap;
    /**
     * Creates To BTC swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to pay with
     * @param address               Recipient's bitcoin address
     * @param amount                Amount to send in satoshis (bitcoin's smallest denomination)
     * @param exactIn               Whether to use exact in instead of exact out
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param options
     */
    createToBTCSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, tokenAddress: string, address: string, amount: bigint, exactIn?: boolean, additionalParams?: Record<string, any>, options?: ToBTCOptions): Promise<ToBTCSwap<T[ChainIdentifier]>>;
    /**
     * Creates To BTCLN swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to pay with
     * @param paymentRequest        BOLT11 lightning network invoice to be paid (needs to have a fixed amount)
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param options
     */
    createToBTCLNSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, tokenAddress: string, paymentRequest: string, additionalParams?: Record<string, any>, options?: ToBTCLNOptions): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
    /**
     * Creates To BTCLN swap via LNURL-pay
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to pay with
     * @param lnurlPay              LNURL-pay link to use for the payment
     * @param amount                Amount to be paid in sats
     * @param exactIn               Whether to do an exact in swap instead of exact out
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param options
     */
    createToBTCLNSwapViaLNURL<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, tokenAddress: string, lnurlPay: string | LNURLPay, amount: bigint, exactIn?: boolean, additionalParams?: Record<string, any>, options?: ToBTCLNOptions): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
    /**
     * Creates From BTC swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress          Token address to receive
     * @param amount                Amount to receive, in satoshis (bitcoin's smallest denomination)
     * @param exactOut              Whether to use a exact out instead of exact in
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param options
     */
    createFromBTCSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, tokenAddress: string, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>, options?: FromBTCOptions): Promise<FromBTCSwap<T[ChainIdentifier]>>;
    /**
     * Creates From BTCLN swap
     *
     * @param chainIdentifier
     * @param signer
     * @param tokenAddress      Token address to receive
     * @param amount            Amount to receive, in satoshis (bitcoin's smallest denomination)
     * @param exactOut          Whether to use exact out instead of exact in
     * @param additionalParams  Additional parameters sent to the LP when creating the swap
     * @param options
     */
    createFromBTCLNSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, tokenAddress: string, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>, options?: FromBTCLNOptions): Promise<FromBTCLNSwap<T[ChainIdentifier]>>;
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
    createFromBTCLNSwapViaLNURL<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, tokenAddress: string, lnurl: string | LNURLWithdraw, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>): Promise<FromBTCLNSwap<T[ChainIdentifier]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: BtcToken<true>, dstToken: SCToken<C>, amount: bigint, exactIn: boolean, lnurlWithdraw?: string | LNURLWithdraw): Promise<FromBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: BtcToken<false>, dstToken: SCToken<C>, amount: bigint, exactIn: boolean): Promise<FromBTCSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<false>, amount: bigint, exactIn: boolean, address: string): Promise<ToBTCSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<true>, amount: bigint, exactIn: boolean, lnurlPay: string | LNURLPay): Promise<ToBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<true>, amount: bigint, exactIn: false, lightningInvoice: string): Promise<ToBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: Token<C>, dstToken: Token<C>, amount: bigint, exactIn: boolean, addressLnurlLightningInvoice?: string | LNURLWithdraw | LNURLPay): Promise<ISwap<T[C]>>;
    /**
     * Creates trusted LN for Gas swap
     *
     * @param chainId
     * @param signer
     * @param amount                    Amount of native token to receive, in base units
     * @param trustedIntermediaryOrUrl  URL or Intermediary object of the trusted intermediary to use, otherwise uses default
     * @throws {Error}                  If no trusted intermediary specified
     */
    createTrustedLNForGasSwap<C extends ChainIds<T>>(chainId: C, signer: string, amount: bigint, trustedIntermediaryOrUrl?: Intermediary | string): Promise<LnForGasSwap<T[C]>>;
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
    createTrustedOnchainForGasSwap<C extends ChainIds<T>>(chainId: C, signer: string, amount: bigint, refundAddress?: string, trustedIntermediaryOrUrl?: Intermediary | string): Promise<OnchainForGasSwap<T[C]>>;
    /**
     * Returns all swaps
     */
    getAllSwaps(): Promise<ISwap[]>;
    /**
     * Returns all swaps for the specific chain, and optionally also for a specific signer's address
     */
    getAllSwaps<C extends ChainIds<T>>(chainId: C, signer?: string): Promise<ISwap<T[C]>[]>;
    /**
     * Returns all swaps where an action is required (either claim or refund)
     */
    getActionableSwaps(): Promise<ISwap[]>;
    /**
     * Returns swaps where an action is required (either claim or refund) for the specific chain, and optionally also for a specific signer's address
     */
    getActionableSwaps<C extends ChainIds<T>>(chainId: C, signer?: string): Promise<ISwap<T[C]>[]>;
    /**
     * Returns all swaps that are refundable
     */
    getRefundableSwaps(): Promise<IToBTCSwap[]>;
    /**
     * Returns swaps which are refundable for the specific chain, and optionally also for a specific signer's address
     */
    getRefundableSwaps<C extends ChainIds<T>>(chainId: C, signer?: string): Promise<IToBTCSwap<T[C]>[]>;
    /**
     * Returns swap with a specific id (identifier)
     */
    getSwapById(id: string): Promise<ISwap>;
    /**
     * Returns swap with a specific id (identifier) on a specific chain and optionally with a signer
     */
    getSwapById<C extends ChainIds<T>>(id: string, chainId: C, signer?: string): Promise<ISwap<T[C]>>;
    /**
     * Synchronizes swaps from chain, this is usually ran when SDK is initialized, deletes expired quotes
     *
     * @param chainId
     * @param signer
     */
    _syncSwaps<C extends ChainIds<T>>(chainId?: C, signer?: string): Promise<void>;
    getBalance<ChainIdentifier extends ChainIds<T>>(signer: string, token: SCToken<ChainIdentifier>): Promise<bigint>;
    getBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, token: string): Promise<bigint>;
    getSpendableBalance<ChainIdentifier extends ChainIds<T>>(signer: string, token: SCToken<ChainIdentifier>, feeMultiplier?: number): Promise<bigint>;
    getSpendableBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string, token: string, feeMultiplier?: number): Promise<bigint>;
    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, signer: string): Promise<bigint>;
    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): string;
    /**
     * Returns the address of the native currency of the chain
     */
    getNativeToken<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): SCToken<ChainIdentifier>;
    withChain<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): SwapperWithChain<T, ChainIdentifier>;
    randomSigner<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): T[ChainIdentifier]["Signer"];
    getChains(): ChainIds<T>[];
}
