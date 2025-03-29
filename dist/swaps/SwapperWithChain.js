"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapperWithChain = void 0;
const SwapperWithSigner_1 = require("./SwapperWithSigner");
const SwapPriceWithChain_1 = require("../prices/SwapPriceWithChain");
class SwapperWithChain {
    get intermediaryDiscovery() {
        return this.swapper.intermediaryDiscovery;
    }
    get mempoolApi() {
        return this.swapper.mempoolApi;
    }
    get bitcoinRpc() {
        return this.swapper.bitcoinRpc;
    }
    get bitcoinNetwork() {
        return this.swapper.bitcoinNetwork;
    }
    constructor(swapper, chainIdentifier) {
        this.swapper = swapper;
        this.chainIdentifier = chainIdentifier;
        this.prices = new SwapPriceWithChain_1.SwapPriceWithChain(swapper.prices, chainIdentifier);
    }
    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr) {
        return this.swapper.isValidBitcoinAddress(addr);
    }
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr) {
        return this.swapper.isValidLightningInvoice(lnpr);
    }
    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl) {
        return this.swapper.isValidLNURL(lnurl);
    }
    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl, shouldRetry) {
        return this.swapper.getLNURLTypeAndData(lnurl, shouldRetry);
    }
    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr) {
        return this.swapper.getLightningInvoiceValue(lnpr);
    }
    /**
     * Returns swap bounds (minimums & maximums) for different swap types & tokens
     */
    getSwapBounds() {
        return this.swapper.getSwapBounds(this.chainIdentifier);
    }
    /**
     * Returns maximum possible swap amount
     *
     * @param type      Type of the swap
     * @param token     Token of the swap
     */
    getMaximum(type, token) {
        return this.swapper.getMaximum(this.chainIdentifier, type, token);
    }
    /**
     * Returns minimum possible swap amount
     *
     * @param type      Type of swap
     * @param token     Token of the swap
     */
    getMinimum(type, token) {
        return this.swapper.getMinimum(this.chainIdentifier, type, token);
    }
    /**
     * Returns a set of supported tokens by all the intermediaries offering a specific swap service
     *
     * @param swapType Swap service type to check supported tokens for
     */
    getSupportedTokens(swapType) {
        const arr = [];
        this.getSupportedTokenAddresses(swapType).forEach(tokenAddress => {
            const token = this.swapper.tokens?.[this.chainIdentifier]?.[tokenAddress];
            if (token != null)
                arr.push(token);
        });
        return arr;
    }
    /**
     * Returns the set of supported tokens by all the intermediaries we know of offering a specific swapType service
     *
     * @param swapType Specific swap type for which to obtain supported tokens
     */
    getSupportedTokenAddresses(swapType) {
        return this.swapper.getSupportedTokenAddresses(this.chainIdentifier, swapType);
    }
    createToBTCSwap(signer, tokenAddress, address, amount, exactIn, additionalParams, options) {
        return this.swapper.createToBTCSwap(this.chainIdentifier, signer, tokenAddress, address, amount, exactIn, additionalParams, options);
    }
    createToBTCLNSwap(signer, tokenAddress, paymentRequest, additionalParams, options) {
        return this.swapper.createToBTCLNSwap(this.chainIdentifier, signer, tokenAddress, paymentRequest, additionalParams, options);
    }
    createToBTCLNSwapViaLNURL(signer, tokenAddress, lnurlPay, amount, exactIn, additionalParams, options) {
        return this.swapper.createToBTCLNSwapViaLNURL(this.chainIdentifier, signer, tokenAddress, lnurlPay, amount, exactIn, additionalParams, options);
    }
    createFromBTCSwap(signer, tokenAddress, amount, exactOut, additionalParams, options) {
        return this.swapper.createFromBTCSwap(this.chainIdentifier, signer, tokenAddress, amount, exactOut, additionalParams, options);
    }
    createFromBTCLNSwap(signer, tokenAddress, amount, exactOut, additionalParams, options) {
        return this.swapper.createFromBTCLNSwap(this.chainIdentifier, signer, tokenAddress, amount, exactOut, additionalParams, options);
    }
    createFromBTCLNSwapViaLNURL(signer, tokenAddress, lnurl, amount, exactOut, additionalParams) {
        return this.swapper.createFromBTCLNSwapViaLNURL(this.chainIdentifier, signer, tokenAddress, lnurl, amount, exactOut, additionalParams);
    }
    createTrustedLNForGasSwap(signer, amount, trustedIntermediaryUrl) {
        return this.swapper.createTrustedLNForGasSwap(this.chainIdentifier, signer, amount, trustedIntermediaryUrl);
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
        return this.swapper.create(signer, srcToken, dstToken, amount, exactIn, addressLnurlLightningInvoice);
    }
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getAllSwaps(signer) {
        return this.swapper.getAllSwaps(this.chainIdentifier, signer);
    }
    /**
     * Returns swaps that are in-progress and are claimable for the specific chain, optionally also for a specific signer's address
     */
    getActionableSwaps(signer) {
        return this.swapper.getActionableSwaps(this.chainIdentifier, signer);
    }
    /**
     * Returns swaps that are refundable for the specific chain, optionally also for a specific signer's address
     */
    getRefundableSwaps(signer) {
        return this.swapper.getRefundableSwaps(this.chainIdentifier, signer);
    }
    /**
     * Returns swap with a specific id (identifier) on a specific chain and optionally with a signer
     */
    getSwapById(id, signer) {
        return this.swapper.getSwapById(id, this.chainIdentifier, signer);
    }
    /**
     * Synchronizes swaps from chain, this is usually ran when SDK is initialized, deletes expired quotes
     */
    async _syncSwaps(signer) {
        return this.swapper._syncSwaps(this.chainIdentifier, signer);
    }
    /**
     * Returns the token balance of the wallet
     */
    getBalance(signer, token) {
        let tokenAddress;
        if (typeof (token) === 'string') {
            tokenAddress = token;
        }
        else {
            if (this.chainIdentifier !== token.chainId)
                throw new Error("Invalid token, chainId mismatch!");
            tokenAddress = token.address;
        }
        return this.swapper.getBalance(this.chainIdentifier, signer, tokenAddress);
    }
    /**
     * Returns the maximum spendable balance of the wallet, deducting the fee needed to initiate a swap for native balances
     */
    getSpendableBalance(signer, token, feeMultiplier) {
        let tokenAddress;
        if (typeof (token) === 'string') {
            tokenAddress = token;
        }
        else {
            if (this.chainIdentifier !== token.chainId)
                throw new Error("Invalid token, chainId mismatch!");
            tokenAddress = token.address;
        }
        return this.swapper.getSpendableBalance(this.chainIdentifier, signer, tokenAddress, feeMultiplier);
    }
    /**
     * Returns the native token balance of the wallet
     */
    getNativeBalance(signer) {
        return this.swapper.getNativeBalance(this.chainIdentifier, signer);
    }
    /**
     * Returns the address of the native token of the chain
     */
    getNativeToken() {
        return this.swapper.getNativeToken(this.chainIdentifier);
    }
    /**
     * Returns the address of the native token's address of the chain
     */
    getNativeTokenAddress() {
        return this.swapper.getNativeTokenAddress(this.chainIdentifier);
    }
    withSigner(signer) {
        return new SwapperWithSigner_1.SwapperWithSigner(this, signer);
    }
    randomSigner() {
        return this.swapper.randomSigner(this.chainIdentifier);
    }
}
exports.SwapperWithChain = SwapperWithChain;
