"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapperBtcUtils = void 0;
const bolt11_1 = require("@atomiqlabs/bolt11");
const btc_signer_1 = require("@scure/btc-signer");
const LNURL_1 = require("../../../utils/LNURL");
class SwapperBtcUtils {
    constructor(bitcoinNetwork) {
        this.bitcoinNetwork = bitcoinNetwork;
    }
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice
     *
     * @param lnpr
     */
    isLightningInvoice(lnpr) {
        try {
            (0, bolt11_1.decode)(lnpr);
            return true;
        }
        catch (e) { }
        return false;
    }
    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param addr
     */
    isValidBitcoinAddress(addr) {
        try {
            (0, btc_signer_1.Address)(this.bitcoinNetwork).decode(addr);
            return true;
        }
        catch (e) {
            return false;
        }
    }
    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr) {
        try {
            const parsed = (0, bolt11_1.decode)(lnpr);
            if (parsed.millisatoshis != null)
                return true;
        }
        catch (e) { }
        return false;
    }
    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl) {
        return LNURL_1.LNURL.isLNURL(lnurl);
    }
    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     * @param shouldRetry
     */
    getLNURLTypeAndData(lnurl, shouldRetry) {
        return LNURL_1.LNURL.getLNURLType(lnurl, shouldRetry);
    }
    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    getLightningInvoiceValue(lnpr) {
        const parsed = (0, bolt11_1.decode)(lnpr);
        if (parsed.millisatoshis != null)
            return (BigInt(parsed.millisatoshis) + 999n) / 1000n;
        return null;
    }
}
exports.SwapperBtcUtils = SwapperBtcUtils;
