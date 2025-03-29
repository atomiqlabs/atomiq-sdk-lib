/// <reference types="node" />
/// <reference types="node" />
import { CoinselectAddressTypes, CoinselectTxInput, CoinselectTxOutput, DUST_THRESHOLDS } from "./utils";
export { CoinselectAddressTypes, CoinselectTxInput, CoinselectTxOutput, DUST_THRESHOLDS };
export declare function coinSelect(utxos: CoinselectTxInput[], outputs: CoinselectTxOutput[], feeRate: number, type: CoinselectAddressTypes): {
    inputs?: CoinselectTxInput[];
    outputs?: CoinselectTxOutput[];
    fee: number;
};
export declare function maxSendable(utxos: CoinselectTxInput[], outputScript: Buffer, outputType: CoinselectAddressTypes, feeRate: number): {
    value: number;
    fee: number;
};
