/// <reference types="node" />
/// <reference types="node" />
import { CoinselectAddressTypes } from "../coinselect2";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
import { Transaction } from "@scure/btc-signer";
import { MempoolApi } from "../mempool/MempoolApi";
import { Buffer } from "buffer";
import { MempoolBitcoinWallet } from "./MempoolBitcoinWallet";
export type BitcoinWalletUtxo = {
    vout: number;
    txId: string;
    value: number;
    type: CoinselectAddressTypes;
    outputScript: Buffer;
    address: string;
    cpfp?: {
        txVsize: number;
        txEffectiveFeeRate: number;
    };
    confirmed: boolean;
};
export declare class SingleAddressBitcoinWallet extends MempoolBitcoinWallet {
    readonly address: string;
    readonly addressType: CoinselectAddressTypes;
    constructor(mempoolApi: MempoolApi, network: BTC_NETWORK, address: string, feeMultiplier?: number, feeOverride?: number);
    sendTransaction(address: string, amount: bigint, feeRate?: number): Promise<string>;
    fundPsbt(psbt: Transaction, feeRate?: number): Promise<Transaction>;
    signPsbt(psbt: Transaction, signInputs: number[]): Promise<Transaction>;
    getTransactionFee(address: string, amount: bigint, feeRate?: number): Promise<number>;
    getFundedPsbtFee(psbt: Transaction, feeRate?: number): Promise<number>;
    getReceiveAddress(): string;
    getBalance(): Promise<{
        confirmedBalance: bigint;
        unconfirmedBalance: bigint;
    }>;
    getSpendableBalance(psbt?: Transaction, feeRate?: number): Promise<{
        balance: bigint;
        feeRate: number;
        totalFee: number;
    }>;
}
