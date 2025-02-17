/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { BitcoinNetwork } from "../btc/BitcoinNetwork";
import { ISwapPrice } from "../prices/abstract/ISwapPrice";
import { BtcRelay, ChainData, ChainType, IStorageManager, RelaySynchronizer } from "@atomiqlabs/base";
import { ToBTCLNWrapper } from "./tobtc/ln/ToBTCLNWrapper";
import { ToBTCWrapper } from "./tobtc/onchain/ToBTCWrapper";
import { FromBTCLNWrapper } from "./frombtc/ln/FromBTCLNWrapper";
import { FromBTCWrapper } from "./frombtc/onchain/FromBTCWrapper";
import { IntermediaryDiscovery, MultichainSwapBounds, SwapBounds } from "../intermediaries/IntermediaryDiscovery";
import { Network } from "bitcoinjs-lib";
import * as BN from "bn.js";
import { IFromBTCSwap } from "./frombtc/IFromBTCSwap";
import { IToBTCSwap } from "./tobtc/IToBTCSwap";
import { ISwap } from "./ISwap";
import { SwapType } from "./SwapType";
import { FromBTCLNSwap } from "./frombtc/ln/FromBTCLNSwap";
import { FromBTCSwap } from "./frombtc/onchain/FromBTCSwap";
import { ToBTCLNSwap } from "./tobtc/ln/ToBTCLNSwap";
import { ToBTCSwap } from "./tobtc/onchain/ToBTCSwap";
import { MempoolApi } from "../btc/mempool/MempoolApi";
import { MempoolBitcoinRpc } from "../btc/mempool/MempoolBitcoinRpc";
import { LnForGasWrapper } from "./swapforgas/ln/LnForGasWrapper";
import { LnForGasSwap } from "./swapforgas/ln/LnForGasSwap";
import { EventEmitter } from "events";
import { Buffer } from "buffer";
import { MempoolBitcoinBlock } from "../btc/mempool/MempoolBitcoinBlock";
import { Intermediary } from "../intermediaries/Intermediary";
import { LNURLPay, LNURLWithdraw } from "../utils/LNURL";
import { WrapperCtorTokens } from "./ISwapWrapper";
import { SwapperWithChain } from "./SwapperWithChain";
import { BtcToken, SCToken, Token } from "./Tokens";
import { OnchainForGasSwap } from "./swapforgas/onchain/OnchainForGasSwap";
import { OnchainForGasWrapper } from "./swapforgas/onchain/OnchainForGasWrapper";
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
    storageCtor?: (name: string) => IStorageManager<any>;
};
export type MultiChain = {
    [chainIdentifier in string]: ChainType;
};
export type ChainSpecificData<T extends ChainType> = {
    tobtcln: ToBTCLNWrapper<T>;
    tobtc: ToBTCWrapper<T>;
    frombtcln: FromBTCLNWrapper<T>;
    frombtc: FromBTCWrapper<T>;
    lnforgas: LnForGasWrapper<T>;
    onchainforgas: OnchainForGasWrapper<T>;
    chainEvents: T["Events"];
    swapContract: T["Contract"];
    btcRelay: BtcRelay<any, T["TX"], MempoolBitcoinBlock, T["Signer"]>;
    synchronizer: RelaySynchronizer<any, T["TX"], MempoolBitcoinBlock>;
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
    getLightningInvoiceValue(lnpr: string): BN;
}
export declare class Swapper<T extends MultiChain> extends EventEmitter implements SwapperBtcUtils {
    protected readonly logger: import("../utils/Utils").LoggerType;
    protected readonly swapStateListener: (swap: ISwap) => void;
    private defaultTrustedIntermediary;
    readonly chains: MultiChainData<T>;
    readonly prices: ISwapPrice<T>;
    readonly intermediaryDiscovery: IntermediaryDiscovery;
    readonly options: SwapperOptions;
    readonly mempoolApi: MempoolApi;
    readonly bitcoinRpc: MempoolBitcoinRpc;
    readonly bitcoinNetwork: Network;
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
    getLightningInvoiceValue(lnpr: string): BN;
    getSwapBounds<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string): SwapBounds;
    getSwapBounds(): MultichainSwapBounds;
    /**
     * Returns maximum possible swap amount
     *
     * @param chainIdentifier
     * @param type      Type of the swap
     * @param token     Token of the swap
     */
    getMaximum<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, type: SwapType, token: string): BN;
    /**
     * Returns minimum possible swap amount
     *
     * @param chainIdentifier
     * @param type      Type of swap
     * @param token     Token of the swap
     */
    getMinimum<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, type: SwapType, token: string): BN;
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
    getSupportedTokenAddresses<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, swapType: SwapType): Set<string>;
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
     * @param confirmationTarget    How soon should the transaction be confirmed (determines the fee)
     * @param confirmations         How many confirmations must the intermediary wait to claim the funds
     * @param exactIn               Whether to use exact in instead of exact out
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     */
    createToBTCSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, tokenAddress: string, address: string, amount: BN, confirmationTarget?: number, confirmations?: number, exactIn?: boolean, additionalParams?: Record<string, any>): Promise<ToBTCSwap<T[ChainIdentifier]>>;
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
    createToBTCLNSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, tokenAddress: string, paymentRequest: string, expirySeconds?: number, maxRoutingBaseFee?: BN, maxRoutingPPM?: BN, additionalParams?: Record<string, any>): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
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
    createToBTCLNSwapViaLNURL<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, tokenAddress: string, lnurlPay: string | LNURLPay, amount: BN, comment: string, expirySeconds?: number, maxRoutingBaseFee?: BN, maxRoutingPPM?: BN, exactIn?: boolean, additionalParams?: Record<string, any>): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
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
    createFromBTCSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, tokenAddress: string, amount: BN, exactOut?: boolean, additionalParams?: Record<string, any>): Promise<FromBTCSwap<T[ChainIdentifier]>>;
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
    createFromBTCLNSwap<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, tokenAddress: string, amount: BN, exactOut?: boolean, descriptionHash?: Buffer, additionalParams?: Record<string, any>): Promise<FromBTCLNSwap<T[ChainIdentifier]>>;
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
    createFromBTCLNSwapViaLNURL<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, tokenAddress: string, lnurl: string | LNURLWithdraw, amount: BN, exactOut?: boolean, additionalParams?: Record<string, any>): Promise<FromBTCLNSwap<T[ChainIdentifier]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: BtcToken<true>, dstToken: SCToken<C>, amount: BN, exactIn: boolean, lnurlWithdraw?: string | LNURLWithdraw): Promise<FromBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: BtcToken<false>, dstToken: SCToken<C>, amount: BN, exactIn: boolean): Promise<FromBTCSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<false>, amount: BN, exactIn: boolean, address: string): Promise<ToBTCSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<true>, amount: BN, exactIn: boolean, lnurlPay: string | LNURLPay): Promise<ToBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: SCToken<C>, dstToken: BtcToken<true>, amount: BN, exactIn: false, lightningInvoice: string): Promise<ToBTCLNSwap<T[C]>>;
    create<C extends ChainIds<T>>(signer: string, srcToken: Token<C>, dstToken: Token<C>, amount: BN, exactIn: boolean, addressLnurlLightningInvoice?: string | LNURLWithdraw | LNURLPay): Promise<ISwap<T[C]>>;
    /**
     * Creates trusted LN for Gas swap
     *
     * @param chainId
     * @param signer
     * @param amount                    Amount of native token to receive, in base units
     * @param trustedIntermediaryOrUrl  URL or Intermediary object of the trusted intermediary to use, otherwise uses default
     * @throws {Error}                  If no trusted intermediary specified
     */
    createTrustedLNForGasSwap<C extends ChainIds<T>>(chainId: C | string, signer: string, amount: BN, trustedIntermediaryOrUrl?: Intermediary | string): Promise<LnForGasSwap<T[C]>>;
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
    createTrustedOnchainForGasSwap<C extends ChainIds<T>>(chainId: C | string, signer: string, amount: BN, refundAddress?: string, trustedIntermediaryOrUrl?: Intermediary | string): Promise<OnchainForGasSwap<T[C]>>;
    /**
     * Returns all swaps
     */
    getAllSwaps(): Promise<ISwap[]>;
    /**
     * Returns all swaps for the specific chain, and optionally also for a specific signer's address
     */
    getAllSwaps<C extends ChainIds<T>>(chainId: C | string, signer?: string): Promise<ISwap<T[C]>[]>;
    /**
     * Returns all swaps where an action is required (either claim or refund)
     */
    getActionableSwaps(): Promise<ISwap[]>;
    /**
     * Returns swaps where an action is required (either claim or refund) for the specific chain, and optionally also for a specific signer's address
     */
    getActionableSwaps<C extends ChainIds<T>>(chainId: C | string, signer?: string): Promise<ISwap<T[C]>[]>;
    /**
     * Returns all swaps that are refundable
     */
    getRefundableSwaps(): Promise<IToBTCSwap[]>;
    /**
     * Returns swaps that are refundable for the specific chain, and optionally also for a specific signer's address
     */
    getRefundableSwaps<C extends ChainIds<T>>(chainId: C | string, signer?: string): Promise<IToBTCSwap<T[C]>[]>;
    /**
     * Returns all swaps that are in-progress and are claimable
     */
    getClaimableSwaps(): Promise<IFromBTCSwap[]>;
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getClaimableSwaps<C extends ChainIds<T>>(chainId: C | string, signer?: string): Promise<IFromBTCSwap<T[C]>[]>;
    getBalance<ChainIdentifier extends ChainIds<T>>(signer: string, token: SCToken<ChainIdentifier | string>): Promise<BN>;
    getBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, token: string): Promise<BN>;
    getSpendableBalance<ChainIdentifier extends ChainIds<T>>(signer: string, token: SCToken<ChainIdentifier | string>, feeMultiplier?: number): Promise<BN>;
    getSpendableBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string, token: string, feeMultiplier?: number): Promise<BN>;
    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string, signer: string): Promise<BN>;
    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string): string;
    /**
     * Returns the address of the native currency of the chain
     */
    getNativeToken<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string): SCToken<ChainIdentifier>;
    withChain<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string): SwapperWithChain<T, ChainIdentifier>;
    randomSigner<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier | string): T[ChainIdentifier]["Signer"];
    getChains(): ChainIds<T>[];
}
