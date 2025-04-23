import { LNURLPay, LNURLWithdraw } from "../../../utils/LNURL";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
export declare class SwapperBtcUtils {
    readonly bitcoinNetwork: BTC_NETWORK;
    constructor(bitcoinNetwork: BTC_NETWORK);
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice
     *
     * @param lnpr
     */
    isLightningInvoice(lnpr: string): boolean;
    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr: string): boolean;
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr: string): boolean;
    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl: string): boolean;
    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl: string, shouldRetry?: boolean): Promise<LNURLPay | LNURLWithdraw | null>;
    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr: string): bigint;
}
