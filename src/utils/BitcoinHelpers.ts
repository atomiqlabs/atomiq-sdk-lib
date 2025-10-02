import {Transaction} from "@scure/btc-signer";
import {Buffer} from "buffer";
import {IBitcoinWallet, isIBitcoinWallet} from "../btc/wallet/IBitcoinWallet";
import {BitcoinRpcWithAddressIndex} from "../btc/BitcoinRpcWithAddressIndex";
import {BTC_NETWORK} from "@scure/btc-signer/utils";
import {SingleAddressBitcoinWallet} from "../btc/wallet/SingleAddressBitcoinWallet";

/**
 * General parsers for PSBTs, can parse hex or base64 encoded PSBTs
 * @param _psbt
 */
export function parsePsbtTransaction(_psbt: Transaction | string): Transaction {
    if(typeof(_psbt)==="string") {
        let rawPsbt: Buffer;
        if(/[0-9a-f]+/i.test(_psbt)) {
            //Hex
            rawPsbt = Buffer.from(_psbt, "hex");
        } else {
            //Base64
            rawPsbt = Buffer.from(_psbt, "base64");
        }
        return Transaction.fromPSBT(rawPsbt, {
            allowUnknownOutputs: true,
            allowUnknownInputs: true,
            allowLegacyWitnessUtxo: true,
        });
    } else {
        return _psbt;
    }
}

export function toBitcoinWallet(
    _bitcoinWallet: IBitcoinWallet | { address: string, publicKey: string },
    btcRpc: BitcoinRpcWithAddressIndex<any>,
    bitcoinNetwork: BTC_NETWORK
): IBitcoinWallet {
    if(isIBitcoinWallet(_bitcoinWallet)) {
        return _bitcoinWallet;
    } else {
        return new SingleAddressBitcoinWallet(btcRpc, bitcoinNetwork, _bitcoinWallet);
    }
}
