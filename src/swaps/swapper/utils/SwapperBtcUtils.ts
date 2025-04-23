import {decode as bolt11Decode} from "@atomiqlabs/bolt11";
import {Address} from "@scure/btc-signer";
import {LNURL, LNURLPay, LNURLWithdraw} from "../../../utils/LNURL";
import {BTC_NETWORK} from "@scure/btc-signer/utils";

export class SwapperBtcUtils {

    readonly bitcoinNetwork: BTC_NETWORK;

    constructor(bitcoinNetwork: BTC_NETWORK) {
        this.bitcoinNetwork = bitcoinNetwork;
    }

    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice
     *
     * @param lnpr
     */
    isLightningInvoice(lnpr: string): boolean {
        try {
            bolt11Decode(lnpr);
            return true;
        } catch (e) {}
        return false;
    }

    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr: string): boolean {
        try {
            Address(this.bitcoinNetwork).decode(addr);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr: string): boolean {
        try {
            const parsed = bolt11Decode(lnpr);
            if(parsed.millisatoshis!=null) return true;
        } catch (e) {}
        return false;
    }

    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl: string): boolean {
        return LNURL.isLNURL(lnurl);
    }

    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl: string, shouldRetry?: boolean): Promise<LNURLPay | LNURLWithdraw | null> {
        return LNURL.getLNURLType(lnurl, shouldRetry);
    }

    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr: string): bigint {
        const parsed = bolt11Decode(lnpr);
        if(parsed.millisatoshis!=null) return (BigInt(parsed.millisatoshis) + 999n) / 1000n;
        return null;
    }
}