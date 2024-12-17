import * as BN from "bn.js";
import {ISwapWrapper, ISwapWrapperOptions, WrapperCtorTokens} from "../../ISwapWrapper";
import {TrustedIntermediaryAPI} from "../../../intermediaries/TrustedIntermediaryAPI";
import {decode as bolt11Decode} from "bolt11";
import {IntermediaryError} from "../../../errors/IntermediaryError";
import {BtcRelay, ChainType, IStorageManager, RelaySynchronizer} from "@atomiqlabs/base";
import {OnchainForGasSwap, OnchainForGasSwapInit, OnchainForGasSwapState} from "./OnchainForGasSwap";
import {BitcoinRpcWithTxoListener} from "../../../btc/BitcoinRpcWithTxoListener";
import {FromBTCSwap} from "../../frombtc/onchain/FromBTCSwap";
import {ISwapPrice} from "../../../prices/abstract/ISwapPrice";
import {EventEmitter} from "events";
import {networks} from "bitcoinjs-lib";

export class OnchainForGasWrapper<T extends ChainType> extends ISwapWrapper<T, OnchainForGasSwap<T>> {
    protected readonly swapDeserializer = OnchainForGasSwap;

    readonly btcRpc: BitcoinRpcWithTxoListener<any>;

    /**
     * @param chainIdentifier
     * @param storage Storage interface for the current environment
     * @param contract Underlying contract handling the swaps
     * @param chainEvents On-chain event listener
     * @param prices Pricing to use
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(
        chainIdentifier: string,
        storage: IStorageManager<OnchainForGasSwap<T>>,
        contract: T["Contract"],
        chainEvents: T["Events"],
        prices: ISwapPrice,
        tokens: WrapperCtorTokens,
        swapDataDeserializer: new (data: any) => T["Data"],
        btcRpc: BitcoinRpcWithTxoListener<any>,
        options?: ISwapWrapperOptions,
        events?: EventEmitter
    ) {
        super(chainIdentifier, storage, contract, chainEvents, prices, tokens, swapDataDeserializer, options, events);
        this.btcRpc = btcRpc;
    }

    /**
     * Returns a newly created swap, receiving 'amount' on lightning network
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units (satoshis)
     * @param url               Intermediary/Counterparty swap service url
     */
    async create(signer: string, amount: BN, url: string): Promise<OnchainForGasSwap<T>> {
        if(!this.isInitialized) throw new Error("Not initialized, call init() first!");

        const resp = await TrustedIntermediaryAPI.initTrustedFromBTCLN(url, {
            address: signer,
            amount
        }, this.options.getRequestTimeout);

        const decodedPr = bolt11Decode(resp.pr);
        const amountIn = new BN(decodedPr.millisatoshis).add(new BN(999)).div(new BN(1000));

        if(!resp.total.eq(amount)) throw new IntermediaryError("Invalid total returned");

        const pricingInfo = await this.verifyReturnedPrice(
            {swapFeePPM: 10000, swapBaseFee: 10}, false, amountIn,
            amount, this.contract.getNativeCurrencyAddress(), resp
        );

        const quote = new OnchainForGasSwap(this, {
            pr: resp.pr,
            outputAmount: resp.total,
            recipient: signer,
            pricingInfo,
            url,
            expiry: decodedPr.timeExpireDate*1000,
            swapFee: resp.swapFee,
            feeRate: "",
            exactIn: false
        } as OnchainForGasSwapInit<T["Data"]>);
        await quote._save();
        return quote;
    }

    protected async checkPastSwap(swap: OnchainForGasSwap<T>): Promise<boolean> {
        if(swap.state===OnchainForGasSwapState.PR_CREATED) {
            //Check if it's maybe already paid
            const res = await swap.checkInvoicePaid(false);
            if(res!==null) return true;

            if(swap.getTimeoutTime()<Date.now()) {
                swap.state = OnchainForGasSwapState.EXPIRED;
                return true;
            }
        }
        return false;
    }

    protected isOurSwap(signer: string, swap: OnchainForGasSwap<T>): boolean {
        return signer===swap.getRecipient();
    }

    protected tickSwap(swap: OnchainForGasSwap<T>): void {}

}
