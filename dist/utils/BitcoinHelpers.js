"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toBitcoinWallet = exports.parsePsbtTransaction = void 0;
const btc_signer_1 = require("@scure/btc-signer");
const buffer_1 = require("buffer");
const IBitcoinWallet_1 = require("../btc/wallet/IBitcoinWallet");
const SingleAddressBitcoinWallet_1 = require("../btc/wallet/SingleAddressBitcoinWallet");
/**
 * General parsers for PSBTs, can parse hex or base64 encoded PSBTs
 * @param _psbt
 */
function parsePsbtTransaction(_psbt) {
    if (typeof (_psbt) === "string") {
        let rawPsbt;
        if (/[0-9a-f]+/i.test(_psbt)) {
            //Hex
            rawPsbt = buffer_1.Buffer.from(_psbt, "hex");
        }
        else {
            //Base64
            rawPsbt = buffer_1.Buffer.from(_psbt, "base64");
        }
        return btc_signer_1.Transaction.fromPSBT(rawPsbt, {
            allowUnknownOutputs: true,
            allowUnknownInputs: true,
            allowLegacyWitnessUtxo: true,
        });
    }
    else {
        return _psbt;
    }
}
exports.parsePsbtTransaction = parsePsbtTransaction;
function toBitcoinWallet(_bitcoinWallet, btcRpc, bitcoinNetwork) {
    if ((0, IBitcoinWallet_1.isIBitcoinWallet)(_bitcoinWallet)) {
        return _bitcoinWallet;
    }
    else {
        return new SingleAddressBitcoinWallet_1.SingleAddressBitcoinWallet(btcRpc, bitcoinNetwork, _bitcoinWallet);
    }
}
exports.toBitcoinWallet = toBitcoinWallet;
