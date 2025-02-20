import * as BN from "bn.js";
import {coinSelect, maxSendable, CoinselectAddressTypes} from "../coinselect2";
import {networks, address, Psbt, payments} from "bitcoinjs-lib";
import * as randomBytes from "randombytes";
import {
    toXOnly,
} from 'bitcoinjs-lib/src/psbt/bip371';
import {IBitcoinWallet} from "./IBitcoinWallet";
import {MempoolApi} from "../mempool/MempoolApi";

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

export abstract class MempoolBitcoinWallet implements IBitcoinWallet {

    mempoolApi: MempoolApi;
    network: networks.Network;
    feeMultiplier: number;

    constructor(mempoolApi: MempoolApi, network: networks.Network, feeMultiplier: number = 1.25) {
        this.mempoolApi = mempoolApi;
        this.network = network;
        this.feeMultiplier = feeMultiplier;
    }

    protected async _getFeeRate(): Promise<number> {
        if(process.env.REACT_APP_OVERRIDE_BITCOIN_FEE!=null) {
            return parseInt(process.env.REACT_APP_OVERRIDE_BITCOIN_FEE);
        }
        return Math.floor((await this.mempoolApi.getFees()).fastestFee*this.feeMultiplier);
    }

    protected _sendTransaction(rawHex: string): Promise<string> {
        return this.mempoolApi.sendTransaction(rawHex);
    }

    protected _getBalance(address: string): Promise<{ confirmedBalance: BN; unconfirmedBalance: BN }> {
        return this.mempoolApi.getAddressBalances(address);
    }

    protected async _getUtxoPool(
        sendingAddress: string,
        sendingAddressType: CoinselectAddressTypes
    ): Promise<BitcoinWalletUtxo[]> {

        const utxos = await this.mempoolApi.getAddressUTXOs(sendingAddress);

        let totalSpendable = 0;

        const outputScript = address.toOutputScript(sendingAddress, this.network);

        const utxoPool: BitcoinWalletUtxo[] = [];

        for(let utxo of utxos) {
            const value = utxo.value.toNumber();
            totalSpendable += value;
            utxoPool.push({
                vout: utxo.vout,
                txId: utxo.txid,
                value: value,
                type: sendingAddressType,
                outputScript: outputScript,
                address: sendingAddress,
                cpfp: !utxo.status.confirmed ? await this.mempoolApi.getCPFPData(utxo.txid).then((result) => {
                    if(result.effectiveFeePerVsize==null) return null;
                    return {
                        txVsize: result.adjustedVsize,
                        txEffectiveFeeRate: result.effectiveFeePerVsize
                    }
                }) : null,
                confirmed: utxo.status.confirmed
            })
        }

        console.log("Total spendable value: "+totalSpendable+" num utxos: "+utxoPool.length);

        return utxoPool;
    }

    protected async _getPsbt(
        sendingAccounts: {
            pubkey: string,
            address: string,
            addressType: CoinselectAddressTypes,
        }[],
        recipient: string,
        amount: number,
        feeRate?: number
    ): Promise<{psbt: Psbt, fee: number, inputAddressIndexes: {[address: string]: number[]}}> {
        if(feeRate==null) feeRate = await this._getFeeRate();

        const utxoPool: BitcoinWalletUtxo[] = (await Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();

        console.log("Utxo pool: ", utxoPool);

        const accountPubkeys = {};
        sendingAccounts.forEach(acc => accountPubkeys[acc.address] = acc.pubkey);

        const targets = [
            {
                address: recipient,
                value: amount,
                script: address.toOutputScript(recipient, this.network)
            }
        ];
        console.log("Coinselect targets: ", targets);

        let coinselectResult = coinSelect(utxoPool, targets, feeRate, sendingAccounts[0].addressType);
        console.log("Coinselect result: ", coinselectResult);

        if(coinselectResult.inputs==null || coinselectResult.outputs==null) {
            return {
                psbt: null,
                fee: coinselectResult.fee,
                inputAddressIndexes: null
            };
        }

        const psbt = new Psbt({
            network: this.network
        });

        const inputAddressIndexes: {[address: string]: number[]} = {};
        coinselectResult.inputs.forEach((input, index) => {
            inputAddressIndexes[input.address] ??= [];
            inputAddressIndexes[input.address].push(index);
        });

        console.log("Inputs: ", coinselectResult.inputs);

        psbt.addInputs(await Promise.all(coinselectResult.inputs.map(async (input) => {
            switch(input.type) {
                case "p2tr":
                    return {
                        hash: input.txId,
                        index: input.vout,
                        witnessUtxo: {
                            script: input.outputScript,
                            value: input.value
                        },
                        tapInternalKey: toXOnly(Buffer.from(accountPubkeys[input.address], "hex"))
                    };
                case "p2wpkh":
                    return {
                        hash: input.txId,
                        index: input.vout,
                        witnessUtxo: {
                            script: input.outputScript,
                            value: input.value
                        },
                        sighashType: 0x01
                    };
                case "p2sh-p2wpkh":
                    return {
                        hash: input.txId,
                        index: input.vout,
                        witnessUtxo: {
                            script: input.outputScript,
                            value: input.value
                        },
                        redeemScript: payments.p2wpkh({pubkey: Buffer.from(accountPubkeys[input.address], "hex"), network: this.network}).output,
                        sighashType: 0x01
                    };
                case "p2pkh":
                    return {
                        hash: input.txId,
                        index: input.vout,
                        nonWitnessUtxo: await this.mempoolApi.getRawTransaction(input.txId),
                        sighashType: 0x01
                    };
            }
        })));

        psbt.addOutput({
            script: address.toOutputScript(recipient, this.network),
            value: amount
        });

        if(coinselectResult.outputs.length>1) {
            psbt.addOutput({
                script: address.toOutputScript(sendingAccounts[0].address, this.network),
                value: coinselectResult.outputs[1].value
            });
        }

        return {
            psbt,
            fee: coinselectResult.fee,
            inputAddressIndexes
        };
    }

    protected async _getSpendableBalance(
        sendingAccounts: {
            address: string,
            addressType: CoinselectAddressTypes,
        }[],
    ): Promise<{
        balance: BN,
        feeRate: number,
        totalFee: number
    }> {
        const useFeeRate = await this._getFeeRate();

        const utxoPool: BitcoinWalletUtxo[] = (await Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();

        console.log("Utxo pool: ", utxoPool);

        const target = payments.p2wsh({
            hash: randomBytes(32),
            network: this.network
        });

        let coinselectResult = maxSendable(utxoPool, target.output, "p2wsh", useFeeRate);

        console.log("Max spendable result: ", coinselectResult);

        return {
            feeRate: useFeeRate,
            balance: new BN(coinselectResult.value),
            totalFee: coinselectResult.fee
        }
    }

    abstract sendTransaction(address: string, amount: BN, feeRate?: number): Promise<string>;
    abstract getTransactionFee(address: string, amount: BN, feeRate?: number): Promise<number>;
    abstract getReceiveAddress(): string;
    abstract getBalance(): Promise<{
        confirmedBalance: BN,
        unconfirmedBalance: BN
    }>;
    abstract getSpendableBalance(): Promise<{
        balance: BN,
        feeRate: number,
        totalFee: number
    }>;

}