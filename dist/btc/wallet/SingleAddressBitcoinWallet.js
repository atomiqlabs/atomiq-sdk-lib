"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleAddressBitcoinWallet = void 0;
const MempoolBitcoinWallet_1 = require("./MempoolBitcoinWallet");
class SingleAddressBitcoinWallet extends MempoolBitcoinWallet_1.MempoolBitcoinWallet {
    constructor(mempoolApi, network, address, feeMultiplier = 1.25, feeOverride) {
        super(mempoolApi, network, feeMultiplier, feeOverride);
        this.address = address;
        this.addressType = (0, MempoolBitcoinWallet_1.identifyAddressType)(address, network);
    }
    sendTransaction(address, amount, feeRate) {
        throw new Error("Not implemented.");
    }
    fundPsbt(psbt, feeRate) {
        throw new Error("Not implemented.");
    }
    signPsbt(psbt, signInputs) {
        throw new Error("Not implemented.");
    }
    getTransactionFee(address, amount, feeRate) {
        throw new Error("Not implemented.");
    }
    getFundedPsbtFee(psbt, feeRate) {
        throw new Error("Not implemented.");
    }
    getReceiveAddress() {
        return this.address;
    }
    getBalance() {
        return this._getBalance(this.address);
    }
    getSpendableBalance(psbt, feeRate) {
        return this._getSpendableBalance([{ address: this.address, addressType: this.addressType }], psbt, feeRate);
    }
}
exports.SingleAddressBitcoinWallet = SingleAddressBitcoinWallet;
