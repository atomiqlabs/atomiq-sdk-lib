"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MempoolBitcoinWallet = void 0;
const BN = require("bn.js");
const coinselect2_1 = require("../coinselect2");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const randomBytes = require("randombytes");
const bip371_1 = require("bitcoinjs-lib/src/psbt/bip371");
class MempoolBitcoinWallet {
    constructor(mempoolApi, network, feeMultiplier = 1.25) {
        this.mempoolApi = mempoolApi;
        this.network = network;
        this.feeMultiplier = feeMultiplier;
    }
    _getFeeRate() {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.REACT_APP_OVERRIDE_BITCOIN_FEE != null) {
                return parseInt(process.env.REACT_APP_OVERRIDE_BITCOIN_FEE);
            }
            return Math.floor((yield this.mempoolApi.getFees()).fastestFee * this.feeMultiplier);
        });
    }
    _sendTransaction(rawHex) {
        return this.mempoolApi.sendTransaction(rawHex);
    }
    _getBalance(address) {
        return this.mempoolApi.getAddressBalances(address);
    }
    _getUtxoPool(sendingAddress, sendingAddressType) {
        return __awaiter(this, void 0, void 0, function* () {
            const utxos = yield this.mempoolApi.getAddressUTXOs(sendingAddress);
            let totalSpendable = 0;
            const outputScript = bitcoinjs_lib_1.address.toOutputScript(sendingAddress, this.network);
            const utxoPool = [];
            for (let utxo of utxos) {
                const value = utxo.value.toNumber();
                totalSpendable += value;
                utxoPool.push({
                    vout: utxo.vout,
                    txId: utxo.txid,
                    value: value,
                    type: sendingAddressType,
                    outputScript: outputScript,
                    address: sendingAddress,
                    cpfp: !utxo.status.confirmed ? yield this.mempoolApi.getCPFPData(utxo.txid).then((result) => {
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
        });
    }
    _getPsbt(sendingAccounts, recipient, amount, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            if (feeRate == null)
                feeRate = yield this._getFeeRate();
            const utxoPool = (yield Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();
            console.log("Utxo pool: ", utxoPool);
            const accountPubkeys = {};
            sendingAccounts.forEach(acc => accountPubkeys[acc.address] = acc.pubkey);
            const targets = [
                {
                    address: recipient,
                    value: amount,
                    script: bitcoinjs_lib_1.address.toOutputScript(recipient, this.network)
                }
            ];
            console.log("Coinselect targets: ", targets);
            let coinselectResult = (0, coinselect2_1.coinSelect)(utxoPool, targets, feeRate, sendingAccounts[0].addressType);
            console.log("Coinselect result: ", coinselectResult);
            if (coinselectResult.inputs == null || coinselectResult.outputs == null) {
                return {
                    psbt: null,
                    fee: coinselectResult.fee,
                    inputAddressIndexes: null
                };
            }
            const psbt = new bitcoinjs_lib_1.Psbt({
                network: this.network
            });
            const inputAddressIndexes = {};
            coinselectResult.inputs.forEach((input, index) => {
                var _a;
                var _b;
                (_a = inputAddressIndexes[_b = input.address]) !== null && _a !== void 0 ? _a : (inputAddressIndexes[_b] = []);
                inputAddressIndexes[input.address].push(index);
            });
            console.log("Inputs: ", coinselectResult.inputs);
            psbt.addInputs(yield Promise.all(coinselectResult.inputs.map((input) => __awaiter(this, void 0, void 0, function* () {
                switch (input.type) {
                    case "p2tr":
                        return {
                            hash: input.txId,
                            index: input.vout,
                            witnessUtxo: {
                                script: input.outputScript,
                                value: input.value
                            },
                            tapInternalKey: (0, bip371_1.toXOnly)(Buffer.from(accountPubkeys[input.address], "hex"))
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
                            redeemScript: bitcoinjs_lib_1.payments.p2wpkh({ pubkey: Buffer.from(accountPubkeys[input.address], "hex"), network: this.network }).output,
                            sighashType: 0x01
                        };
                    case "p2pkh":
                        return {
                            hash: input.txId,
                            index: input.vout,
                            nonWitnessUtxo: yield this.mempoolApi.getRawTransaction(input.txId),
                            sighashType: 0x01
                        };
                }
            }))));
            psbt.addOutput({
                script: bitcoinjs_lib_1.address.toOutputScript(recipient, this.network),
                value: amount
            });
            if (coinselectResult.outputs.length > 1) {
                psbt.addOutput({
                    script: bitcoinjs_lib_1.address.toOutputScript(sendingAccounts[0].address, this.network),
                    value: coinselectResult.outputs[1].value
                });
            }
            return {
                psbt,
                fee: coinselectResult.fee,
                inputAddressIndexes
            };
        });
    }
    _getSpendableBalance(sendingAccounts) {
        return __awaiter(this, void 0, void 0, function* () {
            const useFeeRate = yield this._getFeeRate();
            const utxoPool = (yield Promise.all(sendingAccounts.map(acc => this._getUtxoPool(acc.address, acc.addressType)))).flat();
            console.log("Utxo pool: ", utxoPool);
            const target = bitcoinjs_lib_1.payments.p2wsh({
                hash: randomBytes(32),
                network: this.network
            });
            let coinselectResult = (0, coinselect2_1.maxSendable)(utxoPool, target.output, "p2wsh", useFeeRate);
            console.log("Max spendable result: ", coinselectResult);
            return {
                feeRate: useFeeRate,
                balance: new BN(coinselectResult.value),
                totalFee: coinselectResult.fee
            };
        });
    }
}
exports.MempoolBitcoinWallet = MempoolBitcoinWallet;
