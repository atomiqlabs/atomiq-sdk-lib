/// <reference types="node" />
/// <reference types="node" />
import { ToBTCLNWrapper } from "./ToBTCLNWrapper";
import { IToBTCSwap, IToBTCSwapInit } from "../IToBTCSwap";
import { SwapType } from "../../SwapType";
import { ChainType, SwapData } from "@atomiqlabs/base";
import { Buffer } from "buffer";
import { LNURLDecodedSuccessAction, LNURLPaySuccessAction } from "../../../utils/LNURL";
import { BtcToken, TokenAmount } from "../../Tokens";
export type ToBTCLNSwapInit<T extends SwapData> = IToBTCSwapInit<T> & {
    confidence: number;
    pr: string;
    lnurl?: string;
    successAction?: LNURLPaySuccessAction;
};
export declare function isToBTCLNSwapInit<T extends SwapData>(obj: any): obj is ToBTCLNSwapInit<T>;
export declare class ToBTCLNSwap<T extends ChainType = ChainType> extends IToBTCSwap<T> {
    protected outputToken: BtcToken<true>;
    protected readonly TYPE = SwapType.TO_BTCLN;
    private readonly confidence;
    private readonly pr;
    lnurl?: string;
    successAction?: LNURLPaySuccessAction;
    private secret?;
    constructor(wrapper: ToBTCLNWrapper<T>, init: ToBTCLNSwapInit<T["Data"]>);
    constructor(wrapper: ToBTCLNWrapper<T>, obj: any);
    _setPaymentResult(result: {
        secret?: string;
        txId?: string;
    }, check?: boolean): Promise<boolean>;
    getOutput(): TokenAmount<T["ChainId"], BtcToken<true>>;
    /**
     * Returns the lightning BOLT11 invoice where the BTC will be sent to
     */
    getLightningInvoice(): string;
    /**
     * Returns payment secret (pre-image) as a proof of payment
     */
    getSecret(): string | null;
    /**
     * Returns the confidence of the intermediary that this payment will succeed
     * Value between 0 and 1, where 0 is not likely and 1 is very likely
     */
    getConfidence(): number;
    getPaymentHash(): Buffer;
    getRecipient(): string;
    /**
     * Is this an LNURL-pay swap?
     */
    isLNURL(): boolean;
    /**
     * Gets the used LNURL or null if this is not an LNURL-pay swap
     */
    getLNURL(): string | null;
    /**
     * Checks whether this LNURL payment contains a success message
     */
    hasSuccessAction(): boolean;
    /**
     * Returns the success action after a successful payment, else null
     */
    getSuccessAction(): LNURLDecodedSuccessAction | null;
    serialize(): any;
}
