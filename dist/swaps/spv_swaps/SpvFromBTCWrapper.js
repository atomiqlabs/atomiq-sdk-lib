"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpvFromBTCWrapper = void 0;
const ISwapWrapper_1 = require("../ISwapWrapper");
const base_1 = require("@atomiqlabs/base");
const SpvFromBTCSwap_1 = require("./SpvFromBTCSwap");
const utils_1 = require("@scure/btc-signer/utils");
const SwapType_1 = require("../enums/SwapType");
const Utils_1 = require("../../utils/Utils");
const IntermediaryAPI_1 = require("../../intermediaries/IntermediaryAPI");
const RequestError_1 = require("../../errors/RequestError");
const IntermediaryError_1 = require("../../errors/IntermediaryError");
class SpvFromBTCWrapper extends ISwapWrapper_1.ISwapWrapper {
    /**
     * @param chainIdentifier
     * @param unifiedStorage Storage interface for the current environment
     * @param unifiedChainEvents On-chain event listener
     * @param chain
     * @param contract Underlying contract handling the swaps
     * @param prices Pricing to use
     * @param tokens
     * @param spvWithdrawalDataDeserializer Deserializer for SpvVaultWithdrawalData
     * @param btcRelay
     * @param synchronizer Btc relay synchronizer
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, contract, prices, tokens, spvWithdrawalDataDeserializer, btcRelay, synchronizer, btcRpc, options, events) {
        if (options == null)
            options = {};
        options.bitcoinNetwork ??= utils_1.TEST_NETWORK;
        options.maxConfirmations ??= 6;
        options.bitcoinBlocktime ??= 10 * 60;
        options.maxTransactionsDelta ??= 10;
        options.maxRawAmountAdjustmentDifferencePPM ??= 100;
        super(chainIdentifier, unifiedStorage, unifiedChainEvents, chain, prices, tokens, options, events);
        this.TYPE = SwapType_1.SwapType.SPV_VAULT_FROM_BTC;
        this.swapDeserializer = SpvFromBTCSwap_1.SpvFromBTCSwap;
        this.pendingSwapStates = [
            SpvFromBTCSwap_1.SpvFromBTCSwapState.CREATED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.SIGNED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.POSTED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.BROADCASTED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.DECLINED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.BTC_TX_CONFIRMED
        ];
        this.tickSwapState = [
            SpvFromBTCSwap_1.SpvFromBTCSwapState.CREATED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.SIGNED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.POSTED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.BROADCASTED,
            SpvFromBTCSwap_1.SpvFromBTCSwapState.DECLINED
        ];
        this.spvWithdrawalDataDeserializer = spvWithdrawalDataDeserializer;
        this.contract = contract;
        this.btcRelay = btcRelay;
        this.synchronizer = synchronizer;
        this.btcRpc = btcRpc;
    }
    processEventFront(event, swap) {
        if (swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.SIGNED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.POSTED ||
            swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.BROADCASTED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.DECLINED ||
            swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.BTC_TX_CONFIRMED) {
            swap.state = SpvFromBTCSwap_1.SpvFromBTCSwapState.FRONTED;
            return true;
        }
        return false;
    }
    processEventClaim(event, swap) {
        if (swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.SIGNED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.POSTED ||
            swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.BROADCASTED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.DECLINED ||
            swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.BTC_TX_CONFIRMED) {
            swap.state = SpvFromBTCSwap_1.SpvFromBTCSwapState.CLAIMED;
            return true;
        }
        return false;
    }
    processEventClose(event, swap) {
        if (swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.SIGNED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.POSTED ||
            swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.BROADCASTED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.DECLINED ||
            swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED || swap.state === SpvFromBTCSwap_1.SpvFromBTCSwapState.BTC_TX_CONFIRMED) {
            swap.state = SpvFromBTCSwap_1.SpvFromBTCSwapState.CLOSED;
            return true;
        }
        return false;
    }
    async processEvent(event, swap) {
        if (swap == null)
            return;
        let swapChanged = false;
        if (event instanceof base_1.SpvVaultFrontEvent) {
            swapChanged = this.processEventFront(event, swap);
            if (event.meta?.txId != null && swap.frontTxId !== event.meta.txId) {
                swap.frontTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }
        if (event instanceof base_1.SpvVaultClaimEvent) {
            swapChanged = this.processEventClaim(event, swap);
            if (event.meta?.txId != null && swap.claimTxId !== event.meta.txId) {
                swap.claimTxId = event.meta.txId;
                swapChanged ||= true;
            }
        }
        if (event instanceof base_1.SpvVaultCloseEvent) {
            swapChanged = this.processEventClose(event, swap);
        }
        this.logger.info("processEvents(): " + event.constructor.name + " processed for " + swap.getId() + " swap: ", swap);
        if (swapChanged) {
            await swap._saveAndEmit();
        }
        return true;
    }
    /**
     * Verifies response returned from intermediary
     *
     * @param resp Response as returned by the intermediary
     * @param amountData
     * @param lp Intermediary
     * @param options Options as passed to the swap creation function
     * @private
     * @throws {IntermediaryError} in case the response is invalid
     */
    async verifyReturnedData(resp, amountData, lp, options) {
        //Vault related
        let vaultScript;
        let vaultAddressType;
        let btcAddressScript;
        //Ensure valid btc addresses returned
        try {
            vaultScript = (0, Utils_1.toOutputScript)(this.options.bitcoinNetwork, resp.vaultBtcAddress);
            vaultAddressType = (0, Utils_1.toCoinselectAddressType)(vaultScript);
            btcAddressScript = (0, Utils_1.toOutputScript)(this.options.bitcoinNetwork, resp.btcAddress);
        }
        catch (e) {
            throw new IntermediaryError_1.IntermediaryError("Invalid btc address data returned!");
        }
        const decodedUtxo = resp.btcUtxo.split(":");
        if (resp.address !== lp.getAddress(this.chainIdentifier) || //Ensure the LP is indeed the vault owner
            resp.vaultId < 0n || //Ensure vaultId is not negative
            vaultScript == null || //Make sure vault script is parsable and of known type
            btcAddressScript == null || //Make sure btc address script is parsable and of known type
            vaultAddressType === "p2pkh" || vaultAddressType === "p2sh-p2wpkh" || //Constrain the vault script type to witness types
            decodedUtxo.length !== 2 || decodedUtxo[0].length !== 64 || isNaN(parseInt(decodedUtxo[1])) || //Check valid UTXO
            resp.btcFeeRate < 1 || resp.btcFeeRate > 10000 //Sanity check on the returned BTC fee rate
        )
            throw new IntermediaryError_1.IntermediaryError("Invalid vault data returned!");
        //Amounts sanity
        if (resp.btcAmountSwap + resp.btcAmountGas !== resp.btcAmount)
            throw new Error("Btc amount mismatch");
        if (resp.swapFeeBtc + resp.gasSwapFeeBtc !== resp.totalFeeBtc)
            throw new Error("Btc fee mismatch");
        //TODO: For now ensure fees are at 0
        if (resp.callerFeeShare !== 0n ||
            resp.frontingFeeShare !== 0n ||
            resp.executionFeeShare !== 0n)
            throw new IntermediaryError_1.IntermediaryError("Invalid caller/fronting/execution fee returned");
        //Check expiry
        if (resp.expiry < Math.floor(Date.now() / 1000))
            throw new IntermediaryError_1.IntermediaryError("Quote already expired");
        //Fetch vault data
        let vault;
        try {
            vault = await this.contract.getVaultData(resp.address, resp.vaultId);
        }
        catch (e) {
            this.logger.error("Error getting spv vault (owner: " + resp.address + " vaultId: " + resp.vaultId.toString(10) + "): ", e);
            throw new IntermediaryError_1.IntermediaryError("Spv swap vault not found!");
        }
        //Make sure vault is opened
        if (!vault.isOpened())
            throw new IntermediaryError_1.IntermediaryError("Returned spv swap vault is not opened!");
        //Make sure the vault doesn't require insane amount of confirmations
        if (vault.getConfirmations() > this.options.maxConfirmations)
            throw new IntermediaryError_1.IntermediaryError("SPV swap vault needs too many confirmations: " + vault.getConfirmations());
        const tokenData = vault.getTokenData();
        //Amounts - make sure the amounts match
        if (amountData.exactIn) {
            if (resp.btcAmount !== amountData.amount)
                throw new IntermediaryError_1.IntermediaryError("Invalid amount returned");
        }
        else {
            //Check the difference between amount adjusted due to scaling to raw amount
            const adjustedAmount = amountData.amount / tokenData[0].multiplier * tokenData[0].multiplier;
            const adjustmentPPM = (amountData.amount - adjustedAmount) * 1000000n / amountData.amount;
            if (adjustmentPPM > this.options.maxRawAmountAdjustmentDifferencePPM)
                throw new IntermediaryError_1.IntermediaryError("Invalid amount0 multiplier used, rawAmount diff too high");
            if (resp.total !== adjustedAmount)
                throw new IntermediaryError_1.IntermediaryError("Invalid total returned");
        }
        if (options.gasAmount == null || options.gasAmount === 0n) {
            if (resp.totalGas !== 0n)
                throw new IntermediaryError_1.IntermediaryError("Invalid gas total returned");
        }
        else {
            //Check the difference between amount adjusted due to scaling to raw amount
            const adjustedGasAmount = options.gasAmount / tokenData[0].multiplier * tokenData[0].multiplier;
            const adjustmentPPM = (options.gasAmount - adjustedGasAmount) * 1000000n / options.gasAmount;
            if (adjustmentPPM > this.options.maxRawAmountAdjustmentDifferencePPM)
                throw new IntermediaryError_1.IntermediaryError("Invalid amount1 multiplier used, rawAmount diff too high");
            if (resp.totalGas !== adjustedGasAmount)
                throw new IntermediaryError_1.IntermediaryError("Invalid gas total returned");
        }
        //Require the vault UTXO to have at least 1 confirmation
        let utxo = resp.btcUtxo.toLowerCase();
        const [txId, voutStr] = utxo.split(":");
        let btcTx = await this.btcRpc.getTransaction(txId);
        if (btcTx.confirmations == null || btcTx.confirmations < 1)
            throw new IntermediaryError_1.IntermediaryError("SPV vault UTXO not confirmed");
        const vout = parseInt(voutStr);
        if (btcTx.outs[vout] == null)
            throw new IntermediaryError_1.IntermediaryError("Invalid UTXO, doesn't exist");
        const vaultUtxoValue = btcTx.outs[vout].value;
        //Require vault UTXO is unspent
        if (await this.btcRpc.isSpent(utxo))
            throw new IntermediaryError_1.IntermediaryError("Returned spv vault UTXO is already spent");
        //Trace returned utxo back to what's saved on-chain
        let pendingWithdrawals = [];
        while (vault.getUtxo() !== utxo) {
            const [txId, voutStr] = utxo.split(":");
            //Such that 1st tx isn't fetched twice
            if (btcTx.txid !== txId)
                btcTx = await this.btcRpc.getTransaction(txId);
            const withdrawalData = await this.contract.getWithdrawalData(btcTx);
            pendingWithdrawals.unshift(withdrawalData);
            utxo = pendingWithdrawals[0].getSpentVaultUtxo();
            if (pendingWithdrawals.length >= this.options.maxTransactionsDelta)
                throw new IntermediaryError_1.IntermediaryError("BTC <> SC state difference too deep, maximum: " + this.options.maxTransactionsDelta);
        }
        //Verify that the vault has enough balance after processing all pending withdrawals
        let vaultBalances;
        try {
            vaultBalances = vault.calculateStateAfter(pendingWithdrawals);
        }
        catch (e) {
            this.logger.error("Error calculating spv vault balance (owner: " + resp.address + " vaultId: " + resp.vaultId.toString(10) + "): ", e);
            throw new IntermediaryError_1.IntermediaryError("Spv swap vault balance prediction failed!");
        }
        if (vaultBalances.balances[0].scaledAmount < resp.total)
            throw new IntermediaryError_1.IntermediaryError("SPV swap vault, insufficient balance, required: " + resp.total.toString(10) +
                " has: " + vaultBalances.balances[0].scaledAmount.toString(10));
        if (vaultBalances.balances[1].scaledAmount < resp.totalGas)
            throw new IntermediaryError_1.IntermediaryError("SPV swap vault, insufficient balance, required: " + resp.totalGas.toString(10) +
                " has: " + vaultBalances.balances[1].scaledAmount.toString(10));
        //Also verify that all the withdrawal txns are valid, this is an extra sanity check
        try {
            for (let withdrawal of pendingWithdrawals) {
                await this.contract.checkWithdrawalTx(withdrawal);
            }
        }
        catch (e) {
            this.logger.error("Error calculating spv vault balance (owner: " + resp.address + " vaultId: " + resp.vaultId.toString(10) + "): ", e);
            throw new IntermediaryError_1.IntermediaryError("Spv swap vault balance prediction failed!");
        }
        return {
            vault,
            vaultUtxoValue
        };
    }
    /**
     * Returns a newly created swap, receiving 'amount' on chain
     *
     * @param signer                Smartchain signer's address intiating the swap
     * @param amountData            Amount of token & amount to swap
     * @param lps                   LPs (liquidity providers) to get the quotes from
     * @param options               Quote options
     * @param additionalParams      Additional parameters sent to the LP when creating the swap
     * @param abortSignal           Abort signal for aborting the process
     */
    create(signer, amountData, lps, options, additionalParams, abortSignal) {
        options ??= {};
        options.gasAmount ??= 0n;
        const _abortController = (0, Utils_1.extendAbortController)(abortSignal);
        const pricePrefetchPromise = this.preFetchPrice(amountData, _abortController.signal);
        // const claimerBountyPrefetchPromise = this.preFetchClaimerBounty(signer, amountData, options, _abortController);
        const nativeTokenAddress = this.chain.getNativeCurrencyAddress();
        const gasTokenPricePrefetchPromise = options.gasAmount === 0n ?
            Promise.resolve(1n) :
            this.preFetchPrice({ token: nativeTokenAddress }, _abortController.signal);
        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: (async () => {
                    const abortController = (0, Utils_1.extendAbortController)(_abortController.signal);
                    try {
                        const resp = await (0, Utils_1.tryWithRetries)(async (retryCount) => {
                            return await IntermediaryAPI_1.IntermediaryAPI.prepareSpvFromBTC(this.chainIdentifier, lp.url, {
                                address: signer,
                                amount: amountData.amount,
                                token: amountData.token.toString(),
                                exactOut: !amountData.exactIn,
                                gasToken: nativeTokenAddress,
                                gasAmount: options.gasAmount,
                                additionalParams
                            }, this.options.postRequestTimeout, abortController.signal, retryCount > 0 ? false : null);
                        }, null, e => e instanceof RequestError_1.RequestError, abortController.signal);
                        this.logger.debug("create(" + lp.url + "): LP response: ", resp);
                        const [pricingInfo, gasPricingInfo, { vault, vaultUtxoValue }] = await Promise.all([
                            this.verifyReturnedPrice(lp.services[SwapType_1.SwapType.SPV_VAULT_FROM_BTC], false, resp.btcAmountSwap, resp.total, amountData.token, {}, pricePrefetchPromise, abortController.signal),
                            this.verifyReturnedPrice({ ...lp.services[SwapType_1.SwapType.SPV_VAULT_FROM_BTC], swapBaseFee: 0 }, //Base fee should be charged only on the amount, not on gas
                            false, resp.btcAmountGas, resp.totalGas, nativeTokenAddress, {}, gasTokenPricePrefetchPromise, abortController.signal),
                            this.verifyReturnedData(resp, amountData, lp, options)
                        ]);
                        const swapInit = {
                            pricingInfo,
                            url: lp.url,
                            expiry: resp.expiry * 1000,
                            swapFee: resp.swapFee,
                            swapFeeBtc: resp.swapFeeBtc,
                            exactIn: amountData.exactIn ?? true,
                            quoteId: resp.quoteId,
                            recipient: signer,
                            vaultOwner: resp.address,
                            vaultId: resp.vaultId,
                            vaultRequiredConfirmations: vault.getConfirmations(),
                            vaultTokenMultipliers: vault.getTokenData().map(val => val.multiplier),
                            vaultBtcAddress: resp.vaultBtcAddress,
                            vaultUtxo: resp.btcUtxo,
                            vaultUtxoValue: BigInt(vaultUtxoValue),
                            btcDestinationAddress: resp.btcAddress,
                            btcAmount: resp.btcAmount,
                            btcAmountSwap: resp.btcAmountSwap,
                            btcAmountGas: resp.btcAmountGas,
                            minimumBtcFeeRate: resp.btcFeeRate,
                            outputTotalSwap: resp.total,
                            outputSwapToken: amountData.token,
                            outputTotalGas: resp.totalGas,
                            outputGasToken: nativeTokenAddress,
                            gasSwapFeeBtc: resp.gasSwapFeeBtc,
                            gasSwapFee: resp.gasSwapFee,
                            callerFeeShare: resp.callerFeeShare,
                            frontingFeeShare: resp.frontingFeeShare,
                            executionFeeShare: resp.executionFeeShare
                        };
                        const quote = new SpvFromBTCSwap_1.SpvFromBTCSwap(this, swapInit);
                        await quote._save();
                        return quote;
                    }
                    catch (e) {
                        abortController.abort(e);
                        throw e;
                    }
                })()
            };
        });
    }
}
exports.SpvFromBTCWrapper = SpvFromBTCWrapper;
