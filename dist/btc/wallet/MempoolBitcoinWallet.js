"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MempoolBitcoinWallet = void 0;
const coinselect2_1 = require("../coinselect2");
const btc_signer_1 = require("@scure/btc-signer");
const buffer_1 = require("buffer");
const Utils_1 = require("../../utils/Utils");
class MempoolBitcoinWallet {
    constructor(mempoolApi, network, feeMultiplier = 1.25, feeOverride) {
        this.mempoolApi = mempoolApi;
        this.network = network;
        this.feeMultiplier = feeMultiplier;
        this.feeOverride = feeOverride;
    }
    async getFeeRate() {
        if (this.feeOverride != null) {
            return this.feeOverride;
        }
        return Math.floor((await this.mempoolApi.getFees()).fastestFee * this.feeMultiplier);
    }
    _sendTransaction(rawHex) {
        return this.mempoolApi.sendTransaction(rawHex);
    }
    _getBalance(address) {
        return this.mempoolApi.getAddressBalances(address);
    }
    async _getUtxoPool(sendingAddress, sendingAddressType) {
        const utxos = await this.mempoolApi.getAddressUTXOs(sendingAddress);
        let totalSpendable = 0;
        const outputScript = (0, Utils_1.toOutputScript)(this.network, sendingAddress);
        const utxoPool = [];
        for (let utxo of utxos) {
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
                    if (result.effectiveFeePerVsize == null)
                        return null;
                    return {
                        txVsize: result.adjustedVsize,
                        txEffectiveFeeRate: result.effectiveFeePerVsize
                    };
                }) : null,
                confirmed: utxo.status.confirmed
            });
        }
        console.log("Total spendable value: " + totalSpendable + " num utxos: " + utxoPool.length);
        return utxoPool;
    }
    async _getPsbt(sendingAccounts, recipient, amount, feeRate) {
        const psbt = new btc_signer_1.Transaction({ PSBTVersion: 0 });
        psbt.addOutput({
            amount: BigInt(amount),
            script: (0, Utils_1.toOutputScript)(this.network, recipient)
        });
        return this._fundPsbt(sendingAccounts, psbt, feeRate);
    }
    async _fundPsbt(sendingAccounts, psbt, feeRate) {
        if (feeRate == null)
            feeRate = await this.getFeeRate();
        const utxoPool = (await Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();
        console.log("_fundPsbt(): fee rate: " + feeRate + " utxo pool: ", utxoPool);
        const accountPubkeys = {};
        sendingAccounts.forEach(acc => accountPubkeys[acc.address] = acc.pubkey);
        const requiredInputs = [];
        for (let i = 0; i < psbt.inputsLength; i++) {
            const input = psbt.getInput(i);
            let amount = input.witnessUtxo != null ? input.witnessUtxo.amount : input.nonWitnessUtxo.outputs[input.index].amount;
            let script = input.witnessUtxo != null ? input.witnessUtxo.script : input.nonWitnessUtxo.outputs[input.index].script;
            requiredInputs.push({
                txId: buffer_1.Buffer.from(input.txid).toString('hex'),
                vout: input.index,
                value: Number(amount),
                type: (0, Utils_1.toCoinselectAddressType)(script)
            });
        }
        const targets = [];
        for (let i = 0; i < psbt.outputsLength; i++) {
            const output = psbt.getOutput(i);
            targets.push({
                value: Number(output.amount),
                script: buffer_1.Buffer.from(output.script)
            });
        }
        console.log("Coinselect targets: ", targets);
        let coinselectResult = (0, coinselect2_1.coinSelect)(utxoPool, targets, feeRate, sendingAccounts[0].addressType, requiredInputs);
        console.log("Coinselect result: ", coinselectResult);
        if (coinselectResult.inputs == null || coinselectResult.outputs == null) {
            return {
                psbt: null,
                fee: coinselectResult.fee,
                inputAddressIndexes: null
            };
        }
        // Remove in/outs that are already in the PSBT
        coinselectResult.inputs.splice(0, psbt.inputsLength);
        coinselectResult.outputs.splice(0, psbt.outputsLength);
        const inputAddressIndexes = {};
        coinselectResult.inputs.forEach((input, index) => {
            inputAddressIndexes[input.address] ??= [];
            inputAddressIndexes[input.address].push(index);
        });
        console.log("Inputs: ", coinselectResult.inputs);
        const formattedInputs = await Promise.all(coinselectResult.inputs.map(async (input) => {
            switch (input.type) {
                case "p2tr":
                    const parsed = (0, btc_signer_1.p2tr)(buffer_1.Buffer.from(accountPubkeys[input.address], "hex"));
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
                        redeemScript: (0, btc_signer_1.p2wpkh)(buffer_1.Buffer.from(accountPubkeys[input.address], "hex"), this.network).script,
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
        coinselectResult.outputs.forEach(output => {
            if (output.script == null && output.address == null) {
                //Change output
                psbt.addOutput({
                    script: (0, Utils_1.toOutputScript)(this.network, sendingAccounts[0].address),
                    amount: BigInt(Math.floor(output.value))
                });
            }
            else {
                psbt.addOutput({
                    script: output.script ?? (0, Utils_1.toOutputScript)(this.network, output.address),
                    amount: BigInt(output.value)
                });
            }
        });
        return {
            psbt,
            fee: coinselectResult.fee,
            inputAddressIndexes
        };
    }
    async _getSpendableBalance(sendingAccounts, psbt) {
        const useFeeRate = await this.getFeeRate();
        const utxoPool = (await Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();
        console.log("Utxo pool: ", utxoPool);
        const requiredInputs = [];
        if (psbt != null)
            for (let i = 0; i < psbt.inputsLength; i++) {
                const input = psbt.getInput(i);
                let amount = input.witnessUtxo != null ? input.witnessUtxo.amount : input.nonWitnessUtxo.outputs[input.index].amount;
                let script = input.witnessUtxo != null ? input.witnessUtxo.script : input.nonWitnessUtxo.outputs[input.index].script;
                requiredInputs.push({
                    txId: buffer_1.Buffer.from(input.txid).toString('hex'),
                    vout: input.index,
                    value: Number(amount),
                    type: (0, Utils_1.toCoinselectAddressType)(script)
                });
            }
        console.log("Coinselect requiredInputs: ", requiredInputs);
        const additionalOutputs = [];
        if (psbt != null)
            for (let i = 0; i < psbt.outputsLength; i++) {
                const output = psbt.getOutput(i);
                additionalOutputs.push({
                    value: Number(output.amount),
                    script: buffer_1.Buffer.from(output.script)
                });
            }
        console.log("Coinselect additionalOutputs: ", additionalOutputs);
        const target = btc_signer_1.OutScript.encode({
            type: "wsh",
            hash: (0, Utils_1.randomBytes)(32)
        });
        let coinselectResult = (0, coinselect2_1.maxSendable)(utxoPool, { script: buffer_1.Buffer.from(target), type: "p2wsh" }, useFeeRate, requiredInputs, additionalOutputs);
        console.log("Max spendable result: ", coinselectResult);
        return {
            feeRate: useFeeRate,
            balance: BigInt(Math.floor(coinselectResult.value)),
            totalFee: coinselectResult.fee
        };
    }
}
exports.MempoolBitcoinWallet = MempoolBitcoinWallet;
