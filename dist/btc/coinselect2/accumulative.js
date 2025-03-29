"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accumulative = void 0;
const utils_1 = require("./utils");
// add inputs until we reach or surpass the target value (or deplete)
// worst-case: O(n)
function accumulative(utxos, outputs, feeRate, type) {
    if (!isFinite(utils_1.utils.uintOrNaN(feeRate)))
        return null;
    let bytesAccum = utils_1.utils.transactionBytes([], outputs, type);
    let fee = feeRate * bytesAccum;
    let cpfpAddFee = 0;
    let inAccum = 0;
    const inputs = [];
    const outAccum = utils_1.utils.sumOrNaN(outputs);
    console.log("CoinSelect: accumulative(): total output: ", outAccum);
    for (let i = 0; i < utxos.length; ++i) {
        const utxo = utxos[i];
        const utxoBytes = utils_1.utils.inputBytes(utxo);
        const utxoFee = feeRate * utxoBytes;
        const utxoValue = utils_1.utils.uintOrNaN(utxo.value);
        let cpfpFee = 0;
        if (utxo.cpfp != null && utxo.cpfp.txEffectiveFeeRate < feeRate)
            cpfpFee = utxo.cpfp.txVsize * (feeRate - utxo.cpfp.txEffectiveFeeRate);
        // skip detrimental input
        if (utxoFee + cpfpFee > utxo.value) {
            console.log("CoinSelect: accumulative(" + i + "): Skipping detrimental output, cpfpFee: " + cpfpFee + " utxoFee: " + utxoFee + " value: " + utxo.value);
            if (i === utxos.length - 1)
                return { fee: (feeRate * (bytesAccum + utxoBytes)) + cpfpAddFee + cpfpFee };
            continue;
        }
        bytesAccum += utxoBytes;
        inAccum += utxoValue;
        cpfpAddFee += cpfpFee;
        inputs.push(utxo);
        fee = (feeRate * bytesAccum) + cpfpAddFee;
        console.log("CoinSelect: accumulative(" + i + "): total fee: ", fee);
        console.log("CoinSelect: accumulative(" + i + "): input value: ", inAccum);
        console.log("CoinSelect: accumulative(" + i + "): cpfpAddFee: ", cpfpAddFee);
        // go again?
        if (inAccum < outAccum + fee)
            continue;
        return utils_1.utils.finalize(inputs, outputs, feeRate, type, cpfpAddFee);
    }
    return { fee };
}
exports.accumulative = accumulative;
