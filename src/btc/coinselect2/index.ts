import {accumulative} from "./accumulative"
import {blackjack} from "./blackjack"
import {CoinselectAddressTypes, CoinselectTxInput, CoinselectTxOutput, DUST_THRESHOLDS, utils} from "./utils"

// order by descending value, minus the inputs approximate fee
function utxoScore (x: CoinselectTxInput, feeRate: number) {
    let valueAfterFee = x.value - (feeRate * utils.inputBytes(x))
    if(x.cpfp!=null && x.cpfp.txEffectiveFeeRate<feeRate) valueAfterFee -= x.cpfp.txVsize*(feeRate - x.cpfp.txEffectiveFeeRate);
    return valueAfterFee;
}

export {CoinselectAddressTypes, CoinselectTxInput, CoinselectTxOutput, DUST_THRESHOLDS};

export function coinSelect (
    utxos: CoinselectTxInput[],
    outputs: CoinselectTxOutput[],
    feeRate: number,
    type: CoinselectAddressTypes,
): {
    inputs?: CoinselectTxInput[],
    outputs?: CoinselectTxOutput[],
    fee: number
} {
    // order by descending value, minus the inputs approximate fee
    utxos = utxos.sort((a, b) => {
        // if(a.cpfp!=null && b.cpfp==null) return 1;
        // if(a.cpfp==null && b.cpfp!=null) return -1;
        return utxoScore(b, feeRate) - utxoScore(a, feeRate);
    });

    // attempt to use the blackjack strategy first (no change output)
    const base = blackjack(utxos, outputs, feeRate, type);
    if (base.inputs) return base;

    // else, try the accumulative strategy
    return accumulative(utxos, outputs, feeRate, type);
}

export function maxSendable (
    utxos: CoinselectTxInput[],
    outputScript: Buffer,
    outputType: CoinselectAddressTypes,
    feeRate: number,
): {
    value: number,
    fee: number
} {
    if (!isFinite(utils.uintOrNaN(feeRate))) return null;

    let bytesAccum = utils.transactionBytes([], [{script: outputScript}], null);
    let cpfpAddFee = 0;
    let inAccum = 0;
    const inputs = [];

    for (let i = 0; i < utxos.length; ++i) {
        const utxo = utxos[i];
        const utxoBytes = utils.inputBytes(utxo);
        const utxoFee = feeRate * utxoBytes;
        let cpfpFee = 0;
        if(utxo.cpfp!=null && utxo.cpfp.txEffectiveFeeRate<feeRate) cpfpFee = utxo.cpfp.txVsize*(feeRate - utxo.cpfp.txEffectiveFeeRate);
        const utxoValue = utils.uintOrNaN(utxo.value);

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

    const dustThreshold = DUST_THRESHOLDS[outputType];

    if(outputValue<dustThreshold) return {
        fee,
        value: 0
    };

    return {
        fee,
        value: outputValue
    };
}
