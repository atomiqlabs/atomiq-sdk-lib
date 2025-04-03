import {SwapType} from "../../enums/SwapType";
import {ChainType} from "@atomiqlabs/base";
import {PaymentAuthError} from "../../../errors/PaymentAuthError";
import {getLogger, timeoutPromise} from "../../../utils/Utils";
import {isISwapInit, ISwap, ISwapInit} from "../../ISwap";
import {PriceInfoType} from "../../../prices/abstract/ISwapPrice";
import {
    AddressStatusResponseCodes,
    TrustedIntermediaryAPI
} from "../../../intermediaries/TrustedIntermediaryAPI";
import {BitcoinTokens, BtcToken, SCToken, TokenAmount, toTokenAmount} from "../../../Tokens";
import {OnchainForGasWrapper} from "./OnchainForGasWrapper";
import {Fee} from "../../fee/Fee";
import {IBitcoinWallet} from "../../../btc/wallet/IBitcoinWallet";

export enum OnchainForGasSwapState {
    EXPIRED = -3,
    FAILED = -2,
    REFUNDED = -1,
    PR_CREATED = 0,
    FINISHED = 1,
    REFUNDABLE = 2
}

export type OnchainForGasSwapInit = ISwapInit & {
    paymentHash: string;
    sequence: bigint;
    address: string;
    inputAmount: bigint;
    outputAmount: bigint;
    recipient: string;
    token: string;
    refundAddress?: string;
};

export function isOnchainForGasSwapInit(obj: any): obj is OnchainForGasSwapInit {
    return typeof(obj.paymentHash)==="string" &&
        typeof(obj.sequence)==="bigint" &&
        typeof(obj.address)==="string" &&
        typeof(obj.inputAmount)==="bigint" &&
        typeof(obj.outputAmount)==="bigint" &&
        typeof(obj.recipient)==="string" &&
        typeof(obj.token)==="string" &&
        (obj.refundAddress==null || typeof(obj.refundAddress)==="string") &&
        isISwapInit(obj);
}

export class OnchainForGasSwap<T extends ChainType = ChainType> extends ISwap<T, OnchainForGasSwapState> {
    getSmartChainNetworkFee = null;
    protected readonly TYPE: SwapType = SwapType.TRUSTED_FROM_BTC;

    //State: PR_CREATED
    private readonly paymentHash: string;
    private readonly sequence: bigint;
    private readonly address: string;
    private readonly recipient: string;
    private readonly token: string;
    private inputAmount: bigint;
    private outputAmount: bigint;
    private refundAddress: string;

    //State: FINISHED
    scTxId: string;
    txId: string;

    //State: REFUNDED
    refundTxId: string;

    wrapper: OnchainForGasWrapper<T>;

    constructor(wrapper: OnchainForGasWrapper<T>, init: OnchainForGasSwapInit);
    constructor(wrapper: OnchainForGasWrapper<T>, obj: any);
    constructor(
        wrapper: OnchainForGasWrapper<T>,
        initOrObj: OnchainForGasSwapInit | any
    ) {
        if(isOnchainForGasSwapInit(initOrObj)) initOrObj.url += "/frombtc_trusted";
        super(wrapper, initOrObj);
        if(isOnchainForGasSwapInit(initOrObj)) {
            this.state = OnchainForGasSwapState.PR_CREATED;
        } else {
            this.paymentHash = initOrObj.paymentHash;
            this.sequence = initOrObj.sequence==null ? null : BigInt(initOrObj.sequence);
            this.address = initOrObj.address;
            this.inputAmount = initOrObj.inputAmount==null ? null : BigInt(initOrObj.inputAmount);
            this.outputAmount = initOrObj.outputAmount==null ? null : BigInt(initOrObj.outputAmount);
            this.recipient = initOrObj.recipient;
            this.token = initOrObj.token;
            this.refundAddress = initOrObj.refundAddress;
            this.scTxId = initOrObj.scTxId;
            this.txId = initOrObj.txId;
            this.refundTxId = initOrObj.refundTxId;
        }
        this.logger = getLogger("OnchainForGas("+this.getId()+"): ");
        this.tryCalculateSwapFee();

        if(this.pricingInfo.swapPriceUSatPerToken==null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(
                this.chainIdentifier,
                this.inputAmount,
                this.pricingInfo.satsBaseFee,
                this.pricingInfo.feePPM,
                this.outputAmount,
                this.token ?? this.wrapper.getNativeToken().address
            );
        }
    }

    protected upgradeVersion() {
        if(this.version == null) {
            //Noop
            this.version = 1;
        }
    }

    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryCalculateSwapFee() {
        if(this.swapFeeBtc==null) {
            this.swapFeeBtc = this.swapFee * this.getInput().rawAmount / this.getOutAmountWithoutFee();
        }
    }


    //////////////////////////////
    //// Pricing

    async refreshPriceData(): Promise<PriceInfoType> {
        if(this.pricingInfo==null) return null;
        const priceData = await this.wrapper.prices.isValidAmountReceive(
            this.chainIdentifier,
            this.inputAmount,
            this.pricingInfo.satsBaseFee,
            this.pricingInfo.feePPM,
            this.outputAmount,
            this.token ?? this.wrapper.getNativeToken().address
        );
        this.pricingInfo = priceData;
        return priceData;
    }

    getSwapPrice(): number {
        return Number(this.pricingInfo.swapPriceUSatPerToken) / 100000000000000;
    }

    getMarketPrice(): number {
        return Number(this.pricingInfo.realPriceUSatPerToken) / 100000000000000;
    }


    //////////////////////////////
    //// Getters & utils

    getInputAddress(): string | null {
        return this.address;
    }

    getOutputAddress(): string | null {
        return this.recipient;
    }

    getInputTxId(): string | null {
        return this.txId;
    }

    getOutputTxId(): string | null {
        return this.scTxId;
    }

    getRecipient(): string {
        return this.recipient;
    }

    getEscrowHash(): string {
        return this.paymentHash;
    }

    getId(): string {
        return this.paymentHash;
    }

    getAddress(): string {
        return this.address;
    }

    /**
     * Returns bitcoin address where the on-chain BTC should be sent to
     */
    getBitcoinAddress(): string {
        return this.address;
    }

    getQrData(): string {
        return "bitcoin:"+this.address+"?amount="+encodeURIComponent((Number(this.inputAmount)/100000000).toString(10));
    }

    getTimeoutTime(): number {
        return this.expiry;
    }

    isFinished(): boolean {
        return this.state===OnchainForGasSwapState.FINISHED || this.state===OnchainForGasSwapState.FAILED || this.state===OnchainForGasSwapState.EXPIRED || this.state===OnchainForGasSwapState.REFUNDED;
    }

    isQuoteExpired(): boolean {
        return this.state===OnchainForGasSwapState.EXPIRED;
    }

    isQuoteSoftExpired(): boolean {
        return this.expiry<Date.now();
    }

    isFailed(): boolean {
        return this.state===OnchainForGasSwapState.FAILED;
    }

    isSuccessful(): boolean {
        return this.state===OnchainForGasSwapState.FINISHED;
    }

    isQuoteValid(): Promise<boolean> {
        return Promise.resolve(this.getTimeoutTime()>Date.now());
    }

    isActionable(): boolean {
        return this.state===OnchainForGasSwapState.REFUNDABLE;
    }

    //////////////////////////////
    //// Amounts & fees

    protected getOutAmountWithoutFee(): bigint {
        return this.outputAmount + this.swapFee;
    }

    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.outputAmount, this.wrapper.tokens[this.wrapper.chain.getNativeCurrencyAddress()], this.wrapper.prices);
    }

    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken<false>> {
        return toTokenAmount(this.inputAmount - this.swapFeeBtc, BitcoinTokens.BTC, this.wrapper.prices);
    }

    getInput(): TokenAmount<T["ChainId"], BtcToken<false>> {
        return toTokenAmount(this.inputAmount, BitcoinTokens.BTC, this.wrapper.prices);
    }

    getSwapFee(): Fee {
        return {
            amountInSrcToken: toTokenAmount(this.swapFeeBtc, BitcoinTokens.BTC, this.wrapper.prices),
            amountInDstToken: toTokenAmount(this.swapFee, this.wrapper.tokens[this.wrapper.chain.getNativeCurrencyAddress()], this.wrapper.prices),
            usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) =>
                this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }

    getRealSwapFeePercentagePPM(): bigint {
        const feeWithoutBaseFee = this.swapFeeBtc - this.pricingInfo.satsBaseFee;
        return feeWithoutBaseFee * 1000000n / this.getInputWithoutFee().rawAmount;
    }


    //////////////////////////////
    //// Payment

    async estimateBitcoinFee(wallet: IBitcoinWallet, feeRate?: number): Promise<number> {
        return wallet.getTransactionFee(this.address, this.inputAmount, feeRate);
    }

    async checkAddress(save: boolean = true): Promise<boolean> {
        if(
            this.state===OnchainForGasSwapState.FAILED ||
            this.state===OnchainForGasSwapState.EXPIRED ||
            this.state===OnchainForGasSwapState.REFUNDED
        ) return false;
        if(this.state===OnchainForGasSwapState.FINISHED) return false;

        const response = await TrustedIntermediaryAPI.getAddressStatus(
            this.url, this.paymentHash, this.sequence, this.wrapper.options.getRequestTimeout
        );
        switch(response.code) {
            case AddressStatusResponseCodes.AWAIT_PAYMENT:
                if(this.txId!=null) {
                    this.txId = null;
                    if(save) await this._save();
                    return true;
                }
                return false;
            case AddressStatusResponseCodes.AWAIT_CONFIRMATION:
            case AddressStatusResponseCodes.PENDING:
            case AddressStatusResponseCodes.TX_SENT:
                const inputAmount = BigInt(response.data.adjustedAmount);
                const outputAmount = BigInt(response.data.adjustedTotal);
                const adjustedFee = response.data.adjustedFee==null ? null : BigInt(response.data.adjustedFee);
                const adjustedFeeSats = response.data.adjustedFeeSats==null ? null : BigInt(response.data.adjustedFeeSats);
                const txId = response.data.txId;
                if(
                    this.txId!=txId ||
                    this.inputAmount !== inputAmount ||
                    this.outputAmount !== outputAmount
                ) {
                    this.txId = txId;
                    this.inputAmount = inputAmount;
                    this.outputAmount = outputAmount;
                    if(adjustedFee!=null) this.swapFee = adjustedFee;
                    if(adjustedFeeSats!=null) this.swapFeeBtc = adjustedFeeSats;
                    if(save) await this._save();
                    return true;
                }
                return false;
            case AddressStatusResponseCodes.PAID:
                const txStatus = await this.wrapper.chain.getTxIdStatus(response.data.txId);
                if(txStatus==="success") {
                    this.state = OnchainForGasSwapState.FINISHED;
                    this.scTxId = response.data.txId;
                    if(save) await this._saveAndEmit();
                    return true;
                }
                return false;
            case AddressStatusResponseCodes.EXPIRED:
                this.state = OnchainForGasSwapState.EXPIRED;
                if(save) await this._saveAndEmit();
                return true;
            case AddressStatusResponseCodes.REFUNDABLE:
                if(this.state===OnchainForGasSwapState.REFUNDABLE) return null;
                this.state = OnchainForGasSwapState.REFUNDABLE;
                if(save) await this._saveAndEmit();
                return true;
            case AddressStatusResponseCodes.REFUNDED:
                this.state = OnchainForGasSwapState.REFUNDED;
                this.refundTxId = response.data.txId;
                if(save) await this._saveAndEmit();
                return true;
            default:
                this.state = OnchainForGasSwapState.FAILED;
                if(save) await this._saveAndEmit();
                return true;
        }
    }

    /**
     * A blocking promise resolving when payment was received by the intermediary and client can continue
     * rejecting in case of failure
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    async waitForPayment(
        abortSignal?: AbortSignal,
        checkIntervalSeconds: number = 5,
        updateCallback?: (txId: string, txEtaMs: number) => void
    ): Promise<boolean> {
        if(this.state!==OnchainForGasSwapState.PR_CREATED) throw new Error("Must be in PR_CREATED state!");

        if(!this.initiated) {
            this.initiated = true;
            await this._saveAndEmit();
        }

        while(
            !abortSignal.aborted &&
            this.state===OnchainForGasSwapState.PR_CREATED
        ) {
            await this.checkAddress(true);
            if(this.txId!=null && updateCallback!=null) {
                const res = await this.wrapper.btcRpc.getTransaction(this.txId);
                if(res==null) {
                    updateCallback(null, null);
                } else if(res.confirmations>0) {
                    updateCallback(res.txid, 0);
                } else {
                    const delay = await this.wrapper.btcRpc.getConfirmationDelay(res, 1);
                    updateCallback(res.txid, delay);
                }
            }
            if(this.state===OnchainForGasSwapState.PR_CREATED)
                await timeoutPromise(checkIntervalSeconds*1000, abortSignal);
        }

        if(
            (this.state as OnchainForGasSwapState)===OnchainForGasSwapState.REFUNDABLE ||
            (this.state as OnchainForGasSwapState)===OnchainForGasSwapState.REFUNDED
        ) return false;
        if(this.isQuoteExpired()) throw new PaymentAuthError("Swap expired");
        if(this.isFailed()) throw new PaymentAuthError("Swap failed");
        return true;
    }

    async waitTillRefunded(
        abortSignal?: AbortSignal,
        checkIntervalSeconds: number = 5,
    ): Promise<void> {
        if(this.state===OnchainForGasSwapState.REFUNDED) return;
        if(this.state!==OnchainForGasSwapState.REFUNDABLE) throw new Error("Must be in REFUNDABLE state!");

        while(
            !abortSignal.aborted &&
            this.state===OnchainForGasSwapState.REFUNDABLE
        ) {
            await this.checkAddress(true);
            if(this.state===OnchainForGasSwapState.REFUNDABLE)
                await timeoutPromise(checkIntervalSeconds*1000, abortSignal);
        }
        if(this.isQuoteExpired()) throw new PaymentAuthError("Swap expired");
        if(this.isFailed()) throw new PaymentAuthError("Swap failed");
    }

    async setRefundAddress(refundAddress: string): Promise<void> {
        if(this.refundAddress!=null) {
            if(this.refundAddress!==refundAddress) throw new Error("Different refund address already set!");
            return;
        }
        await TrustedIntermediaryAPI.setRefundAddress(
            this.url, this.paymentHash, this.sequence, refundAddress, this.wrapper.options.getRequestTimeout
        );
        this.refundAddress = refundAddress;
    }

    async requestRefund(refundAddress?: string, abortSignal?: AbortSignal): Promise<void> {
        if(refundAddress!=null) await this.setRefundAddress(refundAddress);
        await this.waitTillRefunded(abortSignal);
    }


    //////////////////////////////
    //// Storage

    serialize(): any{
        return {
            ...super.serialize(),
            paymentHash: this.paymentHash,
            sequence: this.sequence==null ? null : this.sequence.toString(10),
            address: this.address,
            inputAmount: this.inputAmount==null ? null : this.inputAmount.toString(10),
            outputAmount: this.outputAmount==null ? null : this.outputAmount.toString(10),
            recipient: this.recipient,
            token: this.token,
            refundAddress: this.refundAddress,
            scTxId: this.scTxId,
            txId: this.txId,
            refundTxId: this.refundTxId,
        };
    }

    getInitiator(): string {
        return this.recipient;
    }

    hasEnoughForTxFees(): Promise<{ enoughBalance: boolean; balance: TokenAmount; required: TokenAmount }> {
        return Promise.resolve({
            balance: toTokenAmount(0n, this.wrapper.getNativeToken(), this.wrapper.prices),
            enoughBalance: true,
            required: toTokenAmount(0n, this.wrapper.getNativeToken(), this.wrapper.prices)
        });
    }


    //////////////////////////////
    //// Swap ticks & sync

    async _sync(save?: boolean): Promise<boolean> {
        if(this.state===OnchainForGasSwapState.PR_CREATED) {
            //Check if it's maybe already paid
            const result = await this.checkAddress(false);
            if(result) {
                if(save) await this._saveAndEmit();
                return true;
            }
        }
        return false;
    }

    _tick(save?: boolean): Promise<boolean> {
        return Promise.resolve(false);
    }

}
