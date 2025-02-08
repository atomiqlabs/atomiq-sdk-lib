import { ToBTCWrapper } from "./ToBTCWrapper";
import { IToBTCSwap, IToBTCSwapInit } from "../IToBTCSwap";
import { SwapType } from "../../SwapType";
import * as BN from "bn.js";
import { ChainType, SwapData } from "@atomiqlabs/base";
import { BtcToken, TokenAmount } from "../../Tokens";
export type ToBTCSwapInit<T extends SwapData> = IToBTCSwapInit<T> & {
    address: string;
    amount: BN;
    confirmationTarget: number;
    satsPerVByte: number;
    requiredConfirmations: number;
    nonce: BN;
};
export declare function isToBTCSwapInit<T extends SwapData>(obj: any): obj is ToBTCSwapInit<T>;
export declare class ToBTCSwap<T extends ChainType = ChainType> extends IToBTCSwap<T> {
    protected readonly outputToken: BtcToken<false>;
    protected readonly TYPE = SwapType.TO_BTC;
    protected readonly wrapper: ToBTCWrapper<T>;
    private readonly address;
    private readonly amount;
    private readonly confirmationTarget;
    private readonly satsPerVByte;
    private readonly requiredConfirmations;
    private readonly nonce;
    private txId?;
    constructor(wrapper: ToBTCWrapper<T>, serializedObject: any);
    constructor(wrapper: ToBTCWrapper<T>, init: ToBTCSwapInit<T["Data"]>);
    _setPaymentResult(result: {
        secret?: string;
        txId?: string;
    }, check?: boolean): Promise<boolean>;
    getOutput(): TokenAmount<T["ChainId"], BtcToken<false>>;
    /**
     * Returns fee rate of the bitcoin transaction in sats/vB
     */
    getBitcoinFeeRate(): number;
    /**
     * Returns the bitcoin address where the BTC will be sent to
     */
    getBitcoinAddress(): string;
    /**
     * Returns the transaction ID of the transaction sending the BTC
     */
    getBitcoinTxId(): string | null;
    getRecipient(): string;
    serialize(): any;
}
