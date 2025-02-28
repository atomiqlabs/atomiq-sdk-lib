/// <reference types="node" />
/// <reference types="node" />
import { LNURLPay, LNURLWithdraw } from "../utils/LNURL";
import { IntermediaryDiscovery, SwapBounds } from "../intermediaries/IntermediaryDiscovery";
import { SwapType } from "./SwapType";
import { LnForGasSwap } from "./swapforgas/ln/LnForGasSwap";
import { ISwap } from "./ISwap";
import { IToBTCSwap } from "./tobtc/IToBTCSwap";
import { IFromBTCSwap } from "./frombtc/IFromBTCSwap";
import { ChainIds, MultiChain, SwapperBtcUtils } from "./Swapper";
import { FromBTCLNSwap } from "./frombtc/ln/FromBTCLNSwap";
import { Buffer } from "buffer";
import { FromBTCSwap } from "./frombtc/onchain/FromBTCSwap";
import { ToBTCLNSwap } from "./tobtc/ln/ToBTCLNSwap";
import { ToBTCSwap } from "./tobtc/onchain/ToBTCSwap";
import { SwapperWithChain } from "./SwapperWithChain";
import { MempoolApi } from "../btc/mempool/MempoolApi";
import { MempoolBitcoinRpc } from "../btc/mempool/MempoolBitcoinRpc";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
import { SwapPriceWithChain } from "../prices/SwapPriceWithChain";
import { SwapWithSigner } from "./SwapWithSigner";
import { BtcToken, SCToken } from "./Tokens";
export declare class SwapperWithSigner<T extends MultiChain, ChainIdentifier extends ChainIds<T>> implements SwapperBtcUtils {
    swapper: SwapperWithChain<T, ChainIdentifier>;
    signer: T[ChainIdentifier]["Signer"];
    get prices(): SwapPriceWithChain<T, ChainIdentifier>;
    get intermediaryDiscovery(): IntermediaryDiscovery;
    get mempoolApi(): MempoolApi;
    get bitcoinRpc(): MempoolBitcoinRpc;
    get bitcoinNetwork(): BTC_NETWORK;
    constructor(swapper: SwapperWithChain<T, ChainIdentifier>, signer: T[ChainIdentifier]["Signer"]);
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
    createToBTCSwap(tokenAddress: string, address: string, amount: bigint, confirmationTarget?: number, confirmations?: number, exactIn?: boolean, additionalParams?: Record<string, any>): Promise<SwapWithSigner<ToBTCSwap<T[ChainIdentifier]>>>;
    createToBTCLNSwap(tokenAddress: string, paymentRequest: string, expirySeconds?: number, maxRoutingBaseFee?: bigint, maxRoutingPPM?: bigint, additionalParams?: Record<string, any>): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>>;
    createToBTCLNSwapViaLNURL(tokenAddress: string, lnurlPay: string | LNURLPay, amount: bigint, comment: string, expirySeconds?: number, maxRoutingBaseFee?: bigint, maxRoutingPPM?: bigint, exactIn?: boolean, additionalParams?: Record<string, any>): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>>;
    createFromBTCSwap(tokenAddress: string, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>): Promise<SwapWithSigner<FromBTCSwap<T[ChainIdentifier]>>>;
    createFromBTCLNSwap(tokenAddress: string, amount: bigint, exactOut?: boolean, descriptionHash?: Buffer, additionalParams?: Record<string, any>): Promise<SwapWithSigner<FromBTCLNSwap<T[ChainIdentifier]>>>;
    createFromBTCLNSwapViaLNURL(tokenAddress: string, lnurl: string | LNURLWithdraw, amount: bigint, exactOut?: boolean, additionalParams?: Record<string, any>): Promise<SwapWithSigner<FromBTCLNSwap<T[ChainIdentifier]>>>;
    createTrustedLNForGasSwap(amount: bigint, trustedIntermediaryUrl?: string): Promise<LnForGasSwap<T[ChainIdentifier]>>;
    create(srcToken: BtcToken<true>, dstToken: SCToken<ChainIdentifier>, amount: bigint, exactIn: boolean, lnurlWithdraw?: string): Promise<SwapWithSigner<FromBTCLNSwap<T[ChainIdentifier]>>>;
    create(srcToken: BtcToken<false>, dstToken: SCToken<ChainIdentifier>, amount: bigint, exactIn: boolean): Promise<SwapWithSigner<FromBTCSwap<T[ChainIdentifier]>>>;
    create(srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<false>, amount: bigint, exactIn: boolean, address: string): Promise<SwapWithSigner<ToBTCSwap<T[ChainIdentifier]>>>;
    create(srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<true>, amount: bigint, exactIn: boolean, lnurlPay: string): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>>;
    create(srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<true>, amount: bigint, exactIn: false, lightningInvoice: string): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>>;
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getAllSwaps(): Promise<ISwap<T[ChainIdentifier]>[]>;
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getActionableSwaps(): Promise<ISwap<T[ChainIdentifier]>[]>;
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getRefundableSwaps(): Promise<IToBTCSwap<T[ChainIdentifier]>[]>;
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getClaimableSwaps(): Promise<IFromBTCSwap<T[ChainIdentifier]>[]>;
    /**
     * Returns the token balance of the wallet
     */
    getBalance(token: string | SCToken<ChainIdentifier>): Promise<bigint>;
    /**
     * Returns the maximum spendable balance of the wallet, deducting the fee needed to initiate a swap for native balances
     */
    getSpendableBalance(token: string | SCToken<ChainIdentifier>, feeMultiplier: number): Promise<bigint>;
    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance(): Promise<bigint>;
    /**
     * Returns the address of the native token of the chain
     */
    getNativeToken(): SCToken<ChainIdentifier>;
    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress(): string;
}
