import * as BN from "bn.js";
import {ISwapWrapper, ISwapWrapperOptions, WrapperCtorTokens} from "../../ISwapWrapper";
import {TrustedIntermediaryAPI} from "../../../intermediaries/TrustedIntermediaryAPI";
import {IntermediaryError} from "../../../errors/IntermediaryError";
import {ChainType, IStorageManager} from "@atomiqlabs/base";
import {OnchainForGasSwap, OnchainForGasSwapInit, OnchainForGasSwapState} from "./OnchainForGasSwap";
import {BitcoinRpcWithTxoListener} from "../../../btc/BitcoinRpcWithTxoListener";
import {ISwapPrice} from "../../../prices/abstract/ISwapPrice";
import {EventEmitter} from "events";
import {Intermediary} from "../../../intermediaries/Intermediary";
import {SwapType} from "../../SwapType";

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
     * Returns a newly created swap, receiving 'amount' base units of gas token
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units
     * @param lp                Intermediary/Counterparty swap service url
     * @param refundAddress     Bitcoin address to receive refund on in case the counterparty cannot execute the swap
     */
    async create(signer: string, amount: BN, lp: Intermediary, refundAddress?: string): Promise<OnchainForGasSwap<T>> {
        if(!this.isInitialized) throw new Error("Not initialized, call init() first!");

        const resp = await TrustedIntermediaryAPI.initTrustedFromBTC(lp.url, {
            address: signer,
            amount,
            refundAddress
        }, this.options.getRequestTimeout);

        if(!resp.total.eq(amount)) throw new IntermediaryError("Invalid total returned");

        const pricingInfo = await this.verifyReturnedPrice(
            lp.services[SwapType.TRUSTED_FROM_BTC], false, resp.amountSats,
            amount, this.contract.getNativeCurrencyAddress(), resp
        );

        const quote = new OnchainForGasSwap(this, {
            paymentHash: resp.paymentHash,
            sequence: resp.sequence,
            address: resp.btcAddress,
            inputAmount: resp.amountSats,
            outputAmount: resp.total,
            recipient: signer,
            refundAddress,
            pricingInfo,
            url: lp.url,
            expiry: resp.expiresAt,
            swapFee: resp.swapFee,
            swapFeeBtc: resp.swapFeeSats,
            feeRate: "",
            exactIn: false
        } as OnchainForGasSwapInit<T["Data"]>);
        await quote._save();
        return quote;
    }

    protected async checkPastSwap(swap: OnchainForGasSwap<T>): Promise<boolean> {
        if(swap.state===OnchainForGasSwapState.PR_CREATED) {
            //Check if it's maybe already paid
            return await swap.checkAddress(false);
        }
        return false;
    }

    protected isOurSwap(signer: string, swap: OnchainForGasSwap<T>): boolean {
        return signer===swap.getRecipient();
    }

    protected tickSwap(swap: OnchainForGasSwap<T>): void {}

}
