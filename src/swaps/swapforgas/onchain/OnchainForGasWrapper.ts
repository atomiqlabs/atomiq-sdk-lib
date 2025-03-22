import {ISwapWrapper, ISwapWrapperOptions, WrapperCtorTokens} from "../../ISwapWrapper";
import {TrustedIntermediaryAPI} from "../../../intermediaries/TrustedIntermediaryAPI";
import {IntermediaryError} from "../../../errors/IntermediaryError";
import {ChainType} from "@atomiqlabs/base";
import {OnchainForGasSwap, OnchainForGasSwapInit, OnchainForGasSwapState} from "./OnchainForGasSwap";
import {BitcoinRpcWithTxoListener} from "../../../btc/BitcoinRpcWithTxoListener";
import {ISwapPrice} from "../../../prices/abstract/ISwapPrice";
import {EventEmitter} from "events";
import {Intermediary} from "../../../intermediaries/Intermediary";
import {SwapType} from "../../enums/SwapType";
import {UnifiedSwapEventListener} from "../../../events/UnifiedSwapEventListener";
import {UnifiedSwapStorage} from "../../../storage/UnifiedSwapStorage";

export class OnchainForGasWrapper<T extends ChainType> extends ISwapWrapper<T, OnchainForGasSwap<T>> {
    public readonly TYPE = SwapType.TRUSTED_FROM_BTC;
    public readonly swapDeserializer = OnchainForGasSwap;

    readonly btcRpc: BitcoinRpcWithTxoListener<any>;

    /**
     * @param chainIdentifier
     * @param unifiedStorage Storage interface for the current environment
     * @param unifiedChainEvents On-chain event listener
     * @param contract Underlying contract handling the swaps
     * @param prices Pricing to use
     * @param tokens
     * @param swapDataDeserializer Deserializer for SwapData
     * @param btcRpc Bitcoin RPC which also supports getting transactions by txoHash
     * @param options
     * @param events Instance to use for emitting events
     */
    constructor(
        chainIdentifier: string,
        unifiedStorage: UnifiedSwapStorage<T>,
        unifiedChainEvents: UnifiedSwapEventListener<T>,
        contract: T["Contract"],
        prices: ISwapPrice,
        tokens: WrapperCtorTokens,
        swapDataDeserializer: new (data: any) => T["Data"],
        btcRpc: BitcoinRpcWithTxoListener<any>,
        options?: ISwapWrapperOptions,
        events?: EventEmitter
    ) {
        super(chainIdentifier, unifiedStorage, unifiedChainEvents, contract, prices, tokens, swapDataDeserializer, options, events);
        this.btcRpc = btcRpc;
    }

    /**
     * Returns a newly created swap, receiving 'amount' base units of gas token
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units
     * @param lpOrUrl           Intermediary/Counterparty swap service Intermediary object or raw url
     * @param refundAddress     Bitcoin address to receive refund on in case the counterparty cannot execute the swap
     */
    async create(signer: string, amount: bigint, lpOrUrl: Intermediary | string, refundAddress?: string): Promise<OnchainForGasSwap<T>> {
        if(!this.isInitialized) throw new Error("Not initialized, call init() first!");

        const lpUrl = typeof(lpOrUrl)==="string" ? lpOrUrl : lpOrUrl.url;

        const token = this.contract.getNativeCurrencyAddress();

        const resp = await TrustedIntermediaryAPI.initTrustedFromBTC(this.chainIdentifier, lpUrl, {
            address: signer,
            amount,
            refundAddress,
            token
        }, this.options.getRequestTimeout);

        if(resp.total !== amount) throw new IntermediaryError("Invalid total returned");

        const pricingInfo = await this.verifyReturnedPrice(
            typeof(lpOrUrl)==="string" ?
                {swapFeePPM: 10000, swapBaseFee: 10} :
                lpOrUrl.services[SwapType.TRUSTED_FROM_BTC],
            false, resp.amountSats,
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
            url: lpUrl,
            expiry: resp.expiresAt,
            swapFee: resp.swapFee,
            swapFeeBtc: resp.swapFeeSats,
            feeRate: "",
            exactIn: false,
            token
        } as OnchainForGasSwapInit<T["Data"]>);
        await quote._save();
        return quote;
    }

    public readonly pendingSwapStates = [OnchainForGasSwapState.PR_CREATED];
    public readonly tickSwapState = null;

}
