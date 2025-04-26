import {coinSelect, maxSendable, CoinselectAddressTypes, CoinselectTxInput} from "../coinselect2";
import {BTC_NETWORK} from "@scure/btc-signer/utils"
import {p2wpkh, OutScript, Transaction, p2tr} from "@scure/btc-signer";
import {IBitcoinWallet} from "./IBitcoinWallet";
import {MempoolApi} from "../mempool/MempoolApi";
import {Buffer} from "buffer";
import {randomBytes, toCoinselectAddressType, toOutputScript} from "../../utils/Utils";
import {identifyAddressType, MempoolBitcoinWallet} from "./MempoolBitcoinWallet";
import {add} from "@noble/hashes/_u64";

export type BitcoinWalletUtxo = {
    vout: number,
    txId: string,
    value: number,
    type: CoinselectAddressTypes,
    outputScript: Buffer,
    address: string,
    cpfp?: {
        txVsize: number,
        txEffectiveFeeRate: number
    },
    confirmed: boolean
};

export class SingleAddressBitcoinWallet extends MempoolBitcoinWallet {

    readonly address: string;
    readonly addressType: CoinselectAddressTypes;

    constructor(mempoolApi: MempoolApi, network: BTC_NETWORK, address: string, feeMultiplier: number = 1.25, feeOverride?: number) {
        super(mempoolApi, network, feeMultiplier, feeOverride);
        this.address = address;
        this.addressType = identifyAddressType(address, network);
    }

    sendTransaction(address: string, amount: bigint, feeRate?: number): Promise<string> {
        throw new Error("Not implemented.");
    }
    fundPsbt(psbt: Transaction, feeRate?: number): Promise<Transaction> {
        throw new Error("Not implemented.");
    }
    signPsbt(psbt: Transaction, signInputs: number[]): Promise<Transaction> {
        throw new Error("Not implemented.");
    }

    getTransactionFee(address: string, amount: bigint, feeRate?: number): Promise<number> {
        throw new Error("Not implemented.");
    }
    getFundedPsbtFee(psbt: Transaction, feeRate?: number): Promise<number> {
        throw new Error("Not implemented.");
    }

    getReceiveAddress(): string {
        return this.address;
    }
    getBalance(): Promise<{
        confirmedBalance: bigint,
        unconfirmedBalance: bigint
    }> {
        return this._getBalance(this.address);
    }

    getSpendableBalance(psbt?: Transaction, feeRate?: number): Promise<{
        balance: bigint,
        feeRate: number,
        totalFee: number
    }> {
        return this._getSpendableBalance([{address: this.address, addressType: this.addressType}], psbt, feeRate);
    }

}