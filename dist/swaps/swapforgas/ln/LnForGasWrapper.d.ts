import * as BN from "bn.js";
import { LnForGasSwap } from "./LnForGasSwap";
import { ISwapWrapper } from "../../ISwapWrapper";
import { ChainType } from "@atomiqlabs/base";
import { Intermediary } from "../../../intermediaries/Intermediary";
export declare class LnForGasWrapper<T extends ChainType> extends ISwapWrapper<T, LnForGasSwap<T>> {
    protected readonly swapDeserializer: typeof LnForGasSwap;
    /**
     * Returns a newly created swap, receiving 'amount' on lightning network
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units (satoshis)
     * @param lpOrUrl           Intermediary/Counterparty swap service Intermediary object or raw url
     */
    create(signer: string, amount: BN, lpOrUrl: Intermediary | string): Promise<LnForGasSwap<T>>;
    protected checkPastSwap(swap: LnForGasSwap<T>): Promise<boolean>;
    protected isOurSwap(signer: string, swap: LnForGasSwap<T>): boolean;
    protected tickSwap(swap: LnForGasSwap<T>): void;
}
