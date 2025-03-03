/// <reference types="node" />
import { ISwapWrapper, ISwapWrapperOptions, WrapperCtorTokens } from "../../ISwapWrapper";
import { ChainType } from "@atomiqlabs/base";
import { OnchainForGasSwap, OnchainForGasSwapState } from "./OnchainForGasSwap";
import { BitcoinRpcWithTxoListener } from "../../../btc/BitcoinRpcWithTxoListener";
import { ISwapPrice } from "../../../prices/abstract/ISwapPrice";
import { EventEmitter } from "events";
import { Intermediary } from "../../../intermediaries/Intermediary";
import { SwapType } from "../../SwapType";
import { UnifiedSwapEventListener } from "../../../events/UnifiedSwapEventListener";
import { UnifiedSwapStorage } from "../../../swap-storage/UnifiedSwapStorage";
export declare class OnchainForGasWrapper<T extends ChainType> extends ISwapWrapper<T, OnchainForGasSwap<T>> {
    readonly TYPE = SwapType.TRUSTED_FROM_BTC;
    readonly swapDeserializer: typeof OnchainForGasSwap;
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
    constructor(chainIdentifier: string, unifiedStorage: UnifiedSwapStorage<T>, unifiedChainEvents: UnifiedSwapEventListener<T>, contract: T["Contract"], prices: ISwapPrice, tokens: WrapperCtorTokens, swapDataDeserializer: new (data: any) => T["Data"], btcRpc: BitcoinRpcWithTxoListener<any>, options?: ISwapWrapperOptions, events?: EventEmitter);
    /**
     * Returns a newly created swap, receiving 'amount' base units of gas token
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units
     * @param lpOrUrl           Intermediary/Counterparty swap service Intermediary object or raw url
     * @param refundAddress     Bitcoin address to receive refund on in case the counterparty cannot execute the swap
     */
    create(signer: string, amount: bigint, lpOrUrl: Intermediary | string, refundAddress?: string): Promise<OnchainForGasSwap<T>>;
    readonly pendingSwapStates: OnchainForGasSwapState[];
    readonly tickSwapState: any;
}
