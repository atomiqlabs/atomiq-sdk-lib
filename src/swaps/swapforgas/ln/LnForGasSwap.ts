import {decode as bolt11Decode} from "@atomiqlabs/bolt11";
import {SwapType} from "../../SwapType";
import {ChainType, SwapData} from "@atomiqlabs/base";
import {LnForGasWrapper} from "./LnForGasWrapper";
import {Buffer} from "buffer";
import {PaymentAuthError} from "../../../errors/PaymentAuthError";
import {getLogger, timeoutPromise} from "../../../utils/Utils";
import {Fee, isISwapInit, ISwap, ISwapInit} from "../../ISwap";
import {PriceInfoType} from "../../../prices/abstract/ISwapPrice";
import {
    InvoiceStatusResponseCodes,
    TrustedIntermediaryAPI
} from "../../../intermediaries/TrustedIntermediaryAPI";
import {BitcoinTokens, BtcToken, SCToken, TokenAmount, toTokenAmount} from "../../Tokens";

export enum LnForGasSwapState {
    EXPIRED = -2,
    FAILED = -1,
    PR_CREATED = 0,
    PR_PAID = 1,
    FINISHED = 2
}

export type LnForGasSwapInit<T extends SwapData> = ISwapInit<T> & {
    pr: string;
    outputAmount: bigint;
    recipient: string;
    token: string;
};

export function isLnForGasSwapInit<T extends SwapData>(obj: any): obj is LnForGasSwapInit<T> {
    return typeof(obj.pr)==="string" &&
        typeof(obj.outputAmount) === "bigint" &&
        typeof(obj.recipient)==="string" &&
        typeof(obj.token)==="string" &&
        isISwapInit<T>(obj);
}

export class LnForGasSwap<T extends ChainType = ChainType> extends ISwap<T, LnForGasSwapState> {
    getSmartChainNetworkFee = null;
    protected readonly currentVersion: number = 2;
    protected readonly TYPE: SwapType = SwapType.TRUSTED_FROM_BTCLN;

    //State: PR_CREATED
    private readonly pr: string;
    private readonly outputAmount: bigint;
    private readonly recipient: string;
    private readonly token: string;

    //State: FINISHED
    scTxId: string;

    constructor(wrapper: LnForGasWrapper<T>, init: LnForGasSwapInit<T["Data"]>);
    constructor(wrapper: LnForGasWrapper<T>, obj: any);
    constructor(
        wrapper: LnForGasWrapper<T>,
        initOrObj: LnForGasSwapInit<T["Data"]> | any
    ) {
        if(isLnForGasSwapInit(initOrObj)) initOrObj.url += "/lnforgas";
        super(wrapper, initOrObj);
        if(isLnForGasSwapInit(initOrObj)) {
            this.state = LnForGasSwapState.PR_CREATED;
        } else {
            this.pr = initOrObj.pr;
            this.outputAmount = initOrObj.outputAmount==null ? null : BigInt(initOrObj.outputAmount);
            this.recipient = initOrObj.recipient;
            this.token = initOrObj.token;
            this.scTxId = initOrObj.scTxId;
        }
        this.tryCalculateSwapFee();
        this.logger = getLogger("LnForGas("+this.getIdentifierHashString()+"): ");

        if(this.pricingInfo.swapPriceUSatPerToken==null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(
                this.chainIdentifier,
                this.getInput().rawAmount,
                this.pricingInfo.satsBaseFee ?? 10n,
                this.pricingInfo.feePPM ?? 10000n,
                this.outputAmount,
                this.token ?? this.wrapper.getNativeToken().address
            );
        }
    }

    protected upgradeVersion() {
        if(this.version == 1) {
            if(this.state===1) this.state = LnForGasSwapState.FINISHED;
            this.version = 2;
        }
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
            this.getInput().rawAmount,
            this.pricingInfo.satsBaseFee ?? 10n,
            this.pricingInfo.feePPM ?? 10000n,
            this.outputAmount,
            this.token ?? this.wrapper.getNativeToken().address
        );
        this.pricingInfo = priceData;
        return priceData;
    }

    getSwapPrice(): number {
        return Number(this.pricingInfo.swapPriceUSatPerToken)/100000000000000;
    }

    getMarketPrice(): number {
        return Number(this.pricingInfo.realPriceUSatPerToken)/100000000000000;
    }


    //////////////////////////////
    //// Getters & utils

    getInputAddress(): string | null {
        return this.pr;
    }

    getOutputAddress(): string | null {
        return this.recipient;
    }

    getInputTxId(): string | null {
        return this.getPaymentHash().toString("hex");
    }

    getOutputTxId(): string | null {
        return this.scTxId;
    }

    getRecipient(): string {
        return this.recipient;
    }

    getIdentifierHash(): Buffer {
        return this.getPaymentHash();
    }

    getPaymentHash(): Buffer {
        if(this.pr==null) return null;
        const decodedPR = bolt11Decode(this.pr);
        return Buffer.from(decodedPR.tagsObject.payment_hash, "hex");
    }

    /**
     * Returns the lightning network BOLT11 invoice that needs to be paid as an input to the swap
     */
    getLightningInvoice(): string {
        return this.pr;
    }

    /**
     * Returns a string that can be displayed as QR code representation of the lightning invoice (with lightning: prefix)
     */
    getQrData(): string {
        return "lightning:"+this.pr.toUpperCase();
    }

    getTimeoutTime(): number {
        if(this.pr==null) return null;
        const decoded = bolt11Decode(this.pr);
        return (decoded.timeExpireDate*1000);
    }

    isFinished(): boolean {
        return this.state===LnForGasSwapState.FINISHED || this.state===LnForGasSwapState.FAILED || this.state===LnForGasSwapState.EXPIRED;
    }

    isQuoteExpired(): boolean {
        return this.state===LnForGasSwapState.EXPIRED;
    }

    isQuoteSoftExpired(): boolean {
        return this.getTimeoutTime()<Date.now();
    }

    isFailed(): boolean {
        return this.state===LnForGasSwapState.FAILED;
    }

    isSuccessful(): boolean {
        return this.state===LnForGasSwapState.FINISHED;
    }

    isQuoteValid(): Promise<boolean> {
        return Promise.resolve(this.getTimeoutTime()>Date.now());
    }

    isActionable(): boolean {
        return false;
    }

    //////////////////////////////
    //// Amounts & fees

    protected getOutAmountWithoutFee(): bigint {
        return this.outputAmount + this.swapFee;
    }

    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.outputAmount, this.wrapper.tokens[this.wrapper.contract.getNativeCurrencyAddress()], this.wrapper.prices);
    }

    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken<true>> {
        const parsed = bolt11Decode(this.pr);
        const amount = (BigInt(parsed.millisatoshis) + 999n) / 1000n;
        return toTokenAmount(amount - this.swapFeeBtc, BitcoinTokens.BTCLN, this.wrapper.prices);
    }

    getInput(): TokenAmount<T["ChainId"], BtcToken<true>> {
        const parsed = bolt11Decode(this.pr);
        const amount = (BigInt(parsed.millisatoshis) + 999n) / 1000n;
        return toTokenAmount(amount, BitcoinTokens.BTCLN, this.wrapper.prices);
    }

    getSwapFee(): Fee {
        return {
            amountInSrcToken: toTokenAmount(this.swapFeeBtc, BitcoinTokens.BTCLN, this.wrapper.prices),
            amountInDstToken: toTokenAmount(this.swapFee, this.wrapper.tokens[this.wrapper.contract.getNativeCurrencyAddress()], this.wrapper.prices),
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

    async checkInvoicePaid(save: boolean = true): Promise<boolean> {
        if(this.state===LnForGasSwapState.FAILED || this.state===LnForGasSwapState.EXPIRED) return false;
        if(this.state===LnForGasSwapState.FINISHED) return true;

        const decodedPR = bolt11Decode(this.pr);
        const paymentHash = decodedPR.tagsObject.payment_hash;

        const response = await TrustedIntermediaryAPI.getInvoiceStatus(
            this.url, paymentHash, this.wrapper.options.getRequestTimeout
        );
        this.logger.debug("checkInvoicePaid(): LP response: ", response);
        switch(response.code) {
            case InvoiceStatusResponseCodes.PAID:
                this.scTxId = response.data.txId;
                const txStatus = await this.wrapper.contract.getTxIdStatus(this.scTxId);
                if(txStatus==="success") {
                    this.state = LnForGasSwapState.FINISHED;
                    if(save) await this._saveAndEmit();
                    return true;
                }
                return null;
            case InvoiceStatusResponseCodes.EXPIRED:
                if(this.state===LnForGasSwapState.PR_CREATED) {
                    this.state = LnForGasSwapState.EXPIRED;
                } else {
                    this.state = LnForGasSwapState.FAILED;
                }
                if(save) await this._saveAndEmit();
                return false;
            case InvoiceStatusResponseCodes.TX_SENT:
                this.scTxId = response.data.txId;
                if(this.state===LnForGasSwapState.PR_CREATED) {
                    this.state = LnForGasSwapState.PR_PAID;
                    if(save) await this._saveAndEmit();
                }
                return null;
            case InvoiceStatusResponseCodes.PENDING:
                if(this.state===LnForGasSwapState.PR_CREATED) {
                    this.state = LnForGasSwapState.PR_PAID;
                    if(save) await this._saveAndEmit();
                }
                return null;
            case InvoiceStatusResponseCodes.AWAIT_PAYMENT:
                return null;
            default:
                this.state = LnForGasSwapState.FAILED;
                if(save) await this._saveAndEmit();
                return false;
        }
    }

    /**
     * A blocking promise resolving when payment was received by the intermediary and client can continue
     * rejecting in case of failure
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    async waitForPayment(abortSignal?: AbortSignal, checkIntervalSeconds: number = 5): Promise<void> {
        if(this.state!==LnForGasSwapState.PR_CREATED) throw new Error("Must be in PR_CREATED state!");

        if(!this.initiated) {
            this.initiated = true;
            await this._saveAndEmit();
        }

        while(!abortSignal.aborted && (this.state===LnForGasSwapState.PR_CREATED || this.state===LnForGasSwapState.PR_PAID)) {
            await this.checkInvoicePaid(true);
            if(this.state===LnForGasSwapState.PR_CREATED || this.state===LnForGasSwapState.PR_PAID) await timeoutPromise(checkIntervalSeconds*1000, abortSignal);
        }

        if(this.isFailed()) throw new PaymentAuthError("Swap failed");
        if(this.isQuoteExpired()) throw new PaymentAuthError("Swap expired");
    }


    //////////////////////////////
    //// Storage

    serialize(): any{
        return {
            ...super.serialize(),
            pr: this.pr,
            outputAmount: this.outputAmount==null ? null : this.outputAmount.toString(10),
            recipient: this.recipient,
            token: this.token,
            scTxId: this.scTxId
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
        if(this.state===LnForGasSwapState.PR_CREATED) {
            //Check if it's maybe already paid
            const res = await this.checkInvoicePaid(false);
            if(res!==null) {
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