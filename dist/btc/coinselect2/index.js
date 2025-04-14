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
function coinSelect(utxos, outputs, feeRate, type, requiredInputs) {
    // order by descending value, minus the inputs approximate fee
    utxos = utxos.sort((a, b) => {
        // if(a.cpfp!=null && b.cpfp==null) return 1;
        // if(a.cpfp==null && b.cpfp!=null) return -1;
        return utxoScore(b, feeRate) - utxoScore(a, feeRate);
    });
    // attempt to use the blackjack strategy first (no change output)
    const base = (0, blackjack_1.blackjack)(utxos, outputs, feeRate, type, requiredInputs);
    if (base.inputs)
        return base;
    // else, try the accumulative strategy
    return (0, accumulative_1.accumulative)(utxos, outputs, feeRate, type, requiredInputs);
}
exports.coinSelect = coinSelect;
function maxSendable(utxos, output, feeRate, requiredInputs, additionalOutputs) {
    if (!isFinite(utils_1.utils.uintOrNaN(feeRate)))
        return null;
    const outputs = additionalOutputs ?? [];
    const inputs = requiredInputs ?? [];
    let bytesAccum = utils_1.utils.transactionBytes(inputs, outputs.concat([output]), null);
    let cpfpAddFee = 0;
    let inAccum = utils_1.utils.sumOrNaN(inputs);
    let outAccum = utils_1.utils.sumOrNaN(outputs);
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
    const outputValue = inAccum - fee - outAccum;
    const dustThreshold = utils_1.DUST_THRESHOLDS[output.type];
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
//
// //Test coinselect
// const utxoPool = [
//     {
//         "vout": 3,
//         "txId": "bacac5f947b808eff4002d2418d18a1a18923543fbb145e751b005899991480a",
//         "value": 46522,
//         "type": "p2wpkh",
//         "outputScript": Buffer.from([
//             0,
//             20,
//             0,
//             33,
//             139,
//             63,
//             90,
//             139,
//             32,
//             245,
//             21,
//             132,
//             7,
//             21,
//             103,
//             231,
//             142,
//             109,
//             179,
//             175,
//             170,
//             26
//         ]),
//         "address": "bc1qqqsck0663vs029vyqu2k0euwdke6l2s6kzvxgn",
//         "cpfp": {
//             "txVsize": 292,
//             "txEffectiveFeeRate": 5.018675721561969
//         },
//         "confirmed": false
//     },
//     {
//         "vout": 1,
//         "txId": "4540b7e587a965594071643012488c6cd5fedfc965bcb0a60687c4c87dc94c1b",
//         "value": 450,
//         "type": "p2wpkh",
//         "outputScript": Buffer.from([
//             0,
//             20,
//             0,
//             33,
//             139,
//             63,
//             90,
//             139,
//             32,
//             245,
//             21,
//             132,
//             7,
//             21,
//             103,
//             231,
//             142,
//             109,
//             179,
//             175,
//             170,
//             26
//         ]),
//         "address": "bc1qqqsck0663vs029vyqu2k0euwdke6l2s6kzvxgn",
//         "cpfp": null,
//         "confirmed": true
//     }
// ];
//
// const targets = [
//     {
//         "value": 600,
//         "script": Buffer.from([
//             81,
//             32,
//             144,
//             178,
//             224,
//             127,
//             167,
//             6,
//             20,
//             79,
//             80,
//             202,
//             73,
//             78,
//             21,
//             169,
//             135,
//             214,
//             72,
//             214,
//             240,
//             155,
//             185,
//             33,
//             228,
//             90,
//             41,
//             220,
//             8,
//             185,
//             218,
//             110,
//             218,
//             180
//         ])
//     },
//     {
//         "value": 0,
//         "script": Buffer.from([
//             106,
//             48,
//             4,
//             59,
//             210,
//             45,
//             228,
//             162,
//             208,
//             71,
//             39,
//             68,
//             7,
//             91,
//             150,
//             33,
//             181,
//             190,
//             0,
//             13,
//             213,
//             184,
//             201,
//             204,
//             127,
//             177,
//             159,
//             65,
//             67,
//             12,
//             159,
//             143,
//             234,
//             17,
//             231,
//             117,
//             73,
//             0,
//             0,
//             0,
//             0,
//             0,
//             0,
//             202,
//             154,
//             59,
//             0,
//             0,
//             0,
//             0
//         ])
//     },
//     {
//         "value": 10000,
//         "script": Buffer.from([
//             0,
//             20,
//             52,
//             171,
//             216,
//             195,
//             0,
//             15,
//             129,
//             181,
//             100,
//             208,
//             56,
//             16,
//             204,
//             254,
//             43,
//             145,
//             229,
//             169,
//             223,
//             133
//         ])
//     }
// ];
//
// const additionalInputs = [
//     {
//         "txId": "ecddf546c6b637c049b01344f3949e621ec0fb98a06f7e145ea56cc6b2daa3fd",
//         "vout": 0,
//         "value": 600,
//         "type": "p2tr"
//     }
// ];
//
// const result = coinSelect(utxoPool as any, targets, 7, "p2wpkh", additionalInputs as any);
//
// console.log(result);
