/// <reference types="node" />
/// <reference types="node" />
import { CoinselectAddressTypes } from "../coinselect2";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
import { Transaction } from "@scure/btc-signer";
import { IBitcoinWallet } from "./IBitcoinWallet";
import { MempoolApi } from "../mempool/MempoolApi";
import { Buffer } from "buffer";
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
export declare abstract class MempoolBitcoinWallet implements IBitcoinWallet {
    mempoolApi: MempoolApi;
    network: BTC_NETWORK;
    feeMultiplier: number;
    constructor(mempoolApi: MempoolApi, network: BTC_NETWORK, feeMultiplier?: number);
    protected _getFeeRate(): Promise<number>;
    protected _sendTransaction(rawHex: string): Promise<string>;
    protected _getBalance(address: string): Promise<{
        confirmedBalance: bigint;
        unconfirmedBalance: bigint;
    }>;
    protected _getUtxoPool(sendingAddress: string, sendingAddressType: CoinselectAddressTypes): Promise<BitcoinWalletUtxo[]>;
    protected _getPsbt(sendingAccounts: {
        pubkey: string;
        address: string;
        addressType: CoinselectAddressTypes;
    }[], recipient: string, amount: number, feeRate?: number): Promise<{
        psbt: Transaction;
        fee: number;
        inputAddressIndexes: {
            [address: string]: number[];
        };
    }>;
    protected _getSpendableBalance(sendingAccounts: {
        address: string;
        addressType: CoinselectAddressTypes;
    }[]): Promise<{
        balance: bigint;
        feeRate: number;
        totalFee: number;
    }>;
    abstract sendTransaction(address: string, amount: bigint, feeRate?: number): Promise<string>;
    abstract getTransactionFee(address: string, amount: bigint, feeRate?: number): Promise<number>;
    abstract getReceiveAddress(): string;
    abstract getBalance(): Promise<{
        confirmedBalance: bigint;
        unconfirmedBalance: bigint;
    }>;
    abstract getSpendableBalance(): Promise<{
        balance: bigint;
        feeRate: number;
        totalFee: number;
    }>;
}
