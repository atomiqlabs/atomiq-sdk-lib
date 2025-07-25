"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpvFromBTCSwap = exports.isSpvFromBTCSwapInit = exports.SpvFromBTCSwapState = void 0;
const ISwap_1 = require("../ISwap");
const base_1 = require("@atomiqlabs/base");
const SwapType_1 = require("../enums/SwapType");
const Utils_1 = require("../../utils/Utils");
const btc_signer_1 = require("@scure/btc-signer");
const Tokens_1 = require("../../Tokens");
const buffer_1 = require("buffer");
const Fee_1 = require("../fee/Fee");
const IBitcoinWallet_1 = require("../../btc/wallet/IBitcoinWallet");
const IntermediaryAPI_1 = require("../../intermediaries/IntermediaryAPI");
const SingleAddressBitcoinWallet_1 = require("../../btc/wallet/SingleAddressBitcoinWallet");
var SpvFromBTCSwapState;
(function (SpvFromBTCSwapState) {
    SpvFromBTCSwapState[SpvFromBTCSwapState["CLOSED"] = -5] = "CLOSED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["FAILED"] = -4] = "FAILED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["DECLINED"] = -3] = "DECLINED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["QUOTE_EXPIRED"] = -2] = "QUOTE_EXPIRED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["QUOTE_SOFT_EXPIRED"] = -1] = "QUOTE_SOFT_EXPIRED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["CREATED"] = 0] = "CREATED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["SIGNED"] = 1] = "SIGNED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["POSTED"] = 2] = "POSTED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["BROADCASTED"] = 3] = "BROADCASTED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["FRONTED"] = 4] = "FRONTED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["BTC_TX_CONFIRMED"] = 5] = "BTC_TX_CONFIRMED";
    SpvFromBTCSwapState[SpvFromBTCSwapState["CLAIMED"] = 6] = "CLAIMED"; //Funds claimed
})(SpvFromBTCSwapState = exports.SpvFromBTCSwapState || (exports.SpvFromBTCSwapState = {}));
function isSpvFromBTCSwapInit(obj) {
    return typeof obj === "object" &&
        typeof (obj.quoteId) === "string" &&
        typeof (obj.recipient) === "string" &&
        typeof (obj.vaultOwner) === "string" &&
        typeof (obj.vaultId) === "bigint" &&
        typeof (obj.vaultRequiredConfirmations) === "number" &&
        Array.isArray(obj.vaultTokenMultipliers) && obj.vaultTokenMultipliers.reduce((prev, curr) => prev && typeof (curr) === "bigint", true) &&
        typeof (obj.vaultBtcAddress) === "string" &&
        typeof (obj.vaultUtxo) === "string" &&
        typeof (obj.vaultUtxoValue) === "bigint" &&
        typeof (obj.btcDestinationAddress) === "string" &&
        typeof (obj.btcAmount) === "bigint" &&
        typeof (obj.btcAmountSwap) === "bigint" &&
        typeof (obj.btcAmountGas) === "bigint" &&
        typeof (obj.minimumBtcFeeRate) === "number" &&
        typeof (obj.outputTotalSwap) === "bigint" &&
        typeof (obj.outputSwapToken) === "string" &&
        typeof (obj.outputTotalGas) === "bigint" &&
        typeof (obj.outputGasToken) === "string" &&
        typeof (obj.gasSwapFeeBtc) === "bigint" &&
        typeof (obj.gasSwapFee) === "bigint" &&
        typeof (obj.callerFeeShare) === "bigint" &&
        typeof (obj.frontingFeeShare) === "bigint" &&
        typeof (obj.executionFeeShare) === "bigint" &&
        (0, ISwap_1.isISwapInit)(obj);
}
exports.isSpvFromBTCSwapInit = isSpvFromBTCSwapInit;
class SpvFromBTCSwap extends ISwap_1.ISwap {
    constructor(wrapper, initOrObject) {
        if (isSpvFromBTCSwapInit(initOrObject))
            initOrObject.url += "/frombtc_spv";
        super(wrapper, initOrObject);
        this.TYPE = SwapType_1.SwapType.SPV_VAULT_FROM_BTC;
        if (isSpvFromBTCSwapInit(initOrObject)) {
            this.state = SpvFromBTCSwapState.CREATED;
            const vaultAddressType = (0, Utils_1.toCoinselectAddressType)((0, Utils_1.toOutputScript)(this.wrapper.options.bitcoinNetwork, this.vaultBtcAddress));
            if (vaultAddressType !== "p2tr" && vaultAddressType !== "p2wpkh" && vaultAddressType !== "p2wsh")
                throw new Error("Vault address type must be of witness type: p2tr, p2wpkh, p2wsh");
        }
        else {
            this.quoteId = initOrObject.quoteId;
            this.recipient = initOrObject.recipient;
            this.vaultOwner = initOrObject.vaultOwner;
            this.vaultId = BigInt(initOrObject.vaultId);
            this.vaultRequiredConfirmations = initOrObject.vaultRequiredConfirmations;
            this.vaultTokenMultipliers = initOrObject.vaultTokenMultipliers.map(val => BigInt(val));
            this.vaultBtcAddress = initOrObject.vaultBtcAddress;
            this.vaultUtxo = initOrObject.vaultUtxo;
            this.vaultUtxoValue = BigInt(initOrObject.vaultUtxoValue);
            this.btcDestinationAddress = initOrObject.btcDestinationAddress;
            this.btcAmount = BigInt(initOrObject.btcAmount);
            this.btcAmountSwap = BigInt(initOrObject.btcAmountSwap);
            this.btcAmountGas = BigInt(initOrObject.btcAmountGas);
            this.minimumBtcFeeRate = initOrObject.minimumBtcFeeRate;
            this.outputTotalSwap = BigInt(initOrObject.outputTotalSwap);
            this.outputSwapToken = initOrObject.outputSwapToken;
            this.outputTotalGas = BigInt(initOrObject.outputTotalGas);
            this.outputGasToken = initOrObject.outputGasToken;
            this.gasSwapFeeBtc = BigInt(initOrObject.gasSwapFeeBtc);
            this.gasSwapFee = BigInt(initOrObject.gasSwapFee);
            this.callerFeeShare = BigInt(initOrObject.callerFeeShare);
            this.frontingFeeShare = BigInt(initOrObject.frontingFeeShare);
            this.executionFeeShare = BigInt(initOrObject.executionFeeShare);
            this.claimTxId = initOrObject.claimTxId;
            this.frontTxId = initOrObject.frontTxId;
            this.data = initOrObject.data == null ? null : new this.wrapper.spvWithdrawalDataDeserializer(initOrObject.data);
        }
        this.tryCalculateSwapFee();
        this.logger = (0, Utils_1.getLogger)("SPVFromBTC(" + this.getId() + "): ");
    }
    upgradeVersion() { }
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    tryCalculateSwapFee() {
        if (this.swapFeeBtc == null) {
            this.swapFeeBtc = this.swapFee * this.btcAmountSwap / this.getOutputWithoutFee().rawAmount;
        }
        if (this.pricingInfo.swapPriceUSatPerToken == null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(this.chainIdentifier, this.btcAmountSwap, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.getOutputWithoutFee().rawAmount, this.outputSwapToken);
        }
    }
    //////////////////////////////
    //// Pricing
    async refreshPriceData() {
        if (this.pricingInfo == null)
            return null;
        this.pricingInfo = await this.wrapper.prices.isValidAmountReceive(this.chainIdentifier, this.btcAmountSwap, this.pricingInfo.satsBaseFee, this.pricingInfo.feePPM, this.getOutputWithoutFee().rawAmount, this.outputSwapToken);
    }
    //////////////////////////////
    //// Getters & utils
    _getInitiator() {
        return this.recipient;
    }
    _getEscrowHash() {
        return this.data?.btcTx?.txid;
    }
    getId() {
        return this.quoteId + this.randomNonce;
    }
    getQuoteExpiry() {
        return this.expiry - 20 * 1000;
    }
    verifyQuoteValid() {
        return Promise.resolve(this.expiry > Date.now() && this.state === SpvFromBTCSwapState.CREATED);
    }
    getOutputAddress() {
        return this.recipient;
    }
    getOutputTxId() {
        return this.frontTxId ?? this.claimTxId;
    }
    getInputTxId() {
        return this.data?.btcTx?.txid;
    }
    requiresAction() {
        return this.state === SpvFromBTCSwapState.BTC_TX_CONFIRMED;
    }
    isFinished() {
        return this.state === SpvFromBTCSwapState.CLAIMED || this.state === SpvFromBTCSwapState.QUOTE_EXPIRED || this.state === SpvFromBTCSwapState.FAILED;
    }
    isClaimable() {
        return this.state === SpvFromBTCSwapState.BTC_TX_CONFIRMED;
    }
    isSuccessful() {
        return this.state === SpvFromBTCSwapState.FRONTED || this.state === SpvFromBTCSwapState.CLAIMED;
    }
    isFailed() {
        return this.state === SpvFromBTCSwapState.FAILED || this.state === SpvFromBTCSwapState.DECLINED || this.state === SpvFromBTCSwapState.CLOSED;
    }
    isQuoteExpired() {
        return this.state === SpvFromBTCSwapState.QUOTE_EXPIRED;
    }
    isQuoteSoftExpired() {
        return this.state === SpvFromBTCSwapState.QUOTE_EXPIRED || this.state === SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED;
    }
    //////////////////////////////
    //// Amounts & fees
    getInputSwapAmountWithoutFee() {
        return (this.btcAmountSwap - this.swapFeeBtc) * 100000n / (100000n + this.callerFeeShare + this.frontingFeeShare + this.executionFeeShare);
    }
    getInputGasAmountWithoutFee() {
        return (this.btcAmountGas - this.gasSwapFeeBtc) * 100000n / (100000n + this.callerFeeShare + this.frontingFeeShare);
    }
    getInputAmountWithoutFee() {
        return this.getInputSwapAmountWithoutFee() + this.getInputGasAmountWithoutFee();
    }
    getOutputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)((this.outputTotalSwap * (100000n + this.callerFeeShare + this.frontingFeeShare + this.executionFeeShare) / 100000n) + this.swapFee, this.wrapper.tokens[this.outputSwapToken], this.wrapper.prices);
    }
    getSwapFee() {
        const outputToken = this.wrapper.tokens[this.outputSwapToken];
        const gasSwapFeeInOutputToken = this.gasSwapFeeBtc
            * (10n ** BigInt(outputToken.decimals))
            * 1000000n
            / this.pricingInfo.swapPriceUSatPerToken;
        const feeWithoutBaseFee = this.swapFeeBtc - this.pricingInfo.satsBaseFee;
        const swapFeePPM = feeWithoutBaseFee * 1000000n / (this.btcAmount - this.swapFeeBtc - this.gasSwapFeeBtc);
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(this.swapFeeBtc + this.gasSwapFeeBtc, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(this.swapFee + gasSwapFeeInOutputToken, outputToken, this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc + this.gasSwapFeeBtc, abortSignal, preFetchedUsdPrice),
            composition: {
                base: (0, Tokens_1.toTokenAmount)(this.pricingInfo.satsBaseFee, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices),
                percentage: (0, ISwap_1.ppmToPercentage)(swapFeePPM)
            }
        };
    }
    getWatchtowerFee() {
        const totalFeeShare = this.callerFeeShare + this.frontingFeeShare;
        const outputToken = this.wrapper.tokens[this.outputSwapToken];
        const watchtowerFeeInOutputToken = this.getInputGasAmountWithoutFee() * totalFeeShare
            * (10n ** BigInt(outputToken.decimals))
            * 1000000n
            / this.pricingInfo.swapPriceUSatPerToken
            / 100000n;
        const feeBtc = this.getInputAmountWithoutFee() * (totalFeeShare + this.executionFeeShare) / 100000n;
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(feeBtc, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)((this.outputTotalSwap * (totalFeeShare + this.executionFeeShare) / 100000n) + watchtowerFeeInOutputToken, outputToken, this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(feeBtc, abortSignal, preFetchedUsdPrice)
        };
    }
    getFee() {
        const swapFee = this.getSwapFee();
        const watchtowerFee = this.getWatchtowerFee();
        return {
            amountInSrcToken: (0, Tokens_1.toTokenAmount)(swapFee.amountInSrcToken.rawAmount + watchtowerFee.amountInSrcToken.rawAmount, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices),
            amountInDstToken: (0, Tokens_1.toTokenAmount)(swapFee.amountInDstToken.rawAmount + watchtowerFee.amountInDstToken.rawAmount, this.wrapper.tokens[this.outputSwapToken], this.wrapper.prices),
            usdValue: (abortSignal, preFetchedUsdPrice) => this.wrapper.prices.getBtcUsdValue(swapFee.amountInSrcToken.rawAmount + watchtowerFee.amountInSrcToken.rawAmount, abortSignal, preFetchedUsdPrice)
        };
    }
    getFeeBreakdown() {
        return [
            {
                type: Fee_1.FeeType.SWAP,
                fee: this.getSwapFee()
            },
            {
                type: Fee_1.FeeType.NETWORK_OUTPUT,
                fee: this.getWatchtowerFee()
            }
        ];
    }
    getOutput() {
        return (0, Tokens_1.toTokenAmount)(this.outputTotalSwap, this.wrapper.tokens[this.outputSwapToken], this.wrapper.prices);
    }
    getGasDropOutput() {
        return (0, Tokens_1.toTokenAmount)(this.outputTotalGas, this.wrapper.tokens[this.outputGasToken], this.wrapper.prices);
    }
    getInputWithoutFee() {
        return (0, Tokens_1.toTokenAmount)(this.getInputAmountWithoutFee(), Tokens_1.BitcoinTokens.BTC, this.wrapper.prices);
    }
    getInput() {
        return (0, Tokens_1.toTokenAmount)(this.btcAmount, Tokens_1.BitcoinTokens.BTC, this.wrapper.prices);
    }
    //////////////////////////////
    //// Bitcoin tx
    async getTransactionDetails() {
        const [txId, voutStr] = this.vaultUtxo.split(":");
        const vaultScript = (0, Utils_1.toOutputScript)(this.wrapper.options.bitcoinNetwork, this.vaultBtcAddress);
        const out2script = (0, Utils_1.toOutputScript)(this.wrapper.options.bitcoinNetwork, this.btcDestinationAddress);
        const opReturnData = this.wrapper.contract.toOpReturnData(this.recipient, [
            this.outputTotalSwap / this.vaultTokenMultipliers[0],
            this.outputTotalGas / this.vaultTokenMultipliers[1]
        ]);
        const out1script = buffer_1.Buffer.concat([
            opReturnData.length > 75 ? buffer_1.Buffer.from([0x6a, 0x4c, opReturnData.length]) : buffer_1.Buffer.from([0x6a, opReturnData.length]),
            opReturnData
        ]);
        if (this.callerFeeShare < 0n || this.callerFeeShare > 0xfffffn)
            throw new Error("Caller fee out of bounds!");
        if (this.frontingFeeShare < 0n || this.frontingFeeShare > 0xfffffn)
            throw new Error("Fronting fee out of bounds!");
        if (this.executionFeeShare < 0n || this.executionFeeShare > 0xfffffn)
            throw new Error("Execution fee out of bounds!");
        const nSequence0 = 0x80000000n | (this.callerFeeShare & 0xfffffn) | (this.frontingFeeShare & 1047552n) << 10n;
        const nSequence1 = 0x80000000n | (this.executionFeeShare & 0xfffffn) | (this.frontingFeeShare & 1023n) << 20n;
        return {
            in0txid: txId,
            in0vout: parseInt(voutStr),
            in0sequence: Number(nSequence0),
            vaultAmount: this.vaultUtxoValue,
            vaultScript,
            in1sequence: Number(nSequence1),
            out1script,
            out2amount: this.btcAmount,
            out2script,
            locktime: 500000000 + Math.floor(Math.random() * 1000000000) //Use this as a random salt to make the btc txId unique!
        };
    }
    async getPsbt() {
        const res = await this.getTransactionDetails();
        const psbt = new btc_signer_1.Transaction({
            allowUnknownOutputs: true,
            allowLegacyWitnessUtxo: true,
            lockTime: res.locktime
        });
        psbt.addInput({
            txid: res.in0txid,
            index: res.in0vout,
            witnessUtxo: {
                amount: res.vaultAmount,
                script: res.vaultScript
            },
            sequence: res.in0sequence
        });
        psbt.addOutput({
            amount: res.vaultAmount,
            script: res.vaultScript
        });
        psbt.addOutput({
            amount: 0n,
            script: res.out1script
        });
        psbt.addOutput({
            amount: res.out2amount,
            script: res.out2script
        });
        return {
            psbt,
            in1sequence: res.in1sequence
        };
    }
    async getFundedPsbt(_bitcoinWallet, feeRate) {
        let bitcoinWallet;
        if ((0, IBitcoinWallet_1.isIBitcoinWallet)(_bitcoinWallet)) {
            bitcoinWallet = _bitcoinWallet;
        }
        else {
            bitcoinWallet = new SingleAddressBitcoinWallet_1.SingleAddressBitcoinWallet(this.wrapper.btcRpc, this.wrapper.options.bitcoinNetwork, _bitcoinWallet);
        }
        if (feeRate != null) {
            if (feeRate < this.minimumBtcFeeRate)
                throw new Error("Bitcoin tx fee needs to be at least " + this.minimumBtcFeeRate + " sats/vB");
        }
        else {
            feeRate = Math.max(this.minimumBtcFeeRate, await bitcoinWallet.getFeeRate());
        }
        let { psbt, in1sequence } = await this.getPsbt();
        psbt = await bitcoinWallet.fundPsbt(psbt, feeRate);
        psbt.updateInput(1, { sequence: in1sequence });
        //Sign every input except the first one
        const signInputs = [];
        for (let i = 1; i < psbt.inputsLength; i++) {
            signInputs.push(i);
        }
        return { psbt, signInputs };
    }
    async submitPsbt(psbt) {
        //Ensure not expired
        if (this.expiry < Date.now()) {
            throw new Error("Quote expired!");
        }
        //Ensure valid state
        if (this.state !== SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED && this.state !== SpvFromBTCSwapState.CREATED) {
            throw new Error("Invalid swap state!");
        }
        //Ensure all inputs except the 1st are finalized
        for (let i = 1; i < psbt.inputsLength; i++) {
            psbt.finalizeIdx(i);
            if ((0, btc_signer_1.getInputType)(psbt.getInput(i)).txType === "legacy")
                throw new Error("Legacy (non-segwit) inputs are not allowed in the transaction!");
        }
        const btcTx = await this.wrapper.btcRpc.parseTransaction(buffer_1.Buffer.from(psbt.toBytes(true)).toString("hex"));
        const data = await this.wrapper.contract.getWithdrawalData(btcTx);
        this.logger.debug("submitPsbt(): parsed withdrawal data: ", data);
        //Verify correct withdrawal data
        if (!data.isRecipient(this.recipient) ||
            data.rawAmounts[0] * this.vaultTokenMultipliers[0] !== this.outputTotalSwap ||
            (data.rawAmounts[1] ?? 0n) * this.vaultTokenMultipliers[1] !== this.outputTotalGas ||
            data.callerFeeRate !== this.callerFeeShare ||
            data.frontingFeeRate !== this.frontingFeeShare ||
            data.executionFeeRate !== this.executionFeeShare ||
            data.getSpentVaultUtxo() !== this.vaultUtxo ||
            BigInt(data.getNewVaultBtcAmount()) !== this.vaultUtxoValue ||
            !data.getNewVaultScript().equals((0, Utils_1.toOutputScript)(this.wrapper.options.bitcoinNetwork, this.vaultBtcAddress)) ||
            data.getExecutionData() != null) {
            throw new Error("Invalid withdrawal tx data submitted!");
        }
        //Verify correct LP output
        const lpOutput = psbt.getOutput(2);
        if (lpOutput.amount !== this.btcAmount ||
            !(0, Utils_1.toOutputScript)(this.wrapper.options.bitcoinNetwork, this.btcDestinationAddress).equals(buffer_1.Buffer.from(lpOutput.script))) {
            throw new Error("Invalid LP bitcoin output in transaction!");
        }
        //Verify vault utxo not spent yet
        if (await this.wrapper.btcRpc.isSpent(this.vaultUtxo)) {
            throw new Error("Vault UTXO already spent, please create new swap!");
        }
        //Verify tx is parsable by the contract
        try {
            await this.wrapper.contract.checkWithdrawalTx(data);
        }
        catch (e) {
            throw new Error("Transaction not parsable by the contract: " + (e.message ?? e.toString()));
        }
        //Ensure still not expired
        if (this.expiry < Date.now()) {
            throw new Error("Quote expired!");
        }
        this.data = data;
        this.initiated = true;
        await this._saveAndEmit(SpvFromBTCSwapState.SIGNED);
        try {
            await IntermediaryAPI_1.IntermediaryAPI.initSpvFromBTC(this.chainIdentifier, this.url, {
                quoteId: this.quoteId,
                psbtHex: buffer_1.Buffer.from(psbt.toPSBT(0)).toString("hex")
            });
            await this._saveAndEmit(SpvFromBTCSwapState.POSTED);
        }
        catch (e) {
            await this._saveAndEmit(SpvFromBTCSwapState.DECLINED);
            throw e;
        }
        return this.data.getTxId();
    }
    async estimateBitcoinFee(wallet, feeRate) {
        const txFee = await wallet.getFundedPsbtFee((await this.getPsbt()).psbt, feeRate);
        return (0, Tokens_1.toTokenAmount)(txFee == null ? null : BigInt(txFee), Tokens_1.BitcoinTokens.BTC, this.wrapper.prices);
    }
    async sendBitcoinTransaction(wallet, feeRate) {
        let { psbt, signInputs } = await this.getFundedPsbt(wallet, feeRate);
        psbt = await wallet.signPsbt(psbt, signInputs);
        return await this.submitPsbt(psbt);
    }
    //////////////////////////////
    //// Bitcoin tx listener
    /**
     * Checks whether a bitcoin payment was already made, returns the payment or null when no payment has been made.
     */
    async getBitcoinPayment() {
        if (this.data?.btcTx?.txid == null)
            return null;
        const result = await this.wrapper.btcRpc.getTransaction(this.data?.btcTx?.txid);
        if (result == null)
            return null;
        return {
            txId: result.txid,
            confirmations: result.confirmations,
            targetConfirmations: this.vaultRequiredConfirmations
        };
    }
    /**
     * Waits till the bitcoin transaction confirms and swap becomes claimable
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    async waitForBitcoinTransaction(abortSignal, checkIntervalSeconds, updateCallback) {
        if (this.state !== SpvFromBTCSwapState.POSTED &&
            this.state !== SpvFromBTCSwapState.BROADCASTED &&
            this.state !== SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED)
            throw new Error("Must be in POSTED or BROADCASTED state!");
        const result = await this.wrapper.btcRpc.waitForTransaction(this.data.btcTx.txid, this.vaultRequiredConfirmations, (confirmations, txId, txEtaMs) => {
            if (updateCallback != null)
                updateCallback(txId, confirmations, this.vaultRequiredConfirmations, txEtaMs);
            if (txId != null &&
                (this.state === SpvFromBTCSwapState.POSTED || this.state == SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED))
                this._saveAndEmit(SpvFromBTCSwapState.BROADCASTED);
        }, abortSignal, checkIntervalSeconds);
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        if (this.state !== SpvFromBTCSwapState.FRONTED &&
            this.state !== SpvFromBTCSwapState.CLAIMED) {
            await this._saveAndEmit(SpvFromBTCSwapState.BTC_TX_CONFIRMED);
        }
        return result.txid;
    }
    //////////////////////////////
    //// Claim
    /**
     * Returns transactions required to claim the swap on-chain (and possibly also sync the bitcoin light client)
     *  after a bitcoin transaction was sent and confirmed
     *
     * @throws {Error} If the swap is in invalid state (must be BTC_TX_CONFIRMED)
     */
    async txsClaim(signer) {
        if (!this.isClaimable())
            throw new Error("Must be in BTC_TX_CONFIRMED state!");
        const vaultData = await this.wrapper.contract.getVaultData(this.vaultOwner, this.vaultId);
        const txs = [await this.wrapper.btcRpc.getTransaction(this.data.btcTx.txid)];
        //Trace back from current tx to the vaultData-specified UTXO
        const vaultUtxo = vaultData.getUtxo();
        while (txs[0].ins[0].txid + ":" + txs[0].ins[0].vout !== vaultUtxo) {
            txs.unshift(await this.wrapper.btcRpc.getTransaction(txs[0].ins[0].txid));
        }
        //Parse transactions to withdrawal data
        const withdrawalData = [];
        for (let tx of txs) {
            withdrawalData.push(await this.wrapper.contract.getWithdrawalData(tx));
        }
        return await this.wrapper.contract.txsClaim(signer == null ? this._getInitiator() : signer.getAddress(), vaultData, withdrawalData.map(tx => { return { tx }; }), this.wrapper.synchronizer, true);
    }
    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    async claim(signer, abortSignal) {
        let txIds;
        try {
            txIds = await this.wrapper.chain.sendAndConfirm(signer, await this.txsClaim(signer), true, abortSignal);
        }
        catch (e) {
            this.logger.info("claim(): Failed to claim ourselves, checking swap claim state...");
            if (this.state === SpvFromBTCSwapState.CLAIMED) {
                this.logger.info("claim(): Transaction state is CLAIMED, swap was successfully claimed by the watchtower");
                return this.claimTxId;
            }
            const withdrawalState = await this.wrapper.contract.getWithdrawalState(this.data.btcTx.txid);
            if (withdrawalState.type === base_1.SpvWithdrawalStateType.CLAIMED) {
                this.logger.info("claim(): Transaction status is CLAIMED, swap was successfully claimed by the watchtower");
                this.claimTxId = withdrawalState.txId;
                await this._saveAndEmit(SpvFromBTCSwapState.CLAIMED);
                return null;
            }
            throw e;
        }
        this.claimTxId = txIds[0];
        if (this.state === SpvFromBTCSwapState.POSTED || this.state === SpvFromBTCSwapState.BROADCASTED ||
            this.state === SpvFromBTCSwapState.BTC_TX_CONFIRMED || this.state === SpvFromBTCSwapState.FAILED ||
            this.state === SpvFromBTCSwapState.FRONTED) {
            await this._saveAndEmit(SpvFromBTCSwapState.CLAIMED);
        }
        return txIds[0];
    }
    /**
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    async watchdogWaitTillResult(abortSignal, interval = 5) {
        let status = { type: base_1.SpvWithdrawalStateType.NOT_FOUND };
        while (status.type === base_1.SpvWithdrawalStateType.NOT_FOUND) {
            await (0, Utils_1.timeoutPromise)(interval * 1000, abortSignal);
            try {
                status = await this.wrapper.contract.getWithdrawalState(this.data.btcTx.txid);
            }
            catch (e) {
                this.logger.error("watchdogWaitTillResult(): Error when fetching commit status: ", e);
            }
        }
        if (abortSignal != null)
            abortSignal.throwIfAborted();
        return status;
    }
    /**
     * Waits till the swap is successfully executed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be BTC_TX_CONFIRMED)
     * @throws {Error} If the LP refunded sooner than we were able to claim
     */
    async waitTillClaimedOrFronted(abortSignal) {
        if (this.state === SpvFromBTCSwapState.CLAIMED || this.state === SpvFromBTCSwapState.FRONTED)
            return Promise.resolve();
        const abortController = new AbortController();
        if (abortSignal != null)
            abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
        const res = await Promise.race([
            this.watchdogWaitTillResult(abortController.signal),
            this.waitTillState(SpvFromBTCSwapState.CLAIMED, "eq", abortController.signal).then(() => 0),
            this.waitTillState(SpvFromBTCSwapState.FRONTED, "eq", abortController.signal).then(() => 1),
            this.waitTillState(SpvFromBTCSwapState.FAILED, "eq", abortController.signal).then(() => 2),
        ]);
        abortController.abort();
        if (typeof (res) === "number") {
            if (res === 0) {
                this.logger.debug("waitTillClaimedOrFronted(): Resolved from state change (CLAIMED)");
                return;
            }
            if (res === 1) {
                this.logger.debug("waitTillClaimedOrFronted(): Resolved from state change (FRONTED)");
                return;
            }
            if (res === 2) {
                this.logger.debug("waitTillClaimedOrFronted(): Resolved from state change (FAILED)");
                throw new Error("Swap failed while waiting for claim or front");
            }
            return;
        }
        this.logger.debug("waitTillClaimedOrFronted(): Resolved from watchdog");
        if (res.type === base_1.SpvWithdrawalStateType.FRONTED) {
            if (this.state !== SpvFromBTCSwapState.FRONTED ||
                this.state !== SpvFromBTCSwapState.CLAIMED)
                await this._saveAndEmit(SpvFromBTCSwapState.FRONTED);
        }
        if (res.type === base_1.SpvWithdrawalStateType.CLAIMED) {
            if (this.state !== SpvFromBTCSwapState.CLAIMED)
                await this._saveAndEmit(SpvFromBTCSwapState.FRONTED);
        }
        if (res.type === base_1.SpvWithdrawalStateType.CLOSED) {
            if (this.state !== SpvFromBTCSwapState.CLOSED)
                await this._saveAndEmit(SpvFromBTCSwapState.CLOSED);
        }
    }
    /**
     * Waits till the bitcoin transaction confirms and swap is claimed
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    async waitTillExecuted(abortSignal, checkIntervalSeconds, updateCallback) {
        await this.waitForBitcoinTransaction(abortSignal, checkIntervalSeconds, updateCallback);
        await this.waitTillClaimedOrFronted(abortSignal);
    }
    //////////////////////////////
    //// Storage
    serialize() {
        return {
            ...super.serialize(),
            quoteId: this.quoteId,
            recipient: this.recipient,
            vaultOwner: this.vaultOwner,
            vaultId: this.vaultId.toString(10),
            vaultRequiredConfirmations: this.vaultRequiredConfirmations,
            vaultTokenMultipliers: this.vaultTokenMultipliers.map(val => val.toString(10)),
            vaultBtcAddress: this.vaultBtcAddress,
            vaultUtxo: this.vaultUtxo,
            vaultUtxoValue: this.vaultUtxoValue.toString(10),
            btcDestinationAddress: this.btcDestinationAddress,
            btcAmount: this.btcAmount.toString(10),
            btcAmountSwap: this.btcAmountSwap.toString(10),
            btcAmountGas: this.btcAmountGas.toString(10),
            minimumBtcFeeRate: this.minimumBtcFeeRate,
            outputTotalSwap: this.outputTotalSwap.toString(10),
            outputSwapToken: this.outputSwapToken,
            outputTotalGas: this.outputTotalGas.toString(10),
            outputGasToken: this.outputGasToken,
            gasSwapFeeBtc: this.gasSwapFeeBtc.toString(10),
            gasSwapFee: this.gasSwapFee.toString(10),
            callerFeeShare: this.callerFeeShare.toString(10),
            frontingFeeShare: this.frontingFeeShare.toString(10),
            executionFeeShare: this.executionFeeShare.toString(10),
            claimTxId: this.claimTxId,
            frontTxId: this.frontTxId,
            data: this.data?.serialize()
        };
    }
    //////////////////////////////
    //// Swap ticks & sync
    async syncStateFromBitcoin(save) {
        if (this.data?.btcTx == null)
            return false;
        //Check if bitcoin payment was confirmed
        const res = await this.getBitcoinPayment();
        if (res == null) {
            //Check inputs double-spent
            for (let input of this.data.btcTx.ins) {
                if (await this.wrapper.btcRpc.isSpent(input.txid + ":" + input.vout, true)) {
                    if (this.state === SpvFromBTCSwapState.SIGNED ||
                        this.state === SpvFromBTCSwapState.POSTED ||
                        this.state === SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED ||
                        this.state === SpvFromBTCSwapState.DECLINED) {
                        //One of the inputs was double-spent
                        this.state = SpvFromBTCSwapState.QUOTE_EXPIRED;
                    }
                    else {
                        //One of the inputs was double-spent
                        this.state = SpvFromBTCSwapState.FAILED;
                    }
                    if (save)
                        await this._saveAndEmit();
                    return true;
                }
            }
        }
        else {
            if (res.confirmations >= this.vaultRequiredConfirmations) {
                if (this.state !== SpvFromBTCSwapState.FRONTED &&
                    this.state !== SpvFromBTCSwapState.CLAIMED) {
                    this.state = SpvFromBTCSwapState.BTC_TX_CONFIRMED;
                    if (save)
                        await this._saveAndEmit();
                    return true;
                }
            }
            else if (this.state === SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED ||
                this.state === SpvFromBTCSwapState.POSTED ||
                this.state === SpvFromBTCSwapState.SIGNED ||
                this.state === SpvFromBTCSwapState.DECLINED) {
                this.state = SpvFromBTCSwapState.BROADCASTED;
                if (save)
                    await this._saveAndEmit();
                return true;
            }
        }
        return false;
    }
    /**
     * Checks the swap's state on-chain and compares it to its internal state, updates/changes it according to on-chain
     *  data
     *
     * @private
     */
    async syncStateFromChain() {
        let changed = false;
        if (this.state === SpvFromBTCSwapState.SIGNED ||
            this.state === SpvFromBTCSwapState.POSTED ||
            this.state === SpvFromBTCSwapState.BROADCASTED ||
            this.state === SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED ||
            this.state === SpvFromBTCSwapState.DECLINED) {
            //Check BTC transaction
            if (await this.syncStateFromBitcoin(false))
                changed ||= true;
        }
        if (this.state === SpvFromBTCSwapState.BROADCASTED || this.state === SpvFromBTCSwapState.BTC_TX_CONFIRMED) {
            const status = await this.wrapper.contract.getWithdrawalState(this.data.btcTx.txid);
            this.logger.debug("syncStateFromChain(): status of " + this.data.btcTx.txid, status);
            switch (status.type) {
                case base_1.SpvWithdrawalStateType.FRONTED:
                    this.frontTxId = status.txId;
                    this.state = SpvFromBTCSwapState.FRONTED;
                    changed ||= true;
                    break;
                case base_1.SpvWithdrawalStateType.CLAIMED:
                    this.claimTxId = status.txId;
                    this.state = SpvFromBTCSwapState.CLAIMED;
                    changed ||= true;
                    break;
                case base_1.SpvWithdrawalStateType.CLOSED:
                    this.state = SpvFromBTCSwapState.CLOSED;
                    changed ||= true;
                    break;
            }
        }
        if (this.state === SpvFromBTCSwapState.CREATED ||
            this.state === SpvFromBTCSwapState.SIGNED ||
            this.state === SpvFromBTCSwapState.POSTED) {
            if (this.expiry < Date.now()) {
                if (this.state === SpvFromBTCSwapState.CREATED) {
                    this.state = SpvFromBTCSwapState.QUOTE_EXPIRED;
                }
                else {
                    this.state = SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED;
                }
                changed ||= true;
            }
        }
        return changed;
    }
    async _sync(save) {
        const changed = await this.syncStateFromChain();
        if (changed && save)
            await this._saveAndEmit();
        return changed;
    }
    async _tick(save) {
        if (this.state === SpvFromBTCSwapState.CREATED ||
            this.state === SpvFromBTCSwapState.SIGNED) {
            if (this.getQuoteExpiry() < Date.now()) {
                if (this.state === SpvFromBTCSwapState.CREATED) {
                    this.state = SpvFromBTCSwapState.QUOTE_EXPIRED;
                }
                else {
                    this.state = SpvFromBTCSwapState.QUOTE_SOFT_EXPIRED;
                }
                if (save)
                    await this._saveAndEmit();
                return true;
            }
        }
        if (Math.floor(Date.now() / 1000) % 120 === 0) {
            if (this.state === SpvFromBTCSwapState.POSTED ||
                this.state === SpvFromBTCSwapState.BROADCASTED) {
                try {
                    //Check if bitcoin payment was confirmed
                    return await this.syncStateFromBitcoin(save);
                }
                catch (e) {
                    this.logger.error("tickSwap(" + this.getId() + "): ", e);
                }
            }
        }
    }
}
exports.SpvFromBTCSwap = SpvFromBTCSwap;
