"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxSendable = exports.coinSelect = exports.DUST_THRESHOLDS = void 0;
const accumulative_1 = require("./accumulative");
const blackjack_1 = require("./blackjack");
const utils_1 = require("./utils");
Object.defineProperty(exports, "DUST_THRESHOLDS", { enumerable: true, get: function () { return utils_1.DUST_THRESHOLDS; } });
// order by descending value, minus the inputs approximate fee
function utxoScore(x, feeRate) {
    let valueAfterFee = x.value - (feeRate * utils_1.utils.inputBytes(x));
    if (x.cpfp != null && x.cpfp.txEffectiveFeeRate < feeRate)
        valueAfterFee -= x.cpfp.txVsize * (feeRate - x.cpfp.txEffectiveFeeRate);
    return valueAfterFee;
}
function coinSelect(utxos, outputs, feeRate, type) {
    // order by descending value, minus the inputs approximate fee
    utxos = utxos.sort((a, b) => {
        // if(a.cpfp!=null && b.cpfp==null) return 1;
        // if(a.cpfp==null && b.cpfp!=null) return -1;
        return utxoScore(b, feeRate) - utxoScore(a, feeRate);
    });
    // attempt to use the blackjack strategy first (no change output)
    const base = (0, blackjack_1.blackjack)(utxos, outputs, feeRate, type);
    if (base.inputs)
        return base;
    // else, try the accumulative strategy
    return (0, accumulative_1.accumulative)(utxos, outputs, feeRate, type);
}
exports.coinSelect = coinSelect;
function maxSendable(utxos, outputScript, outputType, feeRate) {
    if (!isFinite(utils_1.utils.uintOrNaN(feeRate)))
        return null;
    let bytesAccum = utils_1.utils.transactionBytes([], [{ script: outputScript }], null);
    let cpfpAddFee = 0;
    let inAccum = 0;
    const inputs = [];
    for (let i = 0; i < utxos.length; ++i) {
        const utxo = utxos[i];
        const utxoBytes = utils_1.utils.inputBytes(utxo);
        const utxoFee = feeRate * utxoBytes;
        let cpfpFee = 0;
        if (utxo.cpfp != null && utxo.cpfp.txEffectiveFeeRate < feeRate)
            cpfpFee = utxo.cpfp.txVsize * (feeRate - utxo.cpfp.txEffectiveFeeRate);
        const utxoValue = utils_1.utils.uintOrNaN(utxo.value);
        // skip detrimental input
        if (utxoFee + cpfpFee > utxo.value) {
            continue;
        }
        bytesAccum += utxoBytes;
        inAccum += utxoValue;
        cpfpAddFee += cpfpFee;
        inputs.push(utxo);
    }
    const fee = (feeRate * bytesAccum) + cpfpAddFee;
    const outputValue = inAccum - fee;
    const dustThreshold = utils_1.DUST_THRESHOLDS[outputType];
    if (outputValue < dustThreshold)
        return {
            fee,
            value: 0
        };
    return {
        fee,
        value: outputValue
    };
}
exports.maxSendable = maxSendable;
