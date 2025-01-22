/// <reference types="node" />
/// <reference types="node" />
import { SwapType } from "../../SwapType";
import * as BN from "bn.js";
import { ChainType, SwapData } from "@atomiqlabs/base";
import { LnForGasWrapper } from "./LnForGasWrapper";
import { Buffer } from "buffer";
import { Fee, ISwap, ISwapInit } from "../../ISwap";
import { PriceInfoType } from "../../../prices/abstract/ISwapPrice";
import { BtcToken, SCToken, TokenAmount } from "../../Tokens";
export declare enum LnForGasSwapState {
    EXPIRED = -2,
    FAILED = -1,
    PR_CREATED = 0,
    PR_PAID = 1,
    FINISHED = 2
}
export type LnForGasSwapInit<T extends SwapData> = ISwapInit<T> & {
    pr: string;
    outputAmount: BN;
    recipient: string;
};
export declare function isLnForGasSwapInit<T extends SwapData>(obj: any): obj is LnForGasSwapInit<T>;
export declare class LnForGasSwap<T extends ChainType = ChainType> extends ISwap<T, LnForGasSwapState> {
    getSmartChainNetworkFee: any;
    protected readonly currentVersion: number;
    protected readonly TYPE: SwapType;
    private readonly pr;
    private readonly outputAmount;
    private readonly recipient;
    scTxId: string;
    constructor(wrapper: LnForGasWrapper<T>, init: LnForGasSwapInit<T["Data"]>);
    constructor(wrapper: LnForGasWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryCalculateSwapFee(): void;
    refreshPriceData(): Promise<PriceInfoType>;
    getSwapPrice(): number;
    getMarketPrice(): number;
    getTxId(): string | null;
    getRecipient(): string;
    getPaymentHash(): Buffer;
    /**
     * Returns the lightning network BOLT11 invoice that needs to be paid as an input to the swap
     */
    getLightningInvoice(): string;
    /**
     * Returns a string that can be displayed as QR code representation of the lightning invoice (with lightning: prefix)
     */
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
    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken<true>>;
    getInput(): TokenAmount<T["ChainId"], BtcToken<true>>;
    getSwapFee(): Fee;
    getRealSwapFeePercentagePPM(): BN;
    checkInvoicePaid(save?: boolean): Promise<boolean>;
    /**
     * A blocking promise resolving when payment was received by the intermediary and client can continue
     * rejecting in case of failure
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    waitForPayment(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<void>;
    serialize(): any;
    getInitiator(): string;
    hasEnoughForTxFees(): Promise<{
        enoughBalance: boolean;
        balance: TokenAmount;
        required: TokenAmount;
    }>;
}
