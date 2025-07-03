import {IFromBTCSwap} from "../IFromBTCSwap";
import {SwapType} from "../../../enums/SwapType";
import {FromBTCWrapper} from "./FromBTCWrapper";
import {ChainType, SwapCommitStateType, SwapData} from "@atomiqlabs/base";
import {Buffer} from "buffer";
import {BitcoinTokens, BtcToken, SCToken, TokenAmount, toTokenAmount} from "../../../../Tokens";
import {extendAbortController, getLogger, toOutputScript, tryWithRetries} from "../../../../utils/Utils";
import {IEscrowSwapInit, isIEscrowSwapInit} from "../../IEscrowSwap";
import {IBitcoinWallet, isIBitcoinWallet} from "../../../../btc/wallet/IBitcoinWallet";
import {IBTCWalletSwap} from "../../../IBTCWalletSwap";
import {Transaction} from "@scure/btc-signer";
import {SingleAddressBitcoinWallet} from "../../../../btc/wallet/SingleAddressBitcoinWallet";

export enum FromBTCSwapState {
    FAILED = -4,
    EXPIRED = -3,
    QUOTE_EXPIRED = -2,
    QUOTE_SOFT_EXPIRED = -1,
    PR_CREATED = 0,
    CLAIM_COMMITED = 1,
    BTC_TX_CONFIRMED = 2,
    CLAIM_CLAIMED = 3
}

export type FromBTCSwapInit<T extends SwapData> = IEscrowSwapInit<T> & {
    address: string;
    amount: bigint;
    requiredConfirmations: number;
};

export function isFromBTCSwapInit<T extends SwapData>(obj: any): obj is FromBTCSwapInit<T> {
    return typeof(obj.address) === "string" &&
        typeof(obj.amount) === "bigint" &&
        isIEscrowSwapInit<T>(obj);
}

export class FromBTCSwap<T extends ChainType = ChainType> extends IFromBTCSwap<T, FromBTCSwapState> implements IBTCWalletSwap{
    protected readonly inputToken: BtcToken<false> = BitcoinTokens.BTC;
    protected readonly TYPE = SwapType.FROM_BTC;

    readonly wrapper: FromBTCWrapper<T>;

    readonly address: string;
    readonly amount: bigint;
    readonly requiredConfirmations: number;

    txId?: string;
    vout?: number;

    constructor(wrapper: FromBTCWrapper<T>, init: FromBTCSwapInit<T["Data"]>);
    constructor(wrapper: FromBTCWrapper<T>, obj: any);
    constructor(wrapper: FromBTCWrapper<T>, initOrObject: FromBTCSwapInit<T["Data"]> | any) {
        if(isFromBTCSwapInit(initOrObject)) initOrObject.url += "/frombtc";
        super(wrapper, initOrObject);
        if(isFromBTCSwapInit(initOrObject)) {
            this.state = FromBTCSwapState.PR_CREATED;
        } else {
            this.address = initOrObject.address;
            this.amount = BigInt(initOrObject.amount);
            this.txId = initOrObject.txId;
            this.vout = initOrObject.vout;
            this.requiredConfirmations = initOrObject.requiredConfirmations ?? this.data.getConfirmationsHint();
        }
        this.tryRecomputeSwapPrice();
        this.logger = getLogger("FromBTC("+this.getIdentifierHashString()+"): ");
    }

    protected upgradeVersion() {
        if(this.version == null) {
            switch(this.state) {
                case -2:
                    this.state = FromBTCSwapState.FAILED
                    break;
                case -1:
                    this.state = FromBTCSwapState.QUOTE_EXPIRED
                    break;
                case 0:
                    this.state = FromBTCSwapState.PR_CREATED
                    break;
                case 1:
                    this.state = FromBTCSwapState.CLAIM_COMMITED
                    break;
                case 2:
                    this.state = FromBTCSwapState.BTC_TX_CONFIRMED
                    break;
                case 3:
                    this.state = FromBTCSwapState.CLAIM_CLAIMED
                    break;
            }
            this.version = 1;
        }
    }


    //////////////////////////////
    //// Getters & utils

    /**
     * Returns bitcoin address where the on-chain BTC should be sent to
     */
    getAddress(): string {
        if(this.state===FromBTCSwapState.PR_CREATED) return null;
        return this.address;
    }

    getHyperlink(): string {
        if(this.state===FromBTCSwapState.PR_CREATED) return null;
        return "bitcoin:"+this.address+"?amount="+encodeURIComponent((Number(this.amount) / 100000000).toString(10));
    }

    getInputTxId(): string | null {
        return this.txId;
    }

    /**
     * Returns timeout time (in UNIX milliseconds) when the on-chain address will expire and no funds should be sent
     *  to that address anymore
     */
    getTimeoutTime(): number {
        return Number(this.wrapper.getOnchainSendTimeout(this.data, this.requiredConfirmations)) * 1000;
    }

    requiresAction(): boolean {
        return this.isClaimable() || (this.state===FromBTCSwapState.CLAIM_COMMITED && this.getTimeoutTime()>Date.now());
    }

    isFinished(): boolean {
        return this.state===FromBTCSwapState.CLAIM_CLAIMED || this.state===FromBTCSwapState.QUOTE_EXPIRED || this.state===FromBTCSwapState.FAILED;
    }

    isClaimable(): boolean {
        return this.state===FromBTCSwapState.BTC_TX_CONFIRMED;
    }

    isSuccessful(): boolean {
        return this.state===FromBTCSwapState.CLAIM_CLAIMED;
    }

    isFailed(): boolean {
        return this.state===FromBTCSwapState.FAILED || (this.state===FromBTCSwapState.EXPIRED && this.txId!=null);
    }

    isQuoteExpired(): boolean {
        return this.state===FromBTCSwapState.QUOTE_EXPIRED;
    }

    isQuoteSoftExpired(): boolean {
        return this.state===FromBTCSwapState.QUOTE_EXPIRED || this.state===FromBTCSwapState.QUOTE_SOFT_EXPIRED;
    }

    protected canCommit(): boolean {
        if(this.state!==FromBTCSwapState.PR_CREATED) return false;
        const expiry = this.wrapper.getOnchainSendTimeout(this.data, this.requiredConfirmations);
        const currentTimestamp = BigInt(Math.floor(Date.now()/1000));

        return (expiry - currentTimestamp) >= this.wrapper.options.minSendWindow;
    }


    //////////////////////////////
    //// Amounts & fees

    getInput(): TokenAmount<T["ChainId"], BtcToken<false>> {
        return toTokenAmount(this.amount, this.inputToken, this.wrapper.prices);
    }

    /**
     * Returns claimer bounty, acting as a reward for watchtowers to claim the swap automatically
     */
    getClaimerBounty(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>> {
        return toTokenAmount(this.data.getClaimerBounty(), this.wrapper.tokens[this.data.getDepositToken()], this.wrapper.prices);
    }


    //////////////////////////////
    //// Bitcoin tx

    /**
     * Checks whether a bitcoin payment was already made, returns the payment or null when no payment has been made.
     */
    protected async getBitcoinPayment(): Promise<{
        txId: string,
        vout: number,
        confirmations: number,
        targetConfirmations: number
    } | null> {
        const result = await this.wrapper.btcRpc.checkAddressTxos(this.address, Buffer.from(this.data.getTxoHashHint(), "hex"));
        if(result==null) return null;

        return {
            txId: result.tx.txid,
            vout: result.vout,
            confirmations: result.tx.confirmations,
            targetConfirmations: this.requiredConfirmations
        }
    }

    /**
     * Waits till the bitcoin transaction confirms and swap becomes claimable
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    async waitForBitcoinTransaction(
        abortSignal?: AbortSignal,
        checkIntervalSeconds?: number,
        updateCallback?: (txId: string, confirmations: number, targetConfirmations: number, txEtaMs: number) => void
    ): Promise<string> {
        if(this.state!==FromBTCSwapState.CLAIM_COMMITED && this.state!==FromBTCSwapState.EXPIRED) throw new Error("Must be in COMMITED state!");

        const result = await this.wrapper.btcRpc.waitForAddressTxo(
            this.address,
            Buffer.from(this.data.getTxoHashHint(), "hex"),
            this.requiredConfirmations,
            (confirmations: number, txId: string, vout: number, txEtaMs: number) => {
                if(updateCallback!=null) updateCallback(txId, confirmations, this.requiredConfirmations, txEtaMs);
            },
            abortSignal,
            checkIntervalSeconds
        );

        if(abortSignal!=null) abortSignal.throwIfAborted();

        this.txId = result.tx.txid;
        this.vout = result.vout;
        if(
            (this.state as FromBTCSwapState)!==FromBTCSwapState.CLAIM_CLAIMED &&
            (this.state as FromBTCSwapState)!==FromBTCSwapState.FAILED
        ) {
            this.state = FromBTCSwapState.BTC_TX_CONFIRMED;
        }

        await this._saveAndEmit();

        return result.tx.txid;
    }

    async getFundedPsbt(_bitcoinWallet: IBitcoinWallet | { address: string, publicKey: string }, feeRate?: number): Promise<{psbt: Transaction, signInputs: number[]}> {
        if(this.state!==FromBTCSwapState.CLAIM_COMMITED)
            throw new Error("Swap not committed yet, please initiate the swap first with commit() call!");

        let bitcoinWallet: IBitcoinWallet;
        if(isIBitcoinWallet(_bitcoinWallet)) {
            bitcoinWallet = _bitcoinWallet;
        } else {
            bitcoinWallet = new SingleAddressBitcoinWallet(this.wrapper.btcRpc, this.wrapper.options.bitcoinNetwork, _bitcoinWallet);
        }
        //TODO: Maybe re-introduce fee rate check here if passed from the user
        if(feeRate==null) {
            feeRate = await bitcoinWallet.getFeeRate();
        }

        const basePsbt = new Transaction({
            allowUnknownOutputs: true,
            allowLegacyWitnessUtxo: true
        });
        basePsbt.addOutput({
            amount: this.amount,
            script: toOutputScript(this.wrapper.options.bitcoinNetwork, this.address)
        });

        const psbt = await bitcoinWallet.fundPsbt(basePsbt, feeRate);
        //Sign every input
        const signInputs: number[] = [];
        for(let i=0;i<psbt.inputsLength;i++) {
            signInputs.push(i);
        }
        return {psbt, signInputs};
    }

    async submitPsbt(psbt: Transaction): Promise<string> {
        if(this.state!==FromBTCSwapState.CLAIM_COMMITED)
            throw new Error("Swap not committed yet, please initiate the swap first with commit() call!");

        //Ensure not expired
        if(this.getTimeoutTime()<Date.now()) {
            throw new Error("Swap address expired!");
        }

        const output0 = psbt.getOutput(0);
        if(output0.amount!==this.amount)
            throw new Error("PSBT output amount invalid, expected: "+this.amount+" got: "+output0.amount);
        const expectedOutputScript = toOutputScript(this.wrapper.options.bitcoinNetwork, this.address);
        if(!expectedOutputScript.equals(output0.script))
            throw new Error("PSBT output script invalid!");

        if(!psbt.isFinal) psbt.finalize();

        return await this.wrapper.btcRpc.sendRawTransaction(Buffer.from(psbt.toBytes(true, true)).toString("hex"));
    }

    async estimateBitcoinFee(wallet: IBitcoinWallet, feeRate?: number): Promise<TokenAmount<any, BtcToken<false>>> {
        const txFee = await wallet.getTransactionFee(this.address, this.amount, feeRate);
        return toTokenAmount(txFee==null ? null : BigInt(txFee), BitcoinTokens.BTC, this.wrapper.prices);
    }

    async sendBitcoinTransaction(wallet: IBitcoinWallet, feeRate?: number): Promise<string> {
        if(this.state!==FromBTCSwapState.CLAIM_COMMITED)
            throw new Error("Swap not committed yet, please initiate the swap first with commit() call!");
        return await wallet.sendTransaction(this.address, this.amount, feeRate);
    }


    //////////////////////////////
    //// Commit

    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in a PTLC
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
        if(this.state===FromBTCSwapState.PR_CREATED || this.state===FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            await this._saveAndEmit(FromBTCSwapState.CLAIM_COMMITED);
        }
        return result[0];
    }

    async waitTillCommited(abortSignal?: AbortSignal): Promise<void> {
        if(this.state===FromBTCSwapState.CLAIM_COMMITED || this.state===FromBTCSwapState.CLAIM_CLAIMED) return Promise.resolve();
        if(this.state!==FromBTCSwapState.PR_CREATED && this.state!==FromBTCSwapState.QUOTE_SOFT_EXPIRED) throw new Error("Invalid state");

        const abortController = extendAbortController(abortSignal);
        const result = await Promise.race([
            this.watchdogWaitTillCommited(abortController.signal),
            this.waitTillState(FromBTCSwapState.CLAIM_COMMITED, "gte", abortController.signal).then(() => 0)
        ]);
        abortController.abort();

        if(result===0) this.logger.debug("waitTillCommited(): Resolved from state changed");
        if(result===true) this.logger.debug("waitTillCommited(): Resolved from watchdog - commited");
        if(result===false) {
            this.logger.debug("waitTillCommited(): Resolved from watchdog - signature expired");
            if(this.state===FromBTCSwapState.PR_CREATED || this.state===FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
                await this._saveAndEmit(FromBTCSwapState.QUOTE_EXPIRED);
            }
            return;
        }

        if(this.state===FromBTCSwapState.PR_CREATED || this.state===FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            await this._saveAndEmit(FromBTCSwapState.CLAIM_COMMITED);
        }
    }


    //////////////////////////////
    //// Claim

    /**
     * Returns transactions required to claim the swap on-chain (and possibly also sync the bitcoin light client)
     *  after a bitcoin transaction was sent and confirmed
     *
     * @throws {Error} If the swap is in invalid state (must be BTC_TX_CONFIRMED)
     */
    async txsClaim(signer?: T["Signer"]): Promise<T["TX"][]> {
        if(this.state!==FromBTCSwapState.BTC_TX_CONFIRMED) throw new Error("Must be in BTC_TX_CONFIRMED state!");

        const tx = await this.wrapper.btcRpc.getTransaction(this.txId);

        return await this.wrapper.contract.txsClaimWithTxData(signer ?? this._getInitiator(), this.data, {
            blockhash: tx.blockhash,
            confirmations: tx.confirmations,
            txid: tx.txid,
            hex: tx.hex,
            height: tx.blockheight
        }, this.requiredConfirmations, this.vout, null, this.wrapper.synchronizer, true);
    }

    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    async claim(signer: T["Signer"], abortSignal?: AbortSignal): Promise<string> {
        let txIds: string[];
        try {
            txIds = await this.wrapper.chain.sendAndConfirm(
                signer, await this.txsClaim(signer), true, abortSignal
            );
        } catch (e) {
            this.logger.info("claim(): Failed to claim ourselves, checking swap claim state...");
            if(this.state===FromBTCSwapState.CLAIM_CLAIMED) {
                this.logger.info("claim(): Transaction state is CLAIM_CLAIMED, swap was successfully claimed by the watchtower");
                return this.claimTxId;
            }
            const status = await this.wrapper.contract.getCommitStatus(this._getInitiator(), this.data);
            if(status?.type===SwapCommitStateType.PAID) {
                this.logger.info("claim(): Transaction commit status is PAID, swap was successfully claimed by the watchtower");
                if(this.claimTxId==null) this.claimTxId = await status.getClaimTxId();
                await this._saveAndEmit(FromBTCSwapState.CLAIM_CLAIMED);
                return this.claimTxId;
            }
            throw e;
        }

        this.claimTxId = txIds[txIds.length - 1];
        if(
            this.state===FromBTCSwapState.CLAIM_COMMITED || this.state===FromBTCSwapState.BTC_TX_CONFIRMED ||
            this.state===FromBTCSwapState.EXPIRED || this.state===FromBTCSwapState.FAILED
        ) {
            await this._saveAndEmit(FromBTCSwapState.CLAIM_CLAIMED);
        }
        return txIds[0];
    }

    /**
     * Waits till the swap is successfully claimed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be BTC_TX_CONFIRMED)
     * @throws {Error} If the LP refunded sooner than we were able to claim
     */
    async waitTillClaimed(abortSignal?: AbortSignal): Promise<void> {
        if(this.state===FromBTCSwapState.CLAIM_CLAIMED) return Promise.resolve();
        if(this.state!==FromBTCSwapState.BTC_TX_CONFIRMED) throw new Error("Invalid state (not BTC_TX_CONFIRMED)");

        const abortController = new AbortController();
        if(abortSignal!=null) abortSignal.addEventListener("abort", () => abortController.abort(abortSignal.reason));
        const res = await Promise.race([
            this.watchdogWaitTillResult(abortController.signal),
            this.waitTillState(FromBTCSwapState.CLAIM_CLAIMED, "eq", abortController.signal).then(() => 0 as const),
            this.waitTillState(FromBTCSwapState.FAILED, "eq", abortController.signal).then(() => 1 as const),
        ]);
        abortController.abort();

        if(res===0) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (CLAIM_CLAIMED)");
            return;
        }
        if(res===1) {
            this.logger.debug("waitTillClaimed(): Resolved from state change (FAILED)");
            throw new Error("Offerer refunded during claiming");
        }
        this.logger.debug("waitTillClaimed(): Resolved from watchdog");

        if(res?.type===SwapCommitStateType.PAID) {
            if((this.state as FromBTCSwapState)!==FromBTCSwapState.CLAIM_CLAIMED) {
                this.claimTxId = await res.getClaimTxId();
                await this._saveAndEmit(FromBTCSwapState.CLAIM_CLAIMED);
            }
        }
        if(res?.type===SwapCommitStateType.NOT_COMMITED || res?.type===SwapCommitStateType.EXPIRED) {
            if(
                (this.state as FromBTCSwapState)!==FromBTCSwapState.CLAIM_CLAIMED &&
                (this.state as FromBTCSwapState)!==FromBTCSwapState.FAILED
            ) {
                this.refundTxId = res.getRefundTxId==null ? null : await res.getRefundTxId();
                await this._saveAndEmit(FromBTCSwapState.FAILED);
            }
        }
    }


    //////////////////////////////
    //// Storage

    serialize(): any {
        return {
            ...super.serialize(),
            address: this.address,
            amount: this.amount.toString(10),
            requiredConfirmations: this.requiredConfirmations,
            txId: this.txId,
            vout: this.vout
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
        if(this.state===FromBTCSwapState.PR_CREATED || this.state===FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            const quoteExpired = await this.verifyQuoteDefinitelyExpired(); //Make sure we check for expiry here, to prevent race conditions
            const status = await tryWithRetries(() => this.wrapper.contract.getCommitStatus(this._getInitiator(), this.data));
            switch(status?.type) {
                case SwapCommitStateType.COMMITED:
                    this.state = FromBTCSwapState.CLAIM_COMMITED;
                    return true;
                case SwapCommitStateType.EXPIRED:
                    if(this.refundTxId==null && status.getRefundTxId) this.refundTxId = await status.getRefundTxId();
                    this.state = FromBTCSwapState.QUOTE_EXPIRED;
                    return true;
                case SwapCommitStateType.PAID:
                    if(this.claimTxId==null) this.claimTxId = await status.getClaimTxId();
                    this.state = FromBTCSwapState.CLAIM_CLAIMED;
                    return true;
            }

            if(quoteExpired) {
                this.state = FromBTCSwapState.QUOTE_EXPIRED;
                return true;
            }

            return false;
        }

        if(this.state===FromBTCSwapState.CLAIM_COMMITED || this.state===FromBTCSwapState.BTC_TX_CONFIRMED || this.state===FromBTCSwapState.EXPIRED) {
            const status = await tryWithRetries(() => this.wrapper.contract.getCommitStatus(this._getInitiator(), this.data));
            switch(status?.type) {
                case SwapCommitStateType.PAID:
                    if(this.claimTxId==null) this.claimTxId = await status.getClaimTxId();
                    this.state = FromBTCSwapState.CLAIM_CLAIMED;
                    return true;
                case SwapCommitStateType.NOT_COMMITED:
                case SwapCommitStateType.EXPIRED:
                    if(this.refundTxId==null && status.getRefundTxId) this.refundTxId = await status.getRefundTxId();
                    this.state = FromBTCSwapState.FAILED;
                    return true;
                case SwapCommitStateType.COMMITED:
                    const res = await this.getBitcoinPayment();
                    if(res!=null && res.confirmations>=this.requiredConfirmations) {
                        this.txId = res.txId;
                        this.vout = res.vout;
                        this.state = FromBTCSwapState.BTC_TX_CONFIRMED;
                        return true;
                    }
                    break;
            }
        }
    }

    async _sync(save?: boolean): Promise<boolean> {
        const changed = await this.syncStateFromChain();
        if(changed && save) await this._saveAndEmit();
        return changed;
    }

    async _tick(save?: boolean): Promise<boolean> {
        switch(this.state) {
            case FromBTCSwapState.PR_CREATED:
                if(this.expiry<Date.now()) {
                    this.state = FromBTCSwapState.QUOTE_SOFT_EXPIRED;
                    if(save) await this._saveAndEmit();
                    return true;
                }
                break;
            case FromBTCSwapState.CLAIM_COMMITED:
                if(this.getTimeoutTime()<Date.now()) {
                    this.state = FromBTCSwapState.EXPIRED;
                    if(save) await this._saveAndEmit();
                    return true;
                }
            case FromBTCSwapState.EXPIRED:
                //Check if bitcoin payment was received every 2 minutes
                if(Math.floor(Date.now()/1000)%120===0) {
                    try {
                        const res = await this.getBitcoinPayment();
                        if(res!=null && res.confirmations>=this.requiredConfirmations) {
                            this.txId = res.txId;
                            this.vout = res.vout;
                            this.state = FromBTCSwapState.BTC_TX_CONFIRMED;
                            if(save) await this._saveAndEmit();
                            return true;
                        }
                    } catch (e) {
                        this.logger.warn("tickSwap("+this.getIdentifierHashString()+"): ", e);
                    }
                }
                break;
        }
    }

}