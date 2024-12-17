import {SwapType} from "../../SwapType";
import * as BN from "bn.js";
import {ChainType, SwapData} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {PaymentAuthError} from "../../../errors/PaymentAuthError";
import {getLogger, timeoutPromise} from "../../../utils/Utils";
import {Fee, isISwapInit, ISwap, ISwapInit} from "../../ISwap";
import {PriceInfoType} from "../../../prices/abstract/ISwapPrice";
import {
    AddressStatusResponseCodes,
    TrustedIntermediaryAPI
} from "../../../intermediaries/TrustedIntermediaryAPI";
import {BitcoinTokens, BtcToken, SCToken, TokenAmount, toTokenAmount} from "../../Tokens";
import {OnchainForGasWrapper} from "./OnchainForGasWrapper";

export enum OnchainForGasSwapState {
    EXPIRED = -3,
    FAILED = -2,
    REFUNDED = -1,
    PR_CREATED = 0,
    FINISHED = 1,
    REFUNDABLE = 2
}

export type OnchainForGasSwapInit<T extends SwapData> = ISwapInit<T> & {
    paymentHash: string;
    sequence: BN;
    address: string;
    inputAmount: BN;
    outputAmount: BN;
    recipient: string;
    refundAddress?: string;
};

export function isOnchainForGasSwapInit<T extends SwapData>(obj: any): obj is OnchainForGasSwapInit<T> {
    return typeof(obj.paymentHash)==="string" &&
        BN.isBN(obj.sequence) &&
        typeof(obj.address)==="string" &&
        BN.isBN(obj.inputAmount) &&
        BN.isBN(obj.outputAmount) &&
        typeof(obj.recipient)==="string" &&
        (obj.refundAddress==null || typeof(obj.refundAddress)==="string") &&
        isISwapInit<T>(obj);
}

export class OnchainForGasSwap<T extends ChainType = ChainType> extends ISwap<T, OnchainForGasSwapState> {
    protected readonly TYPE: SwapType = SwapType.FROM_BTC;

    //State: PR_CREATED
    private readonly paymentHash: string;
    private readonly sequence: BN;
    private readonly address: string;
    private readonly recipient: string;
    private inputAmount: BN;
    private outputAmount: BN;
    private refundAddress: string;

    //State: FINISHED
    scTxId: string;
    txId: string;

    //State: REFUNDED
    refundTxId: string;

    wrapper: OnchainForGasWrapper<T>;

    constructor(wrapper: OnchainForGasWrapper<T>, init: OnchainForGasSwapInit<T["Data"]>);
    constructor(wrapper: OnchainForGasWrapper<T>, obj: any);
    constructor(
        wrapper: OnchainForGasWrapper<T>,
        initOrObj: OnchainForGasSwapInit<T["Data"]> | any
    ) {
        if(isOnchainForGasSwapInit(initOrObj)) initOrObj.url += "/frombtc_trusted";
        super(wrapper, initOrObj);
        if(isOnchainForGasSwapInit(initOrObj)) {
            this.state = OnchainForGasSwapState.PR_CREATED;
        } else {
            this.paymentHash = initOrObj.paymentHash;
            this.sequence = initOrObj.sequence==null ? null : new BN(initOrObj.sequence);
            this.address = initOrObj.address;
            this.inputAmount = initOrObj.inputAmount==null ? null : new BN(initOrObj.inputAmount);
            this.outputAmount = initOrObj.outputAmount==null ? null : new BN(initOrObj.outputAmount);
            this.recipient = initOrObj.recipient;
            this.refundAddress = initOrObj.refundAddress;
            this.scTxId = initOrObj.scTxId;
            this.txId = initOrObj.txId;
            this.refundTxId = initOrObj.refundTxId;
        }
        this.tryCalculateSwapFee();
        this.logger = getLogger(this.constructor.name+"("+this.getPaymentHashString()+"): ");

        if(this.pricingInfo.swapPriceUSatPerToken==null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(
                this.chainIdentifier,
                this.getInput().rawAmount,
                this.pricingInfo.satsBaseFee,
                this.pricingInfo.feePPM,
                this.data.getAmount(),
                this.data.getToken()
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
            this.swapFeeBtc = this.swapFee.mul(this.getInput().rawAmount).div(this.getOutAmountWithoutFee());
        }
    }


    //////////////////////////////
    //// Pricing

    async refreshPriceData(): Promise<PriceInfoType> {
        if(this.pricingInfo==null) return null;
        const priceData = await this.wrapper.prices.isValidAmountReceive(
            this.chainIdentifier,
            this.getInput().rawAmount,
            this.pricingInfo.satsBaseFee,
            this.pricingInfo.feePPM,
            this.data.getAmount(),
            this.data.getToken()
        );
        this.pricingInfo = priceData;
        return priceData;
    }

    getSwapPrice(): number {
        return this.pricingInfo.swapPriceUSatPerToken.toNumber()/100000000000000;
    }

    getMarketPrice(): number {
        return this.pricingInfo.realPriceUSatPerToken.toNumber()/100000000000000;
    }


    //////////////////////////////
    //// Getters & utils

    getTxId(): string | null {
        return this.scTxId;
    }

    getRecipient(): string {
        return this.recipient;
    }

    getPaymentHash(): Buffer {
        return Buffer.from(this.paymentHash, "hex");
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
        return "bitcoin:"+this.address+"?amount="+encodeURIComponent((this.inputAmount.toNumber()/100000000).toString(10));
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
        return this.isQuoteExpired();
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

    protected getOutAmountWithoutFee(): BN {
        return this.outputAmount.add(this.swapFee);
    }

    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.outputAmount, this.wrapper.tokens[this.wrapper.contract.getNativeCurrencyAddress()], this.wrapper.prices);
    }

    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken<false>> {
        return toTokenAmount(this.inputAmount.sub(this.swapFeeBtc), BitcoinTokens.BTC, this.wrapper.prices);
    }

    getInput(): TokenAmount<T["ChainId"], BtcToken<false>> {
        return toTokenAmount(this.inputAmount, BitcoinTokens.BTC, this.wrapper.prices);
    }

    getSwapFee(): Fee {
        return {
            amountInSrcToken: toTokenAmount(this.swapFeeBtc, BitcoinTokens.BTC, this.wrapper.prices),
            amountInDstToken: toTokenAmount(this.swapFee, this.wrapper.tokens[this.wrapper.contract.getNativeCurrencyAddress()], this.wrapper.prices),
            usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) =>
                this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }

    getRealSwapFeePercentagePPM(): BN {
        const feeWithoutBaseFee = this.swapFeeBtc.sub(this.pricingInfo.satsBaseFee);
        return feeWithoutBaseFee.mul(new BN(1000000)).div(this.getInputWithoutFee().rawAmount);
    }


    //////////////////////////////
    //// Payment

    async checkAddress(save: boolean = true): Promise<boolean> {
        if(
            this.state===OnchainForGasSwapState.FAILED ||
            this.state===OnchainForGasSwapState.EXPIRED ||
            this.state===OnchainForGasSwapState.REFUNDED
        ) return false;
        if(this.state===OnchainForGasSwapState.FINISHED) return true;

        const response = await TrustedIntermediaryAPI.getAddressStatus(
            this.url, this.paymentHash, this.sequence, this.wrapper.options.getRequestTimeout
        );
        switch(response.code) {
            case AddressStatusResponseCodes.AWAIT_PAYMENT:
                if(this.txId!=null) {
                    this.txId = null;
                    if(save) await this._save();
                }
                return null;
            case AddressStatusResponseCodes.AWAIT_CONFIRMATION:
            case AddressStatusResponseCodes.PENDING:
            case AddressStatusResponseCodes.TX_SENT:
                const inputAmount = new BN(response.data.adjustedAmount, 10);
                const outputAmount = new BN(response.data.adjustedTotal, 10);
                const txId = response.data.txId;
                if(
                    this.txId!=txId ||
                    !this.inputAmount.eq(inputAmount) ||
                    !this.outputAmount.eq(outputAmount)
                ) {
                    this.txId = txId;
                    this.inputAmount = inputAmount;
                    this.outputAmount = outputAmount;
                    if(save) await this._save();
                }
                return null;
            case AddressStatusResponseCodes.PAID:
                const txStatus = await this.wrapper.contract.getTxIdStatus(response.data.txId);
                if(txStatus==="success") {
                    this.state = OnchainForGasSwapState.FINISHED;
                    this.scTxId = response.data.txId;
                    if(save) await this._saveAndEmit();
                    return true;
                }
                return null;
            case AddressStatusResponseCodes.EXPIRED:
                this.state = OnchainForGasSwapState.EXPIRED;
                if(save) await this._saveAndEmit();
                return false;
            case AddressStatusResponseCodes.REFUNDABLE:
                if(this.state===OnchainForGasSwapState.REFUNDABLE) return null;
                this.state = OnchainForGasSwapState.REFUNDABLE;
                if(save) await this._saveAndEmit();
                return true;
            case AddressStatusResponseCodes.REFUNDED:
                this.state = OnchainForGasSwapState.REFUNDED;
                this.refundTxId = response.data.txId;
                if(save) await this._saveAndEmit();
                return false;
            default:
                this.state = OnchainForGasSwapState.FAILED;
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
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    async waitForPayment(
        abortSignal?: AbortSignal,
        checkIntervalSeconds: number = 5,
        updateCallback?: (txId: string, txEtaMs: number) => void
    ): Promise<void> {
        if(this.state!==OnchainForGasSwapState.PR_CREATED && this.state!==OnchainForGasSwapState.REFUNDABLE) throw new Error("Must be in PR_CREATED state!");

        if(!this.initiated) {
            this.initiated = true;
            await this._saveAndEmit();
        }

        while(
            !abortSignal.aborted &&
            (this.state===OnchainForGasSwapState.PR_CREATED || this.state===OnchainForGasSwapState.REFUNDABLE)
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
            if(this.state===OnchainForGasSwapState.PR_CREATED || this.state===OnchainForGasSwapState.REFUNDABLE)
                await timeoutPromise(checkIntervalSeconds*1000, abortSignal);
        }

        if(this.isQuoteExpired()) throw new PaymentAuthError("Swap expired");
        if(this.isFailed()) throw new PaymentAuthError("Swap failed");
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
            refundAddress: this.refundAddress,
            scTxId: this.scTxId,
            txId: this.txId,
            refundTxId: this.refundTxId,
        };
    }

    getInitiator(): string {
        return this.recipient;
    }

}