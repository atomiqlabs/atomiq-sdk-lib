import {decode as bolt11Decode} from "@atomiqlabs/bolt11";
import {FromBTCLNWrapper} from "./FromBTCLNWrapper";
import {IFromBTCSwap} from "../IFromBTCSwap";
import {SwapType} from "../../../enums/SwapType";
import {
    ChainType,
    SignatureData,
    SignatureVerificationError,
    SwapCommitState,
    SwapCommitStateType,
    SwapData
} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {LNURL, LNURLWithdraw, LNURLWithdrawParamsWithUrl} from "../../../../utils/LNURL";
import {UserError} from "../../../../errors/UserError";
import {
    IntermediaryAPI,
    PaymentAuthorizationResponse,
    PaymentAuthorizationResponseCodes
} from "../../../../intermediaries/IntermediaryAPI";
import {IntermediaryError} from "../../../../errors/IntermediaryError";
import {extendAbortController, getLogger, timeoutPromise, tryWithRetries} from "../../../../utils/Utils";
import {BitcoinTokens, BtcToken, SCToken, TokenAmount, toTokenAmount} from "../../../../Tokens";
import {IEscrowSwapInit, isIEscrowSwapInit} from "../../IEscrowSwap";

export enum FromBTCLNSwapState {
    FAILED = -4,
    QUOTE_EXPIRED = -3,
    QUOTE_SOFT_EXPIRED = -2,
    EXPIRED = -1,
    PR_CREATED = 0,
    PR_PAID = 1,
    CLAIM_COMMITED = 2,
    CLAIM_CLAIMED = 3
}

export type FromBTCLNSwapInit<T extends SwapData> = IEscrowSwapInit<T> & {
    pr: string,
    secret: string,
    initialSwapData: T,
    lnurl?: string,
    lnurlK1?: string,
    lnurlCallback?: string
};

export function isFromBTCLNSwapInit<T extends SwapData>(obj: any): obj is FromBTCLNSwapInit<T> {
    return typeof obj.pr==="string" &&
        typeof obj.secret==="string" &&
        (obj.lnurl==null || typeof(obj.lnurl)==="string") &&
        (obj.lnurlK1==null || typeof(obj.lnurlK1)==="string") &&
        (obj.lnurlCallback==null || typeof(obj.lnurlCallback)==="string") &&
        isIEscrowSwapInit(obj);
}

export class FromBTCLNSwap<T extends ChainType = ChainType> extends IFromBTCSwap<T, FromBTCLNSwapState> {
    protected readonly inputToken: BtcToken<true> = BitcoinTokens.BTCLN;
    protected readonly TYPE = SwapType.FROM_BTCLN;

    protected readonly lnurlFailSignal: AbortController = new AbortController();

    protected readonly pr: string;
    protected readonly secret: string;
    protected initialSwapData: T["Data"];

    lnurl?: string;
    lnurlK1?: string;
    lnurlCallback?: string;
    prPosted?: boolean = false;

    wrapper: FromBTCLNWrapper<T>;

    protected getSwapData(): T["Data"] {
        return this.data ?? this.initialSwapData;
    }

    constructor(wrapper: FromBTCLNWrapper<T>, init: FromBTCLNSwapInit<T["Data"]>);
    constructor(wrapper: FromBTCLNWrapper<T>, obj: any);
    constructor(
        wrapper: FromBTCLNWrapper<T>,
        initOrObject: FromBTCLNSwapInit<T["Data"]> | any
    ) {
        if(isFromBTCLNSwapInit(initOrObject)) initOrObject.url += "/frombtcln";
        super(wrapper, initOrObject);
        if(isFromBTCLNSwapInit(initOrObject)) {
            this.state = FromBTCLNSwapState.PR_CREATED;
        } else {
            this.pr = initOrObject.pr;
            this.secret = initOrObject.secret;

            this.initialSwapData = initOrObject.initialSwapData==null ? null : SwapData.deserialize<T["Data"]>(initOrObject.initialSwapData);

            this.lnurl = initOrObject.lnurl;
            this.lnurlK1 = initOrObject.lnurlK1;
            this.lnurlCallback = initOrObject.lnurlCallback;
            this.prPosted = initOrObject.prPosted;

            if(this.state===FromBTCLNSwapState.PR_CREATED && this.data!=null) {
                this.initialSwapData = this.data;
                delete this.data;
            }
        }
        this.tryRecomputeSwapPrice();
        this.logger = getLogger("FromBTCLN("+this.getIdentifierHashString()+"): ");
    }

    protected upgradeVersion() {
        if (this.version == null) {
            switch (this.state) {
                case -2:
                    this.state = FromBTCLNSwapState.QUOTE_EXPIRED;
                    break;
                case -1:
                    this.state = FromBTCLNSwapState.FAILED;
                    break;
                case 0:
                    this.state = FromBTCLNSwapState.PR_CREATED
                    break;
                case 1:
                    this.state = FromBTCLNSwapState.PR_PAID
                    break;
                case 2:
                    this.state = FromBTCLNSwapState.CLAIM_COMMITED
                    break;
                case 3:
                    this.state = FromBTCLNSwapState.CLAIM_CLAIMED
                    break;
            }
            this.version = 1;
        }
    }

    //////////////////////////////
    //// Getters & utils

    protected getIdentifierHash(): Buffer {
        const paymentHashBuffer = this.getPaymentHash();
        if(this.randomNonce==null) return paymentHashBuffer;
        return Buffer.concat([paymentHashBuffer, Buffer.from(this.randomNonce, "hex")]);
    }

    protected getPaymentHash(): Buffer {
        if(this.pr==null) return null;
        const decodedPR = bolt11Decode(this.pr);
        return Buffer.from(decodedPR.tagsObject.payment_hash, "hex");
    }

    protected canCommit(): boolean {
        return this.state===FromBTCLNSwapState.PR_PAID;
    }

    getInputTxId(): string | null {
        return this.getPaymentHash().toString("hex");
    }

    /**
     * Returns the lightning network BOLT11 invoice that needs to be paid as an input to the swap
     */
    getAddress(): string {
        return this.pr;
    }

    getHyperlink(): string {
        return "lightning:"+this.pr.toUpperCase();
    }

    /**
     * Returns timeout time (in UNIX milliseconds) when the LN invoice will expire
     */
    getTimeoutTime(): number {
        if(this.pr==null) return null;
        const decoded = bolt11Decode(this.pr);
        return (decoded.timeExpireDate*1000);
    }

    /**
     * Returns timeout time (in UNIX milliseconds) when the swap htlc will expire
     */
    getHtlcTimeoutTime(): number {
        return Number(this.wrapper.getHtlcTimeout(this.data))*1000;
    }

    isFinished(): boolean {
        return this.state===FromBTCLNSwapState.CLAIM_CLAIMED || this.state===FromBTCLNSwapState.QUOTE_EXPIRED || this.state===FromBTCLNSwapState.FAILED;
    }

    isClaimable(): boolean {
        return this.state===FromBTCLNSwapState.PR_PAID || this.state===FromBTCLNSwapState.CLAIM_COMMITED;
    }

    isSuccessful(): boolean {
        return this.state===FromBTCLNSwapState.CLAIM_CLAIMED;
    }

    isFailed(): boolean {
        return this.state===FromBTCLNSwapState.FAILED || this.state===FromBTCLNSwapState.EXPIRED;
    }

    isQuoteExpired(): boolean {
        return this.state===FromBTCLNSwapState.QUOTE_EXPIRED;
    }

    isQuoteSoftExpired(): boolean {
        return this.state===FromBTCLNSwapState.QUOTE_EXPIRED || this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED;
    }

    verifyQuoteValid(): Promise<boolean> {
        if(
            this.state===FromBTCLNSwapState.PR_CREATED ||
            (this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData==null)
        ) {
            return Promise.resolve(this.getTimeoutTime()>Date.now());
        }
        return super.verifyQuoteValid();
    }


    //////////////////////////////
    //// Amounts & fees

    getInput(): TokenAmount<T["ChainId"], BtcToken<true>> {
        const parsed = bolt11Decode(this.pr);
        const amount = (BigInt(parsed.millisatoshis) + 999n) / 1000n;
        return toTokenAmount(amount, this.inputToken, this.wrapper.prices);
    }

    async getSmartChainNetworkFee(): Promise<TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>> {
        return toTokenAmount(await this.getCommitAndClaimFee(), this.wrapper.getNativeToken(), this.wrapper.prices);
    }

    async hasEnoughForTxFees(): Promise<{enoughBalance: boolean, balance: TokenAmount, required: TokenAmount}> {
        const [balance, feeRate] = await Promise.all([
            this.wrapper.contract.getBalance(this._getInitiator(), this.wrapper.chain.getNativeCurrencyAddress(), false),
            this.feeRate!=null ? Promise.resolve<string>(this.feeRate) : this.wrapper.contract.getInitFeeRate(
                this.getSwapData().getOfferer(),
                this.getSwapData().getClaimer(),
                this.getSwapData().getToken(),
                this.getSwapData().getClaimHash()
            )
        ]);
        const commitFee = await this.wrapper.contract.getCommitFee(this.getSwapData(), feeRate);
        const claimFee = await this.wrapper.contract.getClaimFee(this._getInitiator(), this.getSwapData(), feeRate);
        const totalFee = commitFee + claimFee + this.getSwapData().getTotalDeposit();
        return {
            enoughBalance: balance >= totalFee,
            balance: toTokenAmount(balance, this.wrapper.getNativeToken(), this.wrapper.prices),
            required: toTokenAmount(totalFee, this.wrapper.getNativeToken(), this.wrapper.prices)
        };
    }


    //////////////////////////////
    //// Payment

    /**
     * Checks whether the LP received the LN payment and we can continue by committing & claiming the HTLC on-chain
     *
     * @param save If the new swap state should be saved
     */
    protected async checkIntermediaryPaymentReceived(save: boolean = true): Promise<boolean | null> {
        if(
            this.state===FromBTCLNSwapState.PR_PAID ||
            this.state===FromBTCLNSwapState.CLAIM_COMMITED ||
            this.state===FromBTCLNSwapState.CLAIM_CLAIMED ||
            this.state===FromBTCLNSwapState.FAILED
        ) return true;
        if(this.state===FromBTCLNSwapState.QUOTE_EXPIRED || (this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData!=null)) return false;
        const resp = await IntermediaryAPI.getPaymentAuthorization(this.url, this.getPaymentHash().toString("hex"));
        switch(resp.code) {
            case PaymentAuthorizationResponseCodes.AUTH_DATA:
                const data = new this.wrapper.swapDataDeserializer(resp.data.data);
                try {
                    await this.checkIntermediaryReturnedAuthData(this._getInitiator(), data, resp.data);
                    this.expiry = await tryWithRetries(() => this.wrapper.contract.getInitAuthorizationExpiry(
                        data,
                        resp.data
                    ));
                    this.state = FromBTCLNSwapState.PR_PAID;
                    delete this.initialSwapData;
                    this.data = data;
                    this.signatureData = {
                        prefix: resp.data.prefix,
                        timeout: resp.data.timeout,
                        signature: resp.data.signature
                    };
                    this.initiated = true;
                    if(save) await this._saveAndEmit();
                    return true;
                } catch (e) {}
                return null;
            case PaymentAuthorizationResponseCodes.EXPIRED:
                this.state = FromBTCLNSwapState.QUOTE_EXPIRED;
                this.initiated = true;
                if(save) await this._saveAndEmit();
                return false;
            default:
                return null;
        }
    }

    /**
     * Checks the data returned by the intermediary in the payment auth request
     *
     * @param signer Smart chain signer's address initiating the swap
     * @param data Parsed swap data as returned by the intermediary
     * @param signature Signature data as returned by the intermediary
     * @protected
     * @throws {IntermediaryError} If the returned are not valid
     * @throws {SignatureVerificationError} If the returned signature is not valid
     * @throws {Error} If the swap is already committed on-chain
     */
    protected async checkIntermediaryReturnedAuthData(signer: string, data: T["Data"], signature: SignatureData): Promise<void> {
        data.setClaimer(signer);

        if (data.getOfferer() !== this.getSwapData().getOfferer()) throw new IntermediaryError("Invalid offerer used");
        if (!data.isToken(this.getSwapData().getToken())) throw new IntermediaryError("Invalid token used");
        if (data.getSecurityDeposit() > this.getSwapData().getSecurityDeposit()) throw new IntermediaryError("Invalid security deposit!");
        if (data.getAmount() < this.getSwapData().getAmount()) throw new IntermediaryError("Invalid amount received!");
        if (data.getClaimHash() !== this.getSwapData().getClaimHash()) throw new IntermediaryError("Invalid payment hash used!");
        if (!data.isDepositToken(this.getSwapData().getDepositToken())) throw new IntermediaryError("Invalid deposit token used!");

        await Promise.all([
            tryWithRetries(
                () => this.wrapper.contract.isValidInitAuthorization(this._getInitiator(), data, signature, this.feeRate),
                null,
                SignatureVerificationError
            ),
            tryWithRetries<SwapCommitState>(
                () => this.wrapper.contract.getCommitStatus(data.getClaimer(), data)
            ).then(status => {
                if (status?.type !== SwapCommitStateType.NOT_COMMITED)
                    throw new Error("Swap already committed on-chain!");
            })
        ]);
    }

    /**
     * Waits till an LN payment is received by the intermediary and client can continue commiting & claiming the HTLC
     *
     * @param abortSignal Abort signal to stop waiting for payment
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     */
    async waitForPayment(abortSignal?: AbortSignal, checkIntervalSeconds: number = 5): Promise<boolean> {
        if(
            this.state!==FromBTCLNSwapState.PR_CREATED &&
            (this.state!==FromBTCLNSwapState.QUOTE_SOFT_EXPIRED || this.signatureData!=null)
        ) throw new Error("Must be in PR_CREATED state!");

        const abortController = new AbortController();
        if(abortSignal!=null) abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));

        let save = false;

        if(this.lnurl!=null && !this.prPosted) {
            LNURL.postInvoiceToLNURLWithdraw({k1: this.lnurlK1, callback: this.lnurlCallback}, this.pr).catch(e => {
                this.lnurlFailSignal.abort(e);
            });
            this.prPosted = true;
            save ||= true;
        }

        if(!this.initiated) {
            this.initiated = true;
            save ||= true;
        }

        if(save) await this._saveAndEmit();

        let lnurlFailListener = () => abortController.abort(this.lnurlFailSignal.signal.reason);
        this.lnurlFailSignal.signal.addEventListener("abort", lnurlFailListener);
        this.lnurlFailSignal.signal.throwIfAborted();

        let resp: PaymentAuthorizationResponse = {code: PaymentAuthorizationResponseCodes.PENDING, msg: ""};
        while(!abortController.signal.aborted && resp.code===PaymentAuthorizationResponseCodes.PENDING) {
            resp = await IntermediaryAPI.getPaymentAuthorization(this.url, this.getPaymentHash().toString("hex"));
            if(resp.code===PaymentAuthorizationResponseCodes.PENDING)
                await timeoutPromise(checkIntervalSeconds*1000, abortController.signal);
        }
        this.lnurlFailSignal.signal.removeEventListener("abort", lnurlFailListener);
        abortController.signal.throwIfAborted();

        if(resp.code===PaymentAuthorizationResponseCodes.AUTH_DATA) {
            const sigData = resp.data;
            const swapData = new this.wrapper.swapDataDeserializer(resp.data.data);
            await this.checkIntermediaryReturnedAuthData(this._getInitiator(), swapData, sigData);
            this.expiry = await tryWithRetries(() => this.wrapper.contract.getInitAuthorizationExpiry(
                swapData,
                sigData
            ));
            if(this.state===FromBTCLNSwapState.PR_CREATED || this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
                delete this.initialSwapData;
                this.data = swapData;
                this.signatureData = {
                    prefix: sigData.prefix,
                    timeout: sigData.timeout,
                    signature: sigData.signature
                };
                await this._saveAndEmit(FromBTCLNSwapState.PR_PAID);
            }
            return true;
        }

        if(this.state===FromBTCLNSwapState.PR_CREATED || this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
            if(resp.code===PaymentAuthorizationResponseCodes.EXPIRED) {
                await this._saveAndEmit(FromBTCLNSwapState.QUOTE_EXPIRED);
            }

            return false;
        }
    }


    //////////////////////////////
    //// Commit

    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in an HTLC
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    async commit(signer: T["Signer"], abortSignal?: AbortSignal, skipChecks?: boolean): Promise<string> {
        this.checkSigner(signer);
        const result = await this.wrapper.chain.sendAndConfirm(
            signer, await this.txsCommit(skipChecks), true, abortSignal
        );

        this.commitTxId = result[0];
        if(this.state===FromBTCLNSwapState.PR_PAID || this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED) {
            await this._saveAndEmit(FromBTCLNSwapState.CLAIM_COMMITED);
        }
        return result[0];
    }

    async waitTillCommited(abortSignal?: AbortSignal): Promise<void> {
        if(this.state===FromBTCLNSwapState.CLAIM_COMMITED || this.state===FromBTCLNSwapState.CLAIM_CLAIMED) return Promise.resolve();
        if(this.state!==FromBTCLNSwapState.PR_PAID && (this.state!==FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData!=null)) throw new Error("Invalid state");

        const abortController = extendAbortController(abortSignal);
        const result = await Promise.race([
            this.watchdogWaitTillCommited(abortController.signal),
            this.waitTillState(FromBTCLNSwapState.CLAIM_COMMITED, "gte", abortController.signal).then(() => 0)
        ]);
        abortController.abort();

        if(result===0) this.logger.debug("waitTillCommited(): Resolved from state changed");
        if(result===true) this.logger.debug("waitTillCommited(): Resolved from watchdog - commited");
        if(result===false) {
            this.logger.debug("waitTillCommited(): Resolved from watchdog - signature expired");
            if(
                this.state===FromBTCLNSwapState.PR_PAID ||
                this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED
            ) {
                await this._saveAndEmit(FromBTCLNSwapState.QUOTE_EXPIRED);
            }
            return;
        }

        if(
            this.state===FromBTCLNSwapState.PR_PAID ||
            this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED
        ) {
            await this._saveAndEmit(FromBTCLNSwapState.CLAIM_COMMITED);
        }
    }


    //////////////////////////////
    //// Claim

    /**
     * Returns transactions required for claiming the HTLC and finishing the swap by revealing the HTLC secret
     *  (hash preimage)
     *
     * @param signer Optional signer address to use for claiming the swap, can also be different from the initializer
     * @throws {Error} If in invalid state (must be CLAIM_COMMITED)
     */
    txsClaim(signer?: T["Signer"]): Promise<T["TX"][]> {
        if(this.state!==FromBTCLNSwapState.CLAIM_COMMITED) throw new Error("Must be in CLAIM_COMMITED state!");
        return this.wrapper.contract.txsClaimWithSecret(signer ?? this._getInitiator(), this.data, this.secret, true, true);
    }

    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    async claim(signer: T["Signer"], abortSignal?: AbortSignal): Promise<string> {
        const result = await this.wrapper.chain.sendAndConfirm(
            signer, await this.txsClaim(), true, abortSignal
        );

        this.claimTxId = result[0];
        if(FromBTCLNSwapState.CLAIM_COMMITED || FromBTCLNSwapState.EXPIRED || FromBTCLNSwapState.FAILED) {
            await this._saveAndEmit(FromBTCLNSwapState.CLAIM_CLAIMED);
        }
        return result[0];
    }

    /**
     * Waits till the swap is successfully claimed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be BTC_TX_CONFIRMED)
     * @throws {Error} If the LP refunded sooner than we were able to claim
     */
    async waitTillClaimed(abortSignal?: AbortSignal): Promise<void> {
        if(this.state===FromBTCLNSwapState.CLAIM_CLAIMED) return Promise.resolve();
        if(this.state!==FromBTCLNSwapState.CLAIM_COMMITED) throw new Error("Invalid state (not CLAIM_COMMITED)");

        const abortController = new AbortController();
        if(abortSignal!=null) abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
        const res = await Promise.race([
            this.watchdogWaitTillResult(abortController.signal),
            this.waitTillState(FromBTCLNSwapState.CLAIM_CLAIMED, "eq", abortController.signal).then(() => 0 as const),
            this.waitTillState(FromBTCLNSwapState.EXPIRED, "eq", abortController.signal).then(() => 1 as const),
        ]);
        abortController.abort();

        if(res===0) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (CLAIM_CLAIMED)");
            return;
        }
        if(res===1) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (EXPIRED)");
            throw new Error("Swap expired during claiming");
        }
        this.logger.debug("waitTillClaimed(): Resolved from watchdog");

        if(res?.type===SwapCommitStateType.PAID) {
            if((this.state as FromBTCLNSwapState)!==FromBTCLNSwapState.CLAIM_CLAIMED) {
                this.claimTxId = await res.getClaimTxId();
                await this._saveAndEmit(FromBTCLNSwapState.CLAIM_CLAIMED);
            }
        }
        if(res?.type===SwapCommitStateType.NOT_COMMITED || res?.type===SwapCommitStateType.EXPIRED) {
            if(
                (this.state as FromBTCLNSwapState)!==FromBTCLNSwapState.CLAIM_CLAIMED &&
                (this.state as FromBTCLNSwapState)!==FromBTCLNSwapState.FAILED
            ) {
                this.refundTxId = res.getRefundTxId==null ? null : await res.getRefundTxId();
                await this._saveAndEmit(FromBTCLNSwapState.FAILED);
            }
        }
    }


    //////////////////////////////
    //// Commit & claim

    /**
     * Estimated transaction fee for commit & claim txs combined
     */
    async getCommitAndClaimFee(): Promise<bigint> {
        const swapContract: T["Contract"] = this.wrapper.contract;
        const feeRate = this.feeRate ?? await swapContract.getInitFeeRate(
            this.getSwapData().getOfferer(),
            this.getSwapData().getClaimer(),
            this.getSwapData().getToken(),
            this.getSwapData().getClaimHash()
        );
        const commitFee = await (
            swapContract.getRawCommitFee!=null ?
                swapContract.getRawCommitFee(this.getSwapData(), feeRate) :
                swapContract.getCommitFee(this.getSwapData(), feeRate)
        );
        const claimFee = await (
            swapContract.getRawClaimFee!=null ?
                swapContract.getRawClaimFee(this._getInitiator(), this.getSwapData(), feeRate) :
                swapContract.getClaimFee(this._getInitiator(), this.getSwapData(), feeRate)
        );
        return commitFee + claimFee;
    }

    canCommitAndClaimInOneShot(): boolean {
        return this.wrapper.contract.initAndClaimWithSecret!=null;
    }

    /**
     * Returns transactions for both commit & claim operation together, such that they can be signed all at once by
     *  the wallet. CAUTION: transactions must be sent sequentially, such that the claim (2nd) transaction is only
     *  sent after the commit (1st) transaction confirms. Failure to do so can reveal the HTLC pre-image too soon,
     *  opening a possibility for the LP to steal funds.
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     *
     * @throws {Error} If in invalid state (must be PR_PAID or CLAIM_COMMITED)
     */
    async txsCommitAndClaim(skipChecks?: boolean): Promise<T["TX"][]> {
        if(this.state===FromBTCLNSwapState.CLAIM_COMMITED) return await this.txsClaim();
        if(this.state!==FromBTCLNSwapState.PR_PAID && (this.state!==FromBTCLNSwapState.QUOTE_SOFT_EXPIRED || this.signatureData==null)) throw new Error("Must be in PR_PAID state!");

        const initTxs = await this.txsCommit(skipChecks);
        const claimTxs = await this.wrapper.contract.txsClaimWithSecret(this._getInitiator(), this.data, this.secret, true, true, null, true);

        return initTxs.concat(claimTxs);
    }

    /**
     * Commits and claims the swap, in a way that the transactions can be signed together by the underlying provider and
     *  then sent sequentially
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If in invalid state (must be PR_PAID or CLAIM_COMMITED)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    async commitAndClaim(signer: T["Signer"], abortSignal?: AbortSignal, skipChecks?: boolean): Promise<string[]> {
        if(!this.canCommitAndClaimInOneShot()) throw new Error("Cannot commitAndClaim in single action, please run commit and claim separately!");
        this.checkSigner(signer);
        if(this.state===FromBTCLNSwapState.CLAIM_COMMITED) return [null, await this.claim(signer)];

        const result = await this.wrapper.chain.sendAndConfirm(
            signer, await this.txsCommitAndClaim(skipChecks), true, abortSignal
        );

        this.commitTxId = result[0] || this.commitTxId;
        this.claimTxId = result[result.length-1] || this.claimTxId;
        if(this.state!==FromBTCLNSwapState.CLAIM_CLAIMED) {
            await this._saveAndEmit(FromBTCLNSwapState.CLAIM_CLAIMED);
        }

        return result;
    }


    //////////////////////////////
    //// LNURL

    /**
     * Is this an LNURL-withdraw swap?
     */
    isLNURL(): boolean {
        return this.lnurl!=null;
    }

    /**
     * Gets the used LNURL or null if this is not an LNURL-withdraw swap
     */
    getLNURL(): string | null {
        return this.lnurl;
    }

    /**
     * Pay the generated lightning network invoice with LNURL-withdraw
     */
    async settleWithLNURLWithdraw(lnurl: string | LNURLWithdraw): Promise<void> {
        if(this.lnurl!=null) throw new Error("Cannot settle LNURL-withdraw swap with different LNURL");
        let lnurlParams: LNURLWithdrawParamsWithUrl;
        if(typeof(lnurl)==="string") {
            const parsedLNURL = await LNURL.getLNURL(lnurl);
            if(parsedLNURL==null || parsedLNURL.tag!=="withdrawRequest")
                throw new UserError("Invalid LNURL-withdraw to settle the swap");
            lnurlParams = parsedLNURL;
        } else {
            lnurlParams = lnurl.params;
        }
        LNURL.useLNURLWithdraw(lnurlParams, this.pr).catch(e => this.lnurlFailSignal.abort(e));
        this.lnurl = lnurlParams.url;
        this.lnurlCallback = lnurlParams.callback;
        this.lnurlK1 = lnurlParams.k1;
        this.prPosted = true;
        await this._saveAndEmit();
    }


    //////////////////////////////
    //// Storage

    serialize(): any {
        return {
            ...super.serialize(),
            pr: this.pr,
            secret: this.secret,
            lnurl: this.lnurl,
            lnurlK1: this.lnurlK1,
            lnurlCallback: this.lnurlCallback,
            prPosted: this.prPosted,
            initialSwapData: this.initialSwapData==null ? null : this.initialSwapData.serialize()
        };
    }


    //////////////////////////////
    //// Swap ticks & sync

    /**
     * Checks the swap's state on-chain and compares it to its internal state, updates/changes it according to on-chain
     *  data
     *
     * @private
     */
    private async syncStateFromChain(): Promise<boolean> {

        //Check for expiry before the getCommitStatus to prevent race conditions
        let quoteExpired: boolean = false;
        if(this.state===FromBTCLNSwapState.PR_PAID || (this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData!=null)) {
            quoteExpired = await this.verifyQuoteDefinitelyExpired();
        }

        if(this.state===FromBTCLNSwapState.CLAIM_COMMITED || this.state===FromBTCLNSwapState.EXPIRED) {
            //Check if it's already successfully paid
            const commitStatus = await tryWithRetries(() => this.wrapper.contract.getCommitStatus(this._getInitiator(), this.data));
            if(commitStatus?.type===SwapCommitStateType.PAID) {
                if(this.claimTxId==null) this.claimTxId = await commitStatus.getClaimTxId();
                this.state = FromBTCLNSwapState.CLAIM_CLAIMED;
                return true;
            }

            if(commitStatus?.type===SwapCommitStateType.NOT_COMMITED || commitStatus?.type===SwapCommitStateType.EXPIRED) {
                if(this.refundTxId==null && commitStatus.getRefundTxId) this.refundTxId = await commitStatus.getRefundTxId();
                this.state = FromBTCLNSwapState.FAILED;
                return true;
            }
        }

        if(this.state===FromBTCLNSwapState.PR_PAID || (this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData!=null)) {
            //Check if it's already committed
            const status = await tryWithRetries(() => this.wrapper.contract.getCommitStatus(this._getInitiator(), this.data));
            switch(status?.type) {
                case SwapCommitStateType.COMMITED:
                    this.state = FromBTCLNSwapState.CLAIM_COMMITED;
                    return true;
                case SwapCommitStateType.EXPIRED:
                    if(this.refundTxId==null && status.getRefundTxId) this.refundTxId = await status.getRefundTxId();
                    this.state = FromBTCLNSwapState.QUOTE_EXPIRED;
                    return true;
                case SwapCommitStateType.PAID:
                    if(this.claimTxId==null) this.claimTxId = await status.getClaimTxId();
                    this.state = FromBTCLNSwapState.CLAIM_CLAIMED;
                    return true;
            }
        }

        //Set the state on expiry here
        if(this.state===FromBTCLNSwapState.PR_PAID || (this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData!=null)) {
            if(quoteExpired) {
                this.state = FromBTCLNSwapState.QUOTE_EXPIRED;
                return true;
            }
        }
    }

    async _sync(save?: boolean): Promise<boolean> {
        let changed = false;

        if(this.state===FromBTCLNSwapState.PR_CREATED || (this.state===FromBTCLNSwapState.QUOTE_SOFT_EXPIRED && this.signatureData==null)) {
            if(this.getTimeoutTime()<Date.now()) {
                this.state = FromBTCLNSwapState.QUOTE_SOFT_EXPIRED;
                changed ||= true;
            }

            const result = await this.checkIntermediaryPaymentReceived(false);
            if(result!==null) changed ||= true;
        }

        if(await this.syncStateFromChain()) changed = true;

        if(save && changed) await this._saveAndEmit();

        return changed;
    }

    async _tick(save?: boolean): Promise<boolean> {
        switch(this.state) {
            case FromBTCLNSwapState.PR_CREATED:
                if(this.getTimeoutTime()<Date.now()) {
                    this.state = FromBTCLNSwapState.QUOTE_SOFT_EXPIRED;
                    if(save) await this._saveAndEmit();
                    return true;
                }
                break;
            case FromBTCLNSwapState.PR_PAID:
                if(this.expiry<Date.now()) {
                    this.state = FromBTCLNSwapState.QUOTE_SOFT_EXPIRED;
                    if(save) await this._saveAndEmit();
                    return true;
                }
                break;
            case FromBTCLNSwapState.CLAIM_COMMITED:
                const expired = await this.wrapper.contract.isExpired(this._getInitiator(), this.data);
                if(expired) {
                    this.state = FromBTCLNSwapState.EXPIRED;
                    if(save) await this._saveAndEmit();
                    return true;
                }
                break;
        }
    }

}