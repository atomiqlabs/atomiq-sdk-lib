import {coinSelect, maxSendable, CoinselectAddressTypes} from "../coinselect2";
import {BTC_NETWORK} from "@scure/btc-signer/utils"
import {p2wpkh, Address, OutScript, Transaction, p2tr} from "@scure/btc-signer";
import * as randomBytes from "randombytes";
import {IBitcoinWallet} from "./IBitcoinWallet";
import {MempoolApi} from "../mempool/MempoolApi";
import {Buffer} from "buffer";
import {toOutputScript} from "../../utils/Utils";

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
    network: BTC_NETWORK;
    feeMultiplier: number;

    constructor(mempoolApi: MempoolApi, network: BTC_NETWORK, feeMultiplier: number = 1.25) {
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

    protected _getBalance(address: string): Promise<{ confirmedBalance: bigint; unconfirmedBalance: bigint }> {
        return this.mempoolApi.getAddressBalances(address);
    }

    protected async _getUtxoPool(
        sendingAddress: string,
        sendingAddressType: CoinselectAddressTypes
    ): Promise<BitcoinWalletUtxo[]> {
        const utxos = await this.mempoolApi.getAddressUTXOs(sendingAddress);

        let totalSpendable = 0;

        const outputScript = toOutputScript(this.network, sendingAddress);

        const utxoPool: BitcoinWalletUtxo[] = [];

        for(let utxo of utxos) {
            const value = Number(utxo.value);
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
    ): Promise<{psbt: Transaction, fee: number, inputAddressIndexes: {[address: string]: number[]}}> {
        if(feeRate==null) feeRate = await this._getFeeRate();

        const utxoPool: BitcoinWalletUtxo[] = (await Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();

        console.log("Utxo pool: ", utxoPool);

        const accountPubkeys = {};
        sendingAccounts.forEach(acc => accountPubkeys[acc.address] = acc.pubkey);

        const targets = [
            {
                address: recipient,
                value: amount,
                script: toOutputScript(this.network, recipient)
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

        const psbt = new Transaction({PSBTVersion: 0});

        const inputAddressIndexes: {[address: string]: number[]} = {};
        coinselectResult.inputs.forEach((input, index) => {
            inputAddressIndexes[input.address] ??= [];
            inputAddressIndexes[input.address].push(index);
        });

        console.log("Inputs: ", coinselectResult.inputs);

        const formattedInputs = await Promise.all(coinselectResult.inputs.map(async (input) => {
            switch(input.type) {
                case "p2tr":
                    const parsed = p2tr(Buffer.from(accountPubkeys[input.address], "hex"));
                    return {
                        txid: input.txId,
                        index: input.vout,
                        witnessUtxo: {
                            script: input.outputScript,
                            amount: BigInt(input.value)
                        },
                        tapInternalKey: parsed.tapInternalKey,
                        tapMerkleRoot: parsed.tapMerkleRoot,
                        tapLeafScript: parsed.tapLeafScript
                    };
                case "p2wpkh":
                    return {
                        txid: input.txId,
                        index: input.vout,
                        witnessUtxo: {
                            script: input.outputScript,
                            amount: BigInt(input.value)
                        },
                        sighashType: 0x01
                    };
                case "p2sh-p2wpkh":
                    return {
                        txid: input.txId,
                        index: input.vout,
                        witnessUtxo: {
                            script: input.outputScript,
                            amount: BigInt(input.value)
                        },
                        redeemScript: p2wpkh(Buffer.from(accountPubkeys[input.address], "hex"), this.network).script,
                        sighashType: 0x01
                    };
                case "p2pkh":
                    return {
                        txid: input.txId,
                        index: input.vout,
                        nonWitnessUtxo: await this.mempoolApi.getRawTransaction(input.txId),
                        sighashType: 0x01
                    };
            }
        }));

        formattedInputs.forEach(input => psbt.addInput(input));

        psbt.addOutput({
            script: toOutputScript(this.network, recipient),
            amount: BigInt(amount)
        });

        if(coinselectResult.outputs.length>1) {
            psbt.addOutput({
                script: toOutputScript(this.network, sendingAccounts[0].address),
                amount: BigInt(Math.floor(coinselectResult.outputs[1].value))
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
        balance: bigint,
        feeRate: number,
        totalFee: number
    }> {
        const useFeeRate = await this._getFeeRate();

        const utxoPool: BitcoinWalletUtxo[] = (await Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();

        console.log("Utxo pool: ", utxoPool);

        const target = OutScript.encode({
            type: "wsh",
            hash: randomBytes(32)
        });

        let coinselectResult = maxSendable(utxoPool, Buffer.from(target), "p2wsh", useFeeRate);

        console.log("Max spendable result: ", coinselectResult);

        return {
            feeRate: useFeeRate,
            balance: BigInt(Math.floor(coinselectResult.value)),
            totalFee: coinselectResult.fee
        }
    }

    abstract sendTransaction(address: string, amount: bigint, feeRate?: number): Promise<string>;
    abstract getTransactionFee(address: string, amount: bigint, feeRate?: number): Promise<number>;
    abstract getReceiveAddress(): string;
    abstract getBalance(): Promise<{
        confirmedBalance: bigint,
        unconfirmedBalance: bigint
    }>;
    abstract getSpendableBalance(): Promise<{
        balance: bigint,
        feeRate: number,
        totalFee: number
    }>;

}