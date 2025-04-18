
import {IFromBTCWrapper} from "./IFromBTCWrapper";
import {Fee, ISwap, ISwapInit} from "../ISwap";
import {
    ChainType,
    SignatureVerificationError,
} from "@atomiqlabs/base";
import {PriceInfoType} from "../../prices/abstract/ISwapPrice";
import {BtcToken, SCToken, TokenAmount, toTokenAmount} from "../Tokens";


export abstract class IFromBTCSwap<
    T extends ChainType = ChainType,
    S extends number = number
> extends ISwap<T, S> {
    protected abstract readonly inputToken: BtcToken;

    protected constructor(wrapper: IFromBTCWrapper<T, IFromBTCSwap<T, S>>, init: ISwapInit<T["Data"]>);
    protected constructor(wrapper: IFromBTCWrapper<T, IFromBTCSwap<T, S>>, obj: any);
    protected constructor(
        wrapper: IFromBTCWrapper<T, IFromBTCSwap<T, S>>,
        initOrObj: ISwapInit<T["Data"]> | any
    ) {
        super(wrapper, initOrObj);
    }

    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryCalculateSwapFee() {
        if(this.swapFeeBtc==null) {
            this.swapFeeBtc = this.swapFee * this.getInput().rawAmount / this.getOutAmountWithoutFee();
        }

        if(this.pricingInfo.swapPriceUSatPerToken==null) {
            this.pricingInfo = this.wrapper.prices.recomputePriceInfoReceive(
                this.chainIdentifier,
                this.getInput().rawAmount,
                this.pricingInfo.satsBaseFee,
                this.pricingInfo.feePPM,
                this.getSwapData().getAmount(),
                this.getSwapData().getToken()
            );
        }
    }

    protected getSwapData(): T["Data"] {
        return this.data;
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
            this.getSwapData().getAmount(),
            this.getSwapData().getToken()
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

    getRealSwapFeePercentagePPM(): bigint {
        const feeWithoutBaseFee = this.swapFeeBtc - this.pricingInfo.satsBaseFee;
        return feeWithoutBaseFee * 1000000n / this.getInputWithoutFee().rawAmount;
    }


    //////////////////////////////
    //// Getters & utils

    abstract getInputTxId(): string | null;

    getOutputTxId(): string | null {
        return this.claimTxId;
    }

    getInputAddress(): string | null {
        return this.getAddress();
    }

    getOutputAddress(): string | null {
        return this.getInitiator();
    }

    /**
     * Returns the bitcoin address or lightning invoice to be paid for the swap
     */
    abstract getAddress(): string;

    /**
     * Returns a string that can be displayed as QR code representation of the address or lightning invoice
     *  (with bitcoin: or lightning: prefix)
     */
    abstract getQrData(): string;

    abstract isClaimable(): boolean;

    isActionable(): boolean {
        return this.isClaimable();
    }

    /**
     * Returns if the swap can be committed
     */
    abstract canCommit(): boolean;


    //////////////////////////////
    //// Amounts & fees

    protected getOutAmountWithoutFee(): bigint {
        return this.getSwapData().getAmount() + this.swapFee;
    }

    getOutputWithoutFee(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.getSwapData().getAmount() + this.swapFee, this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices);
    }

    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.getSwapData().getAmount(), this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices);
    }

    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken> {
        return toTokenAmount(this.getInput().rawAmount - this.swapFeeBtc, this.inputToken, this.wrapper.prices);
    }

    getSwapFee(): Fee {
        return {
            amountInSrcToken: toTokenAmount(this.swapFeeBtc, this.inputToken, this.wrapper.prices),
            amountInDstToken: toTokenAmount(this.swapFee, this.wrapper.tokens[this.getSwapData().getToken()], this.wrapper.prices),
            usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) =>
                this.wrapper.prices.getBtcUsdValue(this.swapFeeBtc, abortSignal, preFetchedUsdPrice)
        };
    }

    getSecurityDeposit(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.getSwapData().getSecurityDeposit(), this.wrapper.getNativeToken(), this.wrapper.prices);
    }

    getTotalDeposit(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.getSwapData().getTotalDeposit(), this.wrapper.getNativeToken(), this.wrapper.prices);
    }

    getInitiator(): string {
        return this.getSwapData().getClaimer();
    }

    getClaimFee(): Promise<bigint> {
        return this.wrapper.contract.getClaimFee(this.getInitiator(), this.getSwapData());
    }

    async hasEnoughForTxFees(): Promise<{enoughBalance: boolean, balance: TokenAmount, required: TokenAmount}> {
        const [balance, commitFee] = await Promise.all([
            this.wrapper.contract.getBalance(this.getInitiator(), this.wrapper.contract.getNativeCurrencyAddress(), false),
            this.getCommitFee()
        ]);
        const totalFee = commitFee + this.getSwapData().getTotalDeposit();
        return {
            enoughBalance: balance >= totalFee,
            balance: toTokenAmount(balance, this.wrapper.getNativeToken(), this.wrapper.prices),
            required: toTokenAmount(totalFee, this.wrapper.getNativeToken(), this.wrapper.prices)
        };
    }


    //////////////////////////////
    //// Commit

    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in an HTLC or PTLC
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    abstract commit(signer: T["Signer"], abortSignal?: AbortSignal, skipChecks?: boolean): Promise<string>;

    /**
     * Returns the transactions required for committing the swap on-chain, locking the tokens from the intermediary
     *  in an HTLC or PTLC
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} When in invalid state to commit the swap
     */
    async txsCommit(skipChecks?: boolean): Promise<T["TX"][]> {
        if(!this.canCommit()) throw new Error("Must be in CREATED state!");

        if(!this.initiated) {
            this.initiated = true;
            await this._saveAndEmit();
        }

        return await this.wrapper.contract.txsInit(
            this.data, this.signatureData, skipChecks, this.feeRate
        ).catch(e => Promise.reject(e instanceof SignatureVerificationError ? new Error("Request timed out") : e));
    }

    abstract waitTillCommited(abortSignal?: AbortSignal): Promise<void>;


    //////////////////////////////
    //// Claim

    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    abstract claim(signer: T["Signer"], abortSignal?: AbortSignal): Promise<string>;

    abstract txsClaim(signer?: T["Signer"]): Promise<T["TX"][]>;

    /**
     * Waits till the swap is successfully claimed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be COMMIT)
     */
    abstract waitTillClaimed(abortSignal?: AbortSignal): Promise<void>;

}
