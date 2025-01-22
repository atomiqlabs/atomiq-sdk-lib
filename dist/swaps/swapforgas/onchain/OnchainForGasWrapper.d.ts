/// <reference types="node" />
import * as BN from "bn.js";
import { ISwapWrapper, ISwapWrapperOptions, WrapperCtorTokens } from "../../ISwapWrapper";
import { ChainType, IStorageManager } from "@atomiqlabs/base";
import { OnchainForGasSwap } from "./OnchainForGasSwap";
import { BitcoinRpcWithTxoListener } from "../../../btc/BitcoinRpcWithTxoListener";
import { ISwapPrice } from "../../../prices/abstract/ISwapPrice";
import { EventEmitter } from "events";
import { Intermediary } from "../../../intermediaries/Intermediary";
export declare class OnchainForGasWrapper<T extends ChainType> extends ISwapWrapper<T, OnchainForGasSwap<T>> {
    protected readonly swapDeserializer: typeof OnchainForGasSwap;
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
    constructor(chainIdentifier: string, storage: IStorageManager<OnchainForGasSwap<T>>, contract: T["Contract"], chainEvents: T["Events"], prices: ISwapPrice, tokens: WrapperCtorTokens, swapDataDeserializer: new (data: any) => T["Data"], btcRpc: BitcoinRpcWithTxoListener<any>, options?: ISwapWrapperOptions, events?: EventEmitter);
    /**
     * Returns a newly created swap, receiving 'amount' base units of gas token
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units
     * @param lpOrUrl           Intermediary/Counterparty swap service Intermediary object or raw url
     * @param refundAddress     Bitcoin address to receive refund on in case the counterparty cannot execute the swap
     */
    create(signer: string, amount: BN, lpOrUrl: Intermediary | string, refundAddress?: string): Promise<OnchainForGasSwap<T>>;
    protected checkPastSwap(swap: OnchainForGasSwap<T>): Promise<boolean>;
    protected isOurSwap(signer: string, swap: OnchainForGasSwap<T>): boolean;
    protected tickSwap(swap: OnchainForGasSwap<T>): void;
}
