import {LNURLPay, LNURLWithdraw} from "../../utils/LNURL";
import {IntermediaryDiscovery, SwapBounds} from "../../intermediaries/IntermediaryDiscovery";
import {SwapType} from "../enums/SwapType";
import {LnForGasSwap} from "../trusted/ln/LnForGasSwap";
import {ISwap} from "../ISwap";
import {IToBTCSwap} from "../escrow_swaps/tobtc/IToBTCSwap";
import {ChainIds, MultiChain, SupportsSwapType, SwapperBtcUtils} from "./Swapper";
import {FromBTCLNSwap} from "../escrow_swaps/frombtc/ln/FromBTCLNSwap";
import {FromBTCSwap} from "../escrow_swaps/frombtc/onchain/FromBTCSwap";
import {ToBTCLNSwap} from "../escrow_swaps/tobtc/ln/ToBTCLNSwap";
import {ToBTCSwap} from "../escrow_swaps/tobtc/onchain/ToBTCSwap";
import {SwapperWithChain} from "./SwapperWithChain";
import {MempoolApi} from "../../btc/mempool/MempoolApi";
import {MempoolBitcoinRpc} from "../../btc/mempool/MempoolBitcoinRpc";
import {BTC_NETWORK} from "@scure/btc-signer/utils";
import {SwapPriceWithChain} from "../../prices/SwapPriceWithChain";
import {SwapWithSigner, wrapSwapWithSigner} from "./SwapWithSigner";
import {BtcToken, SCToken, Token} from "../../Tokens";
import {FromBTCLNOptions} from "../escrow_swaps/frombtc/ln/FromBTCLNWrapper";
import {FromBTCOptions} from "../escrow_swaps/frombtc/onchain/FromBTCWrapper";
import {ToBTCLNOptions} from "../escrow_swaps/tobtc/ln/ToBTCLNWrapper";
import {ToBTCOptions} from "../escrow_swaps/tobtc/onchain/ToBTCWrapper";

export class SwapperWithSigner<T extends MultiChain, ChainIdentifier extends ChainIds<T>> implements SwapperBtcUtils {

    swapper: SwapperWithChain<T, ChainIdentifier>;
    signer: T[ChainIdentifier]["Signer"];

    get prices(): SwapPriceWithChain<T, ChainIdentifier> {
        return this.swapper.prices;
    }
    get intermediaryDiscovery(): IntermediaryDiscovery {
        return this.swapper.intermediaryDiscovery;
    }
    get mempoolApi(): MempoolApi {
        return this.swapper.mempoolApi;
    }
    get bitcoinRpc(): MempoolBitcoinRpc {
        return this.swapper.bitcoinRpc;
    }
    get bitcoinNetwork(): BTC_NETWORK {
        return this.swapper.bitcoinNetwork;
    }

    constructor(swapper: SwapperWithChain<T, ChainIdentifier>, signer: T[ChainIdentifier]["Signer"]) {
        this.swapper = swapper;
        this.signer = signer;
    }

    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr: string): boolean {
        return this.swapper.isValidBitcoinAddress(addr);
    }

    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr: string): boolean {
        return this.swapper.isValidLightningInvoice(lnpr);
    }

    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl: string): boolean {
        return this.swapper.isValidLNURL(lnurl);
    }

    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl: string, shouldRetry?: boolean): Promise<LNURLPay | LNURLWithdraw | null> {
        return this.swapper.getLNURLTypeAndData(lnurl, shouldRetry);
    }

    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr: string): bigint {
        return this.swapper.getLightningInvoiceValue(lnpr);
    }

    /**
     * Returns swap bounds (minimums & maximums) for different swap types & tokens
     */
    getSwapBounds(): SwapBounds {
        return this.swapper.getSwapBounds();
    }

    /**
     * Returns maximum possible swap amount
     *
     * @param type      Type of the swap
     * @param token     Token of the swap
     */
    getMaximum(type: SwapType, token: string): bigint {
        return this.swapper.getMaximum(type, token);
    }

    /**
     * Returns minimum possible swap amount
     *
     * @param type      Type of swap
     * @param token     Token of the swap
     */
    getMinimum(type: SwapType, token: string): bigint {
        return this.swapper.getMinimum(type, token);
    }

    /**
     * Returns a set of supported tokens by all the intermediaries offering a specific swap service
     *
     * @param swapType Swap service type to check supported tokens for
     */
    getSupportedTokens(swapType: SwapType): SCToken[] {
        return this.swapper.getSupportedTokens(swapType);
    }

    /**
     * Returns the set of supported tokens by all the intermediaries we know of offering a specific swapType service
     *
     * @param swapType Specific swap type for which to obtain supported tokens
     */
    getSupportedTokenAddresses(swapType: SwapType): Set<string> {
        return this.swapper.getSupportedTokenAddresses(swapType);
    }

    createToBTCSwap(
        tokenAddress: string,
        address: string,
        amount: bigint,
        exactIn?: boolean,
        additionalParams?: Record<string, any>,
        options?: ToBTCOptions
    ): Promise<SwapWithSigner<ToBTCSwap<T[ChainIdentifier]>>> {
        return this.swapper.createToBTCSwap(this.signer.getAddress(), tokenAddress, address, amount, exactIn, additionalParams, options)
            .then(swap => wrapSwapWithSigner(swap, this.signer));
    }

    createToBTCLNSwap(
        tokenAddress: string,
        paymentRequest: string,
        additionalParams?: Record<string, any>,
        options?: ToBTCLNOptions
    ): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>> {
        return this.swapper.createToBTCLNSwap(this.signer.getAddress(), tokenAddress, paymentRequest, additionalParams, options)
            .then(swap => wrapSwapWithSigner(swap, this.signer));
    }

    createToBTCLNSwapViaLNURL(
        tokenAddress: string,
        lnurlPay: string | LNURLPay,
        amount: bigint,
        exactIn?: boolean,
        additionalParams?: Record<string, any>,
        options?: ToBTCLNOptions
    ): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>> {
        return this.swapper.createToBTCLNSwapViaLNURL(this.signer.getAddress(), tokenAddress, lnurlPay, amount, exactIn, additionalParams, options)
            .then(swap => wrapSwapWithSigner(swap, this.signer));
    }

    createFromBTCSwap(
        tokenAddress: string,
        amount: bigint,
        exactOut?: boolean,
        additionalParams?: Record<string, any>,
        options?: FromBTCOptions
    ): Promise<SwapWithSigner<FromBTCSwap<T[ChainIdentifier]>>> {
        return this.swapper.createFromBTCSwap(this.signer.getAddress(), tokenAddress, amount, exactOut, additionalParams, options)
            .then(swap => wrapSwapWithSigner(swap, this.signer));
    }

    createFromBTCLNSwap(
        tokenAddress: string,
        amount: bigint,
        exactOut?: boolean,
        additionalParams?: Record<string, any>,
        options?: FromBTCLNOptions
    ): Promise<SwapWithSigner<FromBTCLNSwap<T[ChainIdentifier]>>> {
        return this.swapper.createFromBTCLNSwap(this.signer.getAddress(), tokenAddress, amount, exactOut, additionalParams, options)
            .then(swap => wrapSwapWithSigner(swap, this.signer));
    }

    createFromBTCLNSwapViaLNURL(
        tokenAddress: string,
        lnurl: string | LNURLWithdraw,
        amount: bigint,
        exactOut?: boolean,
        additionalParams?: Record<string, any>
    ): Promise<SwapWithSigner<FromBTCLNSwap<T[ChainIdentifier]>>> {
        return this.swapper.createFromBTCLNSwapViaLNURL(this.signer.getAddress(), tokenAddress, lnurl, amount, exactOut, additionalParams)
            .then(swap => wrapSwapWithSigner(swap, this.signer));
    }

    createTrustedLNForGasSwap(amount: bigint, trustedIntermediaryUrl?: string): Promise<LnForGasSwap<T[ChainIdentifier]>> {
        return this.swapper.createTrustedLNForGasSwap(this.signer.getAddress(), amount, trustedIntermediaryUrl);
    }

    create(srcToken: BtcToken<true>, dstToken: SCToken<ChainIdentifier>, amount: bigint, exactIn: boolean, lnurlWithdraw?: string): Promise<SwapWithSigner<FromBTCLNSwap<T[ChainIdentifier]>>>;
    create(srcToken: BtcToken<false>, dstToken: SCToken<ChainIdentifier>, amount: bigint, exactIn: boolean): Promise<SwapWithSigner<FromBTCSwap<T[ChainIdentifier]>>>;
    create(srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<false>, amount: bigint, exactIn: boolean, address: string): Promise<SwapWithSigner<ToBTCSwap<T[ChainIdentifier]>>>;
    create(srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<true>, amount: bigint, exactIn: boolean, lnurlPay: string): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>>;
    create(srcToken: SCToken<ChainIdentifier>, dstToken: BtcToken<true>, amount: bigint, exactIn: false, lightningInvoice: string): Promise<SwapWithSigner<ToBTCLNSwap<T[ChainIdentifier]>>>;
    /**
     * Creates a swap from srcToken to dstToken, of a specific token amount, either specifying input amount (exactIn=true)
     *  or output amount (exactIn=false), NOTE: For regular -> BTC-LN (lightning) swaps the passed amount is ignored and
     *  invoice's pre-set amount is used instead.
     *
     * @param srcToken Source token of the swap, user pays this token
     * @param dstToken Destination token of the swap, user receives this token
     * @param amount Amount of the swap
     * @param exactIn Whether the amount specified is an input amount (exactIn=true) or an output amount (exactIn=false)
     * @param addressLnurlLightningInvoice Bitcoin on-chain address, lightning invoice, LNURL-pay to pay or
     *  LNURL-withdrawal to withdraw money from
     */
    create(srcToken: Token<ChainIdentifier>, dstToken: Token<ChainIdentifier>, amount: bigint, exactIn: boolean, addressLnurlLightningInvoice?: string): Promise<SwapWithSigner<ISwap<T[ChainIdentifier]>>> {
        return this.swapper.create(this.signer.getAddress(), srcToken as any, dstToken as any, amount, exactIn, addressLnurlLightningInvoice)
            .then(swap => wrapSwapWithSigner(swap, this.signer));
    }

    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getAllSwaps(): Promise<ISwap<T[ChainIdentifier]>[]> {
        return this.swapper.getAllSwaps(this.signer.getAddress());
    }

    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getActionableSwaps(): Promise<ISwap<T[ChainIdentifier]>[]> {
        return this.swapper.getActionableSwaps(this.signer.getAddress());
    }

    /**
     * Returns swaps that are refundable for the specific chain, optionally also for a specific signer's address
     */
    getRefundableSwaps(): Promise<IToBTCSwap<T[ChainIdentifier]>[]> {
        return this.swapper.getRefundableSwaps(this.signer.getAddress());
    }

    /**
     * Returns swap with a specific id (identifier) on a specific chain and optionally with a signer
     */
    getSwapById(id: string): Promise<ISwap<T[ChainIdentifier]>> {
        return this.swapper.getSwapById(id, this.signer.getAddress());
    }

    /**
     * Synchronizes swaps from chain, this is usually ran when SDK is initialized, deletes expired quotes
     */
    async _syncSwaps(): Promise<void> {
        return this.swapper._syncSwaps(this.signer.getAddress());
    }

    /**
     * Returns the token balance of the wallet
     */
    getBalance(token: string | SCToken<ChainIdentifier>): Promise<bigint> {
        return this.swapper.getBalance(this.signer.getAddress(), token);
    }

    /**
     * Returns the maximum spendable balance of the wallet, deducting the fee needed to initiate a swap for native balances
     */
    getSpendableBalance(token: string | SCToken<ChainIdentifier>, feeMultiplier: number): Promise<bigint> {
        return this.swapper.getSpendableBalance(this.signer.getAddress(), token, feeMultiplier);
    }

    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance(): Promise<bigint> {
        return this.swapper.getNativeBalance(this.signer.getAddress());
    }

    /**
     * Returns the address of the native token of the chain
     */
    getNativeToken(): SCToken<ChainIdentifier> {
        return this.swapper.getNativeToken();
    }

    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress(): string {
        return this.swapper.getNativeTokenAddress();
    }

    supportsSwapType<
        Type extends SwapType
    >(swapType: Type): SupportsSwapType<T[ChainIdentifier], Type> {
        return this.swapper.supportsSwapType(swapType);
    }

}
