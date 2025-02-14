import {IFromBTCWrapper} from "../IFromBTCWrapper";
import {FromBTCSwap, FromBTCSwapInit, FromBTCSwapState} from "./FromBTCSwap";
import * as BN from "bn.js";
import {
    ChainSwapType,
    ChainType,
    ClaimEvent,
    InitializeEvent,
    IStorageManager,
    RefundEvent,
    RelaySynchronizer,
    SwapCommitStatus,
    SwapData,
    BtcRelay
} from "@atomiqlabs/base";
import {EventEmitter} from "events";
import {Intermediary} from "../../../intermediaries/Intermediary";
import {BitcoinRpcWithTxoListener} from "../../../btc/BitcoinRpcWithTxoListener";
import {ISwapPrice} from "../../../prices/abstract/ISwapPrice";
import {address, networks} from "bitcoinjs-lib";
import {AmountData, ISwapWrapperOptions, WrapperCtorTokens} from "../../ISwapWrapper";
import {Buffer} from "buffer";
import {IntermediaryError} from "../../../errors/IntermediaryError";
import {SwapType} from "../../SwapType";
import {extendAbortController, tryWithRetries} from "../../../utils/Utils";
import {FromBTCResponseType, IntermediaryAPI} from "../../../intermediaries/IntermediaryAPI";
import {RequestError} from "../../../errors/RequestError";
import * as randomBytes from "randombytes";

export type FromBTCOptions = {
    feeSafetyFactor?: BN,
    blockSafetyFactor?: number
};

export type FromBTCWrapperOptions = ISwapWrapperOptions & {
    safetyFactor?: number,
    blocksTillTxConfirms?: number,
    maxConfirmations?: number,
    minSendWindow?: number,
    bitcoinNetwork?: networks.Network,
    bitcoinBlocktime?: number
};

export class FromBTCWrapper<
    T extends ChainType
> extends IFromBTCWrapper<T, FromBTCSwap<T>, FromBTCWrapperOptions> {
    protected readonly swapDeserializer = FromBTCSwap;

    readonly synchronizer: RelaySynchronizer<any, T["TX"], any>;
    readonly btcRelay: BtcRelay<any, T["TX"], any>;
    readonly btcRpc: BitcoinRpcWithTxoListener<any>;

    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param chainEvents On-chain event listener
     * @param prices Pricing to use
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param btcRelay
     * @param synchronizer Btc relay synchronizer
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(
        chainIdentifier: string,
        storage: IStorageManager<FromBTCSwap<T>>,
        contract: T["Contract"],
        chainEvents: T["Events"],
        prices: ISwapPrice,
        tokens: WrapperCtorTokens,
        swapDataDeserializer: new (data: any) => T["Data"],
        btcRelay: BtcRelay<any, T["TX"], any>,
        synchronizer: RelaySynchronizer<any, T["TX"], any>,
        btcRpc: BitcoinRpcWithTxoListener<any>,
        options?: FromBTCWrapperOptions,
        events?: EventEmitter
    ) {
        if(options==null) options = {};
        options.bitcoinNetwork = options.bitcoinNetwork || networks.testnet;
        options.safetyFactor = options.safetyFactor || 2;
        options.blocksTillTxConfirms = options.blocksTillTxConfirms || 12;
        options.maxConfirmations = options.maxConfirmations || 6;
        options.minSendWindow = options.minSendWindow || 30*60; //Minimum time window for user to send in the on-chain funds for From BTC swap
        options.bitcoinBlocktime = options.bitcoinBlocktime || 10*60;
        super(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events);
        this.btcRelay = btcRelay;
        this.synchronizer = synchronizer;
        this.btcRpc = btcRpc;
    }

    protected async checkPastSwap(swap: FromBTCSwap<T>): Promise<boolean> {
        if(swap.state===FromBTCSwapState.PR_CREATED || swap.state===FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            const status = await tryWithRetries(() => this.contract.getCommitStatus(swap.getInitiator(), swap.data));
            switch(status) {
                case SwapCommitStatus.COMMITED:
                    swap.state = FromBTCSwapState.CLAIM_COMMITED;
                    return true;
                case SwapCommitStatus.EXPIRED:
                    swap.state = FromBTCSwapState.QUOTE_EXPIRED;
                    return true;
                case SwapCommitStatus.PAID:
                    swap.state = FromBTCSwapState.CLAIM_CLAIMED;
                    return true;
            }

            if(!await swap.isQuoteValid()) {
                swap.state = FromBTCSwapState.QUOTE_EXPIRED;
                return true;
            }

            return false;
        }

        if(swap.state===FromBTCSwapState.CLAIM_COMMITED || swap.state===FromBTCSwapState.BTC_TX_CONFIRMED || swap.state===FromBTCSwapState.EXPIRED) {
            const status = await tryWithRetries(() => this.contract.getCommitStatus(swap.getInitiator(), swap.data));
            switch(status) {
                case SwapCommitStatus.PAID:
                    swap.state = FromBTCSwapState.CLAIM_CLAIMED;
                    return true;
                case SwapCommitStatus.NOT_COMMITED:
                case SwapCommitStatus.EXPIRED:
                    swap.state = FromBTCSwapState.FAILED;
                    return true;
                case SwapCommitStatus.COMMITED:
                    const res = await swap.getBitcoinPayment();
                    if(res!=null && res.confirmations>=swap.requiredConfirmations) {
                        swap.txId = res.txId;
                        swap.vout = res.vout;
                        swap.state = FromBTCSwapState.BTC_TX_CONFIRMED;
                        return true;
                    }
                    break;
            }
        }
    }

    protected tickSwap(swap: FromBTCSwap<T>): void {
        switch(swap.state) {
            case FromBTCSwapState.PR_CREATED:
                if(swap.expiry<Date.now()) swap._saveAndEmit(FromBTCSwapState.QUOTE_SOFT_EXPIRED);
                break;
            case FromBTCSwapState.CLAIM_COMMITED:
                if(swap.getTimeoutTime()<Date.now()) swap._saveAndEmit(FromBTCSwapState.EXPIRED);
            case FromBTCSwapState.EXPIRED:
                //Check if bitcoin payment was received every 2 minutes
                if(Math.floor(Date.now()/1000)%120===0) swap.getBitcoinPayment().then(res => {
                    if(res!=null && res.confirmations>=swap.requiredConfirmations) {
                        swap.txId = res.txId;
                        swap.vout = res.vout;
                        return swap._saveAndEmit(FromBTCSwapState.BTC_TX_CONFIRMED);
                    }
                }).catch(e => this.logger.error("tickSwap("+swap.getIdentifierHashString()+"): ", e));
                break;
        }
    }

    protected processEventInitialize(swap: FromBTCSwap<T>, event: InitializeEvent<T["Data"]>): Promise<boolean> {
        if(swap.state===FromBTCSwapState.PR_CREATED || swap.state===FromBTCSwapState.QUOTE_SOFT_EXPIRED) {
            swap.state = FromBTCSwapState.CLAIM_COMMITED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }

    protected processEventClaim(swap: FromBTCSwap<T>, event: ClaimEvent<T["Data"]>): Promise<boolean> {
        if(swap.state!==FromBTCSwapState.FAILED) {
            swap.state = FromBTCSwapState.CLAIM_CLAIMED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }

    protected processEventRefund(swap: FromBTCSwap<T>, event: RefundEvent<T["Data"]>): Promise<boolean> {
        if(swap.state!==FromBTCSwapState.CLAIM_CLAIMED) {
            swap.state = FromBTCSwapState.FAILED;
            return Promise.resolve(true);
        }
        return Promise.resolve(false);
    }

    /**
     * Returns the swap expiry, leaving enough time for the user to send a transaction and for it to confirm
     *
     * @param data Parsed swap data
     * @param requiredConfirmations Confirmations required to claim the tx
     */
    getOnchainSendTimeout(data: SwapData, requiredConfirmations: number): BN {
        const tsDelta = (this.options.blocksTillTxConfirms + requiredConfirmations) * this.options.bitcoinBlocktime * this.options.safetyFactor;
        return data.getExpiry().sub(new BN(tsDelta));
    }

    /**
     * Pre-fetches claimer (watchtower) bounty data for the swap. Doesn't throw, instead returns null and aborts the
     *  provided abortController
     *
     * @param signer Smartchain signer address initiating the swap
     * @param amountData
     * @param options Options as passed to the swap creation function
     * @param abortController
     * @private
     */
    private async preFetchClaimerBounty(
        signer: string,
        amountData: AmountData,
        options: FromBTCOptions,
        abortController: AbortController
    ): Promise<{
        feePerBlock: BN,
        safetyFactor: number,
        startTimestamp: BN,
        addBlock: number,
        addFee: BN
    } | null> {
        const startTimestamp = new BN(Math.floor(Date.now()/1000));

        const dummyAmount = new BN(randomBytes(3));
        const dummySwapData = await this.contract.createSwapData(
            ChainSwapType.CHAIN, signer, signer, amountData.token,
            dummyAmount, this.contract.getHashForOnchain(randomBytes(20), dummyAmount, 3).toString("hex"),
            this.getRandomSequence(), new BN(Math.floor(Date.now()/1000)), false, true,
            new BN(randomBytes(2)), new BN(randomBytes(2))
        );

        try {
            const [feePerBlock, btcRelayData, currentBtcBlock, claimFeeRate] = await Promise.all([
                tryWithRetries(() => this.btcRelay.getFeePerBlock(), null, null, abortController.signal),
                tryWithRetries(() => this.btcRelay.getTipData(), null, null, abortController.signal),
                this.btcRpc.getTipHeight(),
                tryWithRetries<BN>(() => this.contract.getClaimFee(signer, dummySwapData), null, null, abortController.signal)
            ]);

            const currentBtcRelayBlock = btcRelayData.blockheight;
            const addBlock = Math.max(currentBtcBlock-currentBtcRelayBlock, 0);
            return {
                feePerBlock: feePerBlock.mul(options.feeSafetyFactor),
                safetyFactor: options.blockSafetyFactor,
                startTimestamp: startTimestamp,
                addBlock,
                addFee: claimFeeRate.mul(options.feeSafetyFactor)
            }
        } catch (e) {
            abortController.abort(e);
            return null;
        }
    }

    /**
     * Returns calculated claimer bounty calculated from the claimer bounty data as fetched from preFetchClaimerBounty()
     *
     * @param data Parsed swap data returned from the intermediary
     * @param options Options as passed to the swap creation function
     * @param claimerBounty Claimer bounty data as fetched from preFetchClaimerBounty() function
     * @private
     */
    private getClaimerBounty(
        data: T["Data"],
        options: FromBTCOptions,
        claimerBounty: {
            feePerBlock: BN,
            safetyFactor: number,
            startTimestamp: BN,
            addBlock: number,
            addFee: BN
        }
    ): BN {
        const tsDelta = data.getExpiry().sub(claimerBounty.startTimestamp);
        const blocksDelta = tsDelta.div(new BN(this.options.bitcoinBlocktime)).mul(new BN(options.blockSafetyFactor));
        const totalBlock = blocksDelta.add(new BN(claimerBounty.addBlock));
        return claimerBounty.addFee.add(totalBlock.mul(claimerBounty.feePerBlock));
    }

    /**
     * Verifies response returned from intermediary
     *
     * @param resp Response as returned by the intermediary
     * @param amountData
     * @param lp Intermediary
     * @param options Options as passed to the swap creation function
     * @param data Parsed swap data returned by the intermediary
     * @param sequence Required swap sequence
     * @param claimerBounty Claimer bount data as returned from the preFetchClaimerBounty() pre-fetch promise
     * @param depositToken
     * @private
     * @throws {IntermediaryError} in case the response is invalid
     */
    private verifyReturnedData(
        resp: FromBTCResponseType,
        amountData: AmountData,
        lp: Intermediary,
        options: FromBTCOptions,
        data: T["Data"],
        sequence: BN,
        claimerBounty: {
            feePerBlock: BN,
            safetyFactor: number,
            startTimestamp: BN,
            addBlock: number,
            addFee: BN
        },
        depositToken: string
    ): void {
        if(amountData.exactIn) {
            if(!resp.amount.eq(amountData.amount)) throw new IntermediaryError("Invalid amount returned");
        } else {
            if(!resp.total.eq(amountData.amount)) throw new IntermediaryError("Invalid total returned");
        }

        const requiredConfirmations = resp.confirmations ?? lp.services[SwapType.FROM_BTC].data.confirmations;
        if(requiredConfirmations>this.options.maxConfirmations) throw new IntermediaryError("Requires too many confirmations");

        const totalClaimerBounty = this.getClaimerBounty(data, options, claimerBounty);

        if(
            !data.getClaimerBounty().eq(totalClaimerBounty) ||
            data.getType()!=ChainSwapType.CHAIN ||
            !data.getSequence().eq(sequence) ||
            !data.getAmount().eq(resp.total) ||
            data.isPayIn() ||
            !data.isToken(amountData.token) ||
            data.getOfferer()!==lp.getAddress(this.chainIdentifier) ||
            data.isDepositToken(depositToken)
        ) {
            throw new IntermediaryError("Invalid data returned");
        }

        //Check that we have enough time to send the TX and for it to confirm
        const expiry = this.getOnchainSendTimeout(data, requiredConfirmations);
        const currentTimestamp = new BN(Math.floor(Date.now()/1000));
        if(expiry.sub(currentTimestamp).lt(new BN(this.options.minSendWindow))) {
            throw new IntermediaryError("Send window too low");
        }

        const lockingScript = address.toOutputScript(resp.btcAddress, this.options.bitcoinNetwork);
        const desiredExtraData = this.contract.getExtraData(lockingScript, resp.amount, requiredConfirmations);
        const desiredClaimHash = this.contract.getHashForOnchain(lockingScript, resp.amount, requiredConfirmations);
        if(!desiredClaimHash.equals(Buffer.from(data.getClaimHash(), "hex"))) {
            throw new IntermediaryError("Invalid claim hash returned!");
        }
        if(!desiredExtraData.equals(Buffer.from(data.getExtraData(), "hex"))) {
            throw new IntermediaryError("Invalid extra data returned!");
        }
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
    create(
        signer: string,
        amountData: AmountData,
        lps: Intermediary[],
        options?: FromBTCOptions,
        additionalParams?: Record<string, any>,
        abortSignal?: AbortSignal
    ): {
        quote: Promise<FromBTCSwap<T>>,
        intermediary: Intermediary
    }[] {
        options ??= {};
        options.blockSafetyFactor ??= 1;
        options.feeSafetyFactor ??= new BN(2);

        const sequence: BN = this.getRandomSequence();

        const _abortController = extendAbortController(abortSignal);
        const pricePrefetchPromise: Promise<BN> = this.preFetchPrice(amountData, _abortController.signal);
        const claimerBountyPrefetchPromise = this.preFetchClaimerBounty(signer, amountData, options, _abortController);
        const nativeTokenAddress = this.contract.getNativeCurrencyAddress();
        const feeRatePromise: Promise<any> = this.preFetchFeeRate(signer, amountData, null, _abortController);

        return lps.map(lp => {
            return {
                intermediary: lp,
                quote: (async () => {
                    const abortController = extendAbortController(_abortController.signal);
                    const liquidityPromise: Promise<BN> = this.preFetchIntermediaryLiquidity(amountData, lp, abortController);

                    try {
                        const {signDataPromise, resp} = await tryWithRetries(async(retryCount: number) => {
                            const {signDataPrefetch, response} = IntermediaryAPI.initFromBTC(
                                this.chainIdentifier, lp.url, nativeTokenAddress,
                                {
                                    claimer: signer,
                                    amount: amountData.amount,
                                    token: amountData.token.toString(),

                                    exactOut: !amountData.exactIn,
                                    sequence,

                                    claimerBounty: claimerBountyPrefetchPromise,
                                    feeRate: feeRatePromise,
                                    additionalParams
                                },
                                this.options.postRequestTimeout, abortController.signal, retryCount>0 ? false : null
                            );

                            return {
                                signDataPromise: this.preFetchSignData(signDataPrefetch),
                                resp: await response
                            };
                        }, null, e => e instanceof RequestError, abortController.signal);

                        const data: T["Data"] = new this.swapDataDeserializer(resp.data);
                        data.setClaimer(signer);

                        this.verifyReturnedData(resp, amountData, lp, options, data, sequence, await claimerBountyPrefetchPromise, nativeTokenAddress);
                        const [pricingInfo, signatureExpiry] = await Promise.all([
                            //Get intermediary's liquidity
                            this.verifyReturnedPrice(
                                lp.services[SwapType.FROM_BTC], false, resp.amount, resp.total,
                                amountData.token, resp, pricePrefetchPromise, abortController.signal
                            ),
                            this.verifyReturnedSignature(data, resp, feeRatePromise, signDataPromise, abortController.signal),
                            this.verifyIntermediaryLiquidity(data.getAmount(), liquidityPromise),
                        ]);

                        const quote = new FromBTCSwap<T>(this, {
                            pricingInfo,
                            url: lp.url,
                            expiry: signatureExpiry,
                            swapFee: resp.swapFee,
                            feeRate: await feeRatePromise,
                            signatureData: resp,
                            data,
                            address: resp.btcAddress,
                            amount: resp.amount,
                            exactIn: amountData.exactIn ?? true,
                            requiredConfirmations: resp.confirmations ?? lp.services[SwapType.FROM_BTC].data.confirmations
                        } as FromBTCSwapInit<T["Data"]>);
                        await quote._save();
                        return quote;
                    } catch (e) {
                        abortController.abort(e);
                        throw e;
                    }
                })()
            }
        });
    }

}
