import { LNURLPay, LNURLWithdraw } from "../utils/LNURL";
import { IntermediaryDiscovery, SwapBounds } from "../intermediaries/IntermediaryDiscovery";
import { SwapType } from "./SwapType";
import { LnForGasSwap } from "./swapforgas/ln/LnForGasSwap";
import { ISwap } from "./ISwap";
import { IToBTCSwap } from "./tobtc/IToBTCSwap";
import { ChainIds, MultiChain, Swapper, SwapperBtcUtils } from "./Swapper";
import { FromBTCLNSwap } from "./frombtc/ln/FromBTCLNSwap";
import { FromBTCSwap } from "./frombtc/onchain/FromBTCSwap";
import { ToBTCLNSwap } from "./tobtc/ln/ToBTCLNSwap";
import { ToBTCSwap } from "./tobtc/onchain/ToBTCSwap";
import { SwapperWithSigner } from "./SwapperWithSigner";
import { SwapPriceWithChain } from "../prices/SwapPriceWithChain";
import { MempoolApi } from "../btc/mempool/MempoolApi";
import { MempoolBitcoinRpc } from "../btc/mempool/MempoolBitcoinRpc";
import { BtcToken, SCToken } from "./Tokens";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
import { ToBTCOptions } from "./tobtc/onchain/ToBTCWrapper";
import { ToBTCLNOptions } from "./tobtc/ln/ToBTCLNWrapper";
import { FromBTCOptions } from "./frombtc/onchain/FromBTCWrapper";
import { FromBTCLNOptions } from "./frombtc/ln/FromBTCLNWrapper";
export declare class SwapperWithChain<T extends MultiChain, ChainIdentifier extends ChainIds<T>> implements SwapperBtcUtils {
    readonly chainIdentifier: ChainIdentifier;
    readonly swapper: Swapper<T>;
    readonly prices: SwapPriceWithChain<T, ChainIdentifier>;
    get intermediaryDiscovery(): IntermediaryDiscovery;
    get mempoolApi(): MempoolApi;
    get bitcoinRpc(): MempoolBitcoinRpc;
    get bitcoinNetwork(): BTC_NETWORK;
    constructor(swapper: Swapper<T>, chainIdentifier: ChainIdentifier);
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
    /**
     * Returns swap bounds (minimums & maximums) for different swap types & tokens
     */
    getSwapBounds(): SwapBounds;
    /**
     * Returns maximum possible swap amount
     *
     * @param type      Type of the swap
     * @param token     Token of the swap
     */
    getMaximum(type: SwapType, token: string): bigint;
    /**
     * Returns minimum possible swap amount
     *
     * @param type      Type of swap
     * @param token     Token of the swap
     */
    getMinimum(type: SwapType, token: string): bigint;
    /**
     * Returns a set of supported tokens by all the intermediaries offering a specific swap service
     *
     * @param swapType Swap service type to check supported tokens for
     */
    getSupportedTokens(swapType: SwapType): SCToken[];
    /**
     * Returns the set of supported tokens by all the intermediaries we know of offering a specific swapType service
     *
     * @param swapType Specific swap type for which to obtain supported tokens
     */
    getSupportedTokenAddresses(swapType: SwapType): Set<string>;
    createToBTCSwap(signer: string, tokenAddress: string, address: string, amount: bigint, exactIn?: boolean, additionalParams?: Record<string, any>, options?: ToBTCOptions): Promise<ToBTCSwap<T[ChainIdentifier]>>;
    createToBTCLNSwap(signer: string, tokenAddress: string, paymentRequest: string, additionalParams?: Record<string, any>, options?: ToBTCLNOptions): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
    createToBTCLNSwapViaLNURL(signer: string, tokenAddress: string, lnurlPay: string | LNURLPay, amount: bigint, exactIn?: boolean, additionalParams?: Record<string, any>, options?: ToBTCLNOptions): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
    createFromBTCSwap(signer: string, tokenAddress: string, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>, options?: FromBTCOptions): Promise<FromBTCSwap<T[ChainIdentifier]>>;
    createFromBTCLNSwap(signer: string, tokenAddress: string, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>, options?: FromBTCLNOptions): Promise<FromBTCLNSwap<T[ChainIdentifier]>>;
    createFromBTCLNSwapViaLNURL(signer: string, tokenAddress: string, lnurl: string | LNURLWithdraw, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>): Promise<FromBTCLNSwap<T[ChainIdentifier]>>;
    createTrustedLNForGasSwap(signer: string, amount: bigint, trustedIntermediaryUrl?: string): Promise<LnForGasSwap<T[ChainIdentifier]>>;
    create(signer: string, srcToken: BtcToken<true>, dstToken: SCToken<ChainIdentifier>, amount: bigint, exactIn: boolean, lnurlWithdraw?: string): Promise<FromBTCLNSwap<T[ChainIdentifier]>>;
    create(signer: string, srcToken: BtcToken<false>, dstToken: SCToken<ChainIdentifier>, amount: bigint, exactIn: boolean): Promise<FromBTCSwap<T[ChainIdentifier]>>;
    create(signer: string, srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<false>, amount: bigint, exactIn: boolean, address: string): Promise<ToBTCSwap<T[ChainIdentifier]>>;
    create(signer: string, srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<true>, amount: bigint, exactIn: boolean, lnurlPay: string): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
    create(signer: string, srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<true>, amount: bigint, exactIn: false, lightningInvoice: string): Promise<ToBTCLNSwap<T[ChainIdentifier]>>;
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getAllSwaps(signer?: string): Promise<ISwap<T[ChainIdentifier]>[]>;
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getActionableSwaps(signer?: string): Promise<ISwap<T[ChainIdentifier]>[]>;
    /**
     * Returns swaps that are refundable for the specific chain, optionally also for a specific signer's address
     */
    getRefundableSwaps(signer?: string): Promise<IToBTCSwap<T[ChainIdentifier]>[]>;
    /**
     * Returns swap with a specific id (identifier) on a specific chain and optionally with a signer
     */
    getSwapById(id: string, signer?: string): Promise<ISwap<T[ChainIdentifier]>>;
    /**
     * Synchronizes swaps from chain, this is usually ran when SDK is initialized, deletes expired quotes
     */
    _syncSwaps(signer?: string): Promise<void>;
    /**
     * Returns the token balance of the wallet
     */
    getBalance(signer: string, token: string | SCToken<ChainIdentifier>): Promise<bigint>;
    /**
     * Returns the maximum spendable balance of the wallet, deducting the fee needed to initiate a swap for native balances
     */
    getSpendableBalance(signer: string, token: string | SCToken<ChainIdentifier>, feeMultiplier?: number): Promise<bigint>;
    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance(signer: string): Promise<bigint>;
    /**
     * Returns the address of the native token of the chain
     */
    getNativeToken(): SCToken<ChainIdentifier>;
    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress(): string;
    withSigner(signer: T[ChainIdentifier]["Signer"]): SwapperWithSigner<T, ChainIdentifier>;
    randomSigner(): T[ChainIdentifier]["Signer"];
}
