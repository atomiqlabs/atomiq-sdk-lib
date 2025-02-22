/// <reference types="node" />
/// <reference types="node" />
import { SwapType } from "../../SwapType";
import * as BN from "bn.js";
import { ChainType, SwapData } from "@atomiqlabs/base";
import { Buffer } from "buffer";
import { Fee, ISwap, ISwapInit } from "../../ISwap";
import { PriceInfoType } from "../../../prices/abstract/ISwapPrice";
import { BtcToken, SCToken, TokenAmount } from "../../Tokens";
import { OnchainForGasWrapper } from "./OnchainForGasWrapper";
export declare enum OnchainForGasSwapState {
    EXPIRED = -3,
    FAILED = -2,
    REFUNDED = -1,
    PR_CREATED = 0,
    FINISHED = 1,
    REFUNDABLE = 2
}
export type OnchainForGasSwapInit<T extends SwapData> = ISwapInit<T> & {
    paymentHash: string;
    sequence: BN;
    address: string;
    inputAmount: BN;
    outputAmount: BN;
    recipient: string;
    token: string;
    refundAddress?: string;
};
export declare function isOnchainForGasSwapInit<T extends SwapData>(obj: any): obj is OnchainForGasSwapInit<T>;
export declare class OnchainForGasSwap<T extends ChainType = ChainType> extends ISwap<T, OnchainForGasSwapState> {
    protected readonly TYPE: SwapType;
    private readonly paymentHash;
    private readonly sequence;
    private readonly address;
    private readonly recipient;
    private readonly token;
    private inputAmount;
    private outputAmount;
    private refundAddress;
    scTxId: string;
    txId: string;
    refundTxId: string;
    wrapper: OnchainForGasWrapper<T>;
    constructor(wrapper: OnchainForGasWrapper<T>, init: OnchainForGasSwapInit<T["Data"]>);
    constructor(wrapper: OnchainForGasWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryCalculateSwapFee(): void;
    refreshPriceData(): Promise<PriceInfoType>;
    getSwapPrice(): number;
    getMarketPrice(): number;
    getInputAddress(): string | null;
    getOutputAddress(): string | null;
    getInputTxId(): string | null;
    getOutputTxId(): string | null;
    getRecipient(): string;
    getIdentifierHash(): Buffer;
    getPaymentHash(): Buffer;
    getAddress(): string;
    /**
     * Returns bitcoin address where the on-chain BTC should be sent to
     */
    getBitcoinAddress(): string;
    getQrData(): string;
    getTimeoutTime(): number;
    isFinished(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    isFailed(): boolean;
    isSuccessful(): boolean;
    isQuoteValid(): Promise<boolean>;
    isActionable(): boolean;
    protected getOutAmountWithoutFee(): BN;
    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken<false>>;
    getInput(): TokenAmount<T["ChainId"], BtcToken<false>>;
    getSwapFee(): Fee;
    getRealSwapFeePercentagePPM(): BN;
    checkAddress(save?: boolean): Promise<boolean>;
    /**
     * A blocking promise resolving when payment was received by the intermediary and client can continue
     * rejecting in case of failure
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    waitForPayment(abortSignal?: AbortSignal, checkIntervalSeconds?: number, updateCallback?: (txId: string, txEtaMs: number) => void): Promise<boolean>;
    waitTillRefunded(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<void>;
    setRefundAddress(refundAddress: string): Promise<void>;
    requestRefund(refundAddress?: string, abortSignal?: AbortSignal): Promise<void>;
    serialize(): any;
    getInitiator(): string;
    hasEnoughForTxFees(): Promise<{
        enoughBalance: boolean;
        balance: TokenAmount;
        required: TokenAmount;
    }>;
}
