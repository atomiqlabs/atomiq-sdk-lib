/// <reference types="node" />
/// <reference types="node" />
import * as BN from "bn.js";
import { CoinselectAddressTypes } from "../coinselect2/utils";
import { networks, Psbt } from "bitcoinjs-lib";
import { IBitcoinWallet } from "./IBitcoinWallet";
import { MempoolApi } from "../mempool/MempoolApi";
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
export declare abstract class BitcoinWallet implements IBitcoinWallet {
    mempoolApi: MempoolApi;
    network: networks.Network;
    feeMultiplier: number;
    constructor(mempoolApi: MempoolApi, network: networks.Network, feeMultiplier?: number);
    protected _getFeeRate(): Promise<number>;
    protected _sendTransaction(rawHex: string): Promise<string>;
    protected _getBalance(address: string): Promise<{
        confirmedBalance: BN;
        unconfirmedBalance: BN;
    }>;
    protected _getUtxoPool(sendingAddress: string, sendingAddressType: CoinselectAddressTypes): Promise<BitcoinWalletUtxo[]>;
    protected _getPsbt(sendingAccounts: {
        pubkey: string;
        address: string;
        addressType: CoinselectAddressTypes;
    }[], recipient: string, amount: number, feeRate?: number): Promise<{
        psbt: Psbt;
        fee: number;
        inputAddressIndexes: {
            [address: string]: number[];
        };
    }>;
    protected _getSpendableBalance(sendingAccounts: {
        address: string;
        addressType: CoinselectAddressTypes;
    }[]): Promise<{
        balance: BN;
        feeRate: number;
        totalFee: number;
    }>;
    abstract sendTransaction(address: string, amount: BN, feeRate?: number): Promise<string>;
    abstract getTransactionFee(address: string, amount: BN, feeRate?: number): Promise<number>;
    abstract getReceiveAddress(): string;
    abstract getBalance(): Promise<{
        confirmedBalance: BN;
        unconfirmedBalance: BN;
    }>;
    abstract getSpendableBalance(): Promise<{
        balance: BN;
        feeRate: number;
        totalFee: number;
    }>;
}
