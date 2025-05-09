import {SwapType} from "./SwapType";
import {EventEmitter} from "events";
import {Buffer} from "buffer";
import {ISwapWrapper} from "./ISwapWrapper";
import {ChainType, SignatureData, SignatureVerificationError, SwapCommitStatus, SwapData} from "@atomiqlabs/base";
import {isPriceInfoType, PriceInfoType} from "../prices/abstract/ISwapPrice";
import {LoggerType, randomBytes, timeoutPromise, tryWithRetries} from "../utils/Utils";
import {SCToken, Token, TokenAmount, toTokenAmount} from "./Tokens";
import {SwapDirection} from "./SwapDirection";

export type ISwapInit<T extends SwapData> = {
    pricingInfo: PriceInfoType,
    url: string,
    expiry: number,
    swapFee: bigint,
    swapFeeBtc?: bigint,
    feeRate: any,
    signatureData?: SignatureData,
    data?: T,
    exactIn: boolean
};

export function isISwapInit<T extends SwapData>(obj: any): obj is ISwapInit<T> {
    return typeof obj === 'object' &&
        obj != null &&
        isPriceInfoType(obj.pricingInfo) &&
        typeof obj.url === 'string' &&
        typeof obj.expiry === 'number' &&
        typeof(obj.swapFee) === "bigint" &&
        (obj.swapFeeBtc == null || typeof(obj.swapFeeBtc) === "bigint") &&
        obj.feeRate != null &&
        (obj.signatureData == null || (
            typeof(obj.signatureData) === 'object' &&
            typeof(obj.signatureData.prefix)==="string" &&
            typeof(obj.signatureData.timeout)==="string" &&
            typeof(obj.signatureData.signature)==="string"
        )) &&
        (obj.data == null || typeof obj.data === 'object') &&
        (typeof obj.exactIn === 'boolean');
}

export type Fee<
    ChainIdentifier extends string = string,
    TSrc extends Token<ChainIdentifier> = Token<ChainIdentifier>,
    TDst extends Token<ChainIdentifier> = Token<ChainIdentifier>
> = {
    amountInSrcToken: TokenAmount<ChainIdentifier, TSrc>;
    amountInDstToken: TokenAmount<ChainIdentifier, TDst>;
    usdValue: (abortSignal?: AbortSignal, preFetchedUsdPrice?: number) => Promise<number>;
}

export abstract class ISwap<
    T extends ChainType = ChainType,
    S extends number = number
> {
    readonly chainIdentifier: string;
    readonly exactIn: boolean;
    readonly createdAt: number;

    protected readonly currentVersion: number = 1;
    protected version: number;
    protected initiated: boolean = false;
    protected logger: LoggerType;
    protected readonly abstract TYPE: SwapType;
    protected readonly wrapper: ISwapWrapper<T, ISwap<T, S>>;
    expiry?: number;
    readonly url: string;

    state: S;

    pricingInfo: PriceInfoType;

    data: T["Data"];
    signatureData?: SignatureData;
    feeRate?: any;

    protected swapFee: bigint;
    protected swapFeeBtc?: bigint;

    /**
     * Transaction IDs for the swap on the smart chain side
     */
    commitTxId: string;
    refundTxId?: string;
    claimTxId?: string;

    /**
     * Random nonce to differentiate the swap from others with the same identifier hash (i.e. when quoting the same swap
     *  from multiple LPs)
     */
    randomNonce: string;

    /**
     * Event emitter emitting "swapState" event when swap's state changes
     */
    events: EventEmitter = new EventEmitter();

    protected constructor(wrapper: ISwapWrapper<T, ISwap<T, S>>, obj: any);
    protected constructor(wrapper: ISwapWrapper<T, ISwap<T, S>>, swapInit: ISwapInit<T["Data"]>);
    protected constructor(
        wrapper: ISwapWrapper<T, ISwap<T, S>>,
        swapInitOrObj: ISwapInit<T["Data"]> | any,
    ) {
        this.chainIdentifier = wrapper.chainIdentifier;
        this.wrapper = wrapper;
        if(isISwapInit(swapInitOrObj)) {
            Object.assign(this, swapInitOrObj);
            this.version = this.currentVersion;
            this.createdAt = Date.now();
            this.randomNonce = randomBytes(16).toString("hex");
        } else {
            this.expiry = swapInitOrObj.expiry;
            this.url = swapInitOrObj.url;

            this.state = swapInitOrObj.state;

            this.pricingInfo = {
                isValid: swapInitOrObj._isValid,
                differencePPM: swapInitOrObj._differencePPM==null ? null : BigInt(swapInitOrObj._differencePPM),
                satsBaseFee: swapInitOrObj._satsBaseFee==null ? null : BigInt(swapInitOrObj._satsBaseFee),
                feePPM: swapInitOrObj._feePPM==null ? null : BigInt(swapInitOrObj._feePPM),
                realPriceUSatPerToken: swapInitOrObj._realPriceUSatPerToken==null ? null : BigInt(swapInitOrObj._realPriceUSatPerToken),
                swapPriceUSatPerToken: swapInitOrObj._swapPriceUSatPerToken==null ? null : BigInt(swapInitOrObj._swapPriceUSatPerToken),
            };

            this.data = swapInitOrObj.data!=null ? new wrapper.swapDataDeserializer(swapInitOrObj.data) : null;
            this.swapFee = swapInitOrObj.swapFee==null ? null : BigInt(swapInitOrObj.swapFee);
            this.swapFeeBtc = swapInitOrObj.swapFeeBtc==null ? null : BigInt(swapInitOrObj.swapFeeBtc);
            this.signatureData = swapInitOrObj.signature==null ? null : {
                prefix: swapInitOrObj.prefix,
                timeout: swapInitOrObj.timeout,
                signature: swapInitOrObj.signature
            };
            this.feeRate = swapInitOrObj.feeRate;

            this.commitTxId = swapInitOrObj.commitTxId;
            this.claimTxId = swapInitOrObj.claimTxId;
            this.refundTxId = swapInitOrObj.refundTxId;

            this.version = swapInitOrObj.version;
            this.initiated = swapInitOrObj.initiated;
            this.exactIn = swapInitOrObj.exactIn;
            this.createdAt = swapInitOrObj.createdAt ?? swapInitOrObj.expiry;

            this.randomNonce = swapInitOrObj.randomNonce;
        }
        if(this.version!==this.currentVersion) {
            this.upgradeVersion();
        }
        if(this.initiated==null) this.initiated = true;
    }

    protected abstract upgradeVersion(): void;

    /**
     * Periodically checks for init signature's expiry
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected async watchdogWaitTillSignatureExpiry(abortSignal?: AbortSignal, interval: number = 5): Promise<void> {
        let expired = false
        while(!expired) {
            await timeoutPromise(interval*1000, abortSignal);
            try {
                expired = await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData);
            } catch (e) {
                this.logger.warn("watchdogWaitTillSignatureExpiry(): Error when checking signature expiry: ", e);
            }
        }
        if(abortSignal!=null) abortSignal.throwIfAborted();
    }

    /**
     * Periodically checks the chain to see whether the swap is committed
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected async watchdogWaitTillCommited(abortSignal?: AbortSignal, interval: number = 5): Promise<boolean> {
        let status: SwapCommitStatus = SwapCommitStatus.NOT_COMMITED;
        while(status===SwapCommitStatus.NOT_COMMITED) {
            await timeoutPromise(interval*1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data);
                if(
                    status===SwapCommitStatus.NOT_COMMITED &&
                    await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData)
                ) return false;
            } catch (e) {
                this.logger.warn("watchdogWaitTillCommited(): Error when fetching commit status or signature expiry: ", e);
            }
        }
        if(abortSignal!=null) abortSignal.throwIfAborted();
        return true;
    }

    /**
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected async watchdogWaitTillResult(abortSignal?: AbortSignal, interval: number = 5): Promise<
        SwapCommitStatus.PAID | SwapCommitStatus.EXPIRED | SwapCommitStatus.NOT_COMMITED
    > {
        let status: SwapCommitStatus = SwapCommitStatus.COMMITED;
        while(status===SwapCommitStatus.COMMITED || status===SwapCommitStatus.REFUNDABLE) {
            await timeoutPromise(interval*1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data);
            } catch (e) {
                this.logger.warn("watchdogWaitTillResult(): Error when fetching commit status: ", e);
            }
        }
        if(abortSignal!=null) abortSignal.throwIfAborted();
        return status;
    }

    /**
     * Waits till the swap reaches a specific state
     *
     * @param targetState The state to wait for
     * @param type Whether to wait for the state exactly or also to a state with a higher number
     * @param abortSignal
     * @protected
     */
    protected waitTillState(targetState: S, type: "eq" | "gte" | "neq" = "eq", abortSignal?: AbortSignal): Promise<void> {
        return new Promise((resolve, reject) => {
            let listener;
            listener = (swap) => {
                if(type==="eq" ? swap.state===targetState : type==="gte" ? swap.state>=targetState : swap.state!=targetState) {
                    resolve();
                    this.events.removeListener("swapState", listener);
                }
            };
            this.events.on("swapState", listener);
            if(abortSignal!=null) abortSignal.addEventListener("abort", () => {
                this.events.removeListener("swapState", listener);
                reject(abortSignal.reason);
            });
        });
    }


    //////////////////////////////
    //// Pricing

    /**
     * Checks if the pricing for the swap is valid, according to max allowed price difference set in the ISwapPrice
     */
    hasValidPrice(): boolean {
        return this.pricingInfo==null ? null : this.pricingInfo.isValid;
    }

    /**
     * Returns the price difference between offered price and current market price in PPM (parts per million)
     */
    getPriceDifferencePPM(): bigint {
        return this.pricingInfo==null ? null :this.pricingInfo.differencePPM;
    }

    /**
     * Returns the price difference between offered price and current market price as a decimal number
     */
    getPriceDifferencePct(): number {
        return this.pricingInfo==null ? null : this.pricingInfo.differencePPM==null ? null : Number(this.pricingInfo.differencePPM)/1000000;
    }

    /**
     * Re-fetches & revalidates the price data
     */
    abstract refreshPriceData(): Promise<PriceInfoType>;

    /**
     * Returns the offered swap quote price
     */
    abstract getSwapPrice(): number;

    /**
     * Returns the real current market price fetched from reputable exchanges
     */
    abstract getMarketPrice(): number;

    /**
     * Returns the real swap fee percentage as PPM (parts per million)
     */
    abstract getRealSwapFeePercentagePPM(): bigint;

    //////////////////////////////
    //// Getters & utils

    abstract getInputTxId(): string | null;

    abstract getOutputTxId(): string | null;

    abstract getInputAddress(): string | null;

    abstract getOutputAddress(): string | null;

    /**
     * Returns the escrow hash - i.e. hash of the escrow data
     */
    getEscrowHash(): string | null {
        return this.data?.getEscrowHash();
    }

    /**
     * Returns the claim data hash - i.e. hash passed to the claim handler
     */
    getClaimHash(): string {
        return this.data?.getClaimHash();
    }

    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHash(): Buffer {
        const claimHashBuffer = Buffer.from(this.getClaimHash(), "hex");
        if(this.randomNonce==null) return claimHashBuffer;
        return Buffer.concat([claimHashBuffer, Buffer.from(this.randomNonce, "hex")]);
    }

    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHashString(): string {
        const paymentHash = this.getIdentifierHash();
        if(paymentHash==null) return null;
        return paymentHash.toString("hex");
    }

    /**
     * Returns the ID of the swap, as used in the storage and getSwapById function
     */
    getId(): string {
        return this.getIdentifierHashString();
    }

    /**
     * Returns quote expiry in UNIX millis
     */
    getExpiry(): number {
        return this.expiry;
    }

    /**
     * Returns the type of the swap
     */
    getType(): SwapType {
        return this.TYPE;
    }

    /**
     * Returns the direction of the swap
     */
    getDirection(): SwapDirection {
        return this.TYPE===SwapType.FROM_BTCLN || this.TYPE===SwapType.FROM_BTC ? SwapDirection.FROM_BTC : SwapDirection.TO_BTC;
    }

    /**
     * Returns the current state of the swap
     */
    getState(): S {
        return this.state;
    }

    /**
     * Returns whether the swap is finished and in its terminal state (this can mean successful, refunded or failed)
     */
    abstract isFinished(): boolean;

    /**
     * Checks whether the swap's quote has definitely expired and cannot be committed anymore, we can remove such swap
     */
    abstract isQuoteExpired(): boolean;

    /**
     * Checks whether the swap's quote is soft expired (this means there is not enough time buffer for it to commit,
     *  but it still can happen)
     */
    abstract isQuoteSoftExpired(): boolean;

    /**
     * Returns whether the swap finished successful
     */
    abstract isSuccessful(): boolean;

    /**
     * Returns whether the swap failed (e.g. was refunded)
     */
    abstract isFailed(): boolean;

    /**
     * Returns the intiator address of the swap - address that created this swap
     */
    abstract getInitiator(): string;

    /**
     * @param signer Signer to check with this swap's initiator
     * @throws {Error} When signer's address doesn't match with the swap's initiator one
     */
    checkSigner(signer: T["Signer"] | string): void {
        if((typeof(signer)==="string" ? signer : signer.getAddress())!==this.getInitiator()) throw new Error("Invalid signer provided!");
    }

    /**
     * Checks if the swap's quote is still valid
     */
    async isQuoteValid(): Promise<boolean> {
        try {
            await tryWithRetries(
                () => this.wrapper.contract.isValidInitAuthorization(
                    this.data, this.signatureData, this.feeRate
                ),
                null,
                SignatureVerificationError
            );
            return true;
        } catch (e) {
            if(e instanceof SignatureVerificationError) {
                return false;
            }
            throw e;
        }
    }

    /**
     * Checks if the swap's quote is expired for good (i.e. the swap strictly cannot be committed on-chain anymore)
     */
    async isQuoteDefinitelyExpired(): Promise<boolean> {
        return tryWithRetries(
            () => this.wrapper.contract.isInitAuthorizationExpired(
                this.data, this.signatureData
            )
        );
    }

    isInitiated(): boolean {
        return this.initiated;
    }

    /**
     * Checks whether there is some action required from the user for this swap - can mean either refundable or claimable
     */
    abstract isActionable(): boolean;

    //////////////////////////////
    //// Amounts & fees

    /**
     * Get the estimated smart chain fee of the commit transaction
     */
    getCommitFee(): Promise<bigint> {
        return this.wrapper.contract.getCommitFee(this.data, this.feeRate);
    }

    /**
     * Returns output amount of the swap, user receives this much
     */
    abstract getOutput(): TokenAmount;

    /**
     * Returns input amount of the swap, user needs to pay this much
     */
    abstract getInput(): TokenAmount;

    /**
     * Returns input amount if the swap without the fees (swap fee, network fee)
     */
    abstract getInputWithoutFee(): TokenAmount;

    /**
     * Returns total fee for the swap, the fee is represented in source currency & destination currency, but is
     *  paid only once
     */
    getFee(): Fee {
        return this.getSwapFee();
    }

    /**
     * Returns swap fee for the swap, the fee is represented in source currency & destination currency, but is
     *  paid only once
     */
    abstract getSwapFee(): Fee;

    /**
     * Returns the transaction fee paid on the smart chain
     */
    async getSmartChainNetworkFee(): Promise<TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>> {
        const swapContract: T["Contract"] & {getRawCommitFee?: (data: T["Data"], feeRate?: string) => Promise<bigint>} = this.wrapper.contract;
        return toTokenAmount(
            await (
                swapContract.getRawCommitFee!=null ?
                    swapContract.getRawCommitFee(this.data, this.feeRate) :
                    swapContract.getCommitFee(this.data, this.feeRate)
            ),
            this.wrapper.getNativeToken(),
            this.wrapper.prices
        );
    }

    /**
     * Checks if the initiator/sender has enough balance to cover the transaction fee for processing the swap
     */
    abstract hasEnoughForTxFees(): Promise<{enoughBalance: boolean, balance: TokenAmount, required: TokenAmount}>;

    //////////////////////////////
    //// Storage

    serialize(): any {
        if(this.pricingInfo==null) return {};
        return {
            id: this.getIdentifierHashString(),
            type: this.getType(),
            escrowHash: this.getEscrowHash(),
            initiator: this.getInitiator(),

            _isValid: this.pricingInfo.isValid,
            _differencePPM: this.pricingInfo.differencePPM==null ? null :this.pricingInfo.differencePPM.toString(10),
            _satsBaseFee: this.pricingInfo.satsBaseFee==null ? null :this.pricingInfo.satsBaseFee.toString(10),
            _feePPM: this.pricingInfo.feePPM==null ? null :this.pricingInfo.feePPM.toString(10),
            _realPriceUSatPerToken: this.pricingInfo.realPriceUSatPerToken==null ? null :this.pricingInfo.realPriceUSatPerToken.toString(10),
            _swapPriceUSatPerToken: this.pricingInfo.swapPriceUSatPerToken==null ? null :this.pricingInfo.swapPriceUSatPerToken.toString(10),
            state: this.state,
            url: this.url,
            data: this.data!=null ? this.data.serialize() : null,
            swapFee: this.swapFee==null ? null : this.swapFee.toString(10),
            swapFeeBtc: this.swapFeeBtc==null ? null : this.swapFeeBtc.toString(10),
            prefix: this.signatureData?.prefix,
            timeout: this.signatureData?.timeout,
            signature: this.signatureData?.signature,
            feeRate: this.feeRate==null ? null : this.feeRate.toString(),
            commitTxId: this.commitTxId,
            claimTxId: this.claimTxId,
            refundTxId: this.refundTxId,
            expiry: this.expiry,
            version: this.version,
            initiated: this.initiated,
            exactIn: this.exactIn,
            createdAt: this.createdAt,
            randomNonce: this.randomNonce
        }
    }

    _save(): Promise<void> {
        if(this.isQuoteExpired()) {
            return this.wrapper.removeSwapData(this);
        } else {
            return this.wrapper.saveSwapData(this);
        }
    }

    async _saveAndEmit(state?: S): Promise<void> {
        if(state!=null) this.state = state;
        await this._save();
        this._emitEvent();
    }


    //////////////////////////////
    //// Events

    _emitEvent() {
        this.wrapper.events.emit("swapState", this);
        this.events.emit("swapState", this);
    }


    //////////////////////////////
    //// Swap ticks & sync

    /**
     * Synchronizes swap state from chain and/or LP node, usually ran on startup
     *
     * @param save whether to save the new swap state or not
     *
     * @returns {boolean} true if the swap changed, false if the swap hasn't changed
     */
    abstract _sync(save?: boolean): Promise<boolean>;

    /**
     * Runs quick checks on the swap, such as checking the expiry, usually ran periodically every few seconds
     *
     * @param save whether to save the new swap state or not
     *
     * @returns {boolean} true if the swap changed, false if the swap hasn't changed
     */
    abstract _tick(save?: boolean): Promise<boolean>;

}
