import { LNURLPay, LNURLWithdraw } from "../../../utils/LNURL";
import { BTC_NETWORK } from "@scure/btc-signer/utils";
import { SwapType } from "../../enums/SwapType";
import { SCToken, TokenAmount } from "../../../Tokens";
import { ChainIds, MultiChain, Swapper } from "../Swapper";
import { IBitcoinWallet } from "../../../btc/wallet/IBitcoinWallet";
import { Transaction } from "@scure/btc-signer";
export declare class SwapperUtils<T extends MultiChain> {
    readonly bitcoinNetwork: BTC_NETWORK;
    private readonly root;
    constructor(root: Swapper<T>);
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
    private parseBitcoinAddress;
    private parseLNURLSync;
    private parseLNURL;
    private parseLightningInvoice;
    private parseSmartchainAddress;
    /**
     * General parser for bitcoin addresses, LNURLs, lightning invoices, smart chain addresses, also fetches LNURL data
     *  (hence returns Promise)
     *
     * @param addressString Address to parse
     * @throws {Error} Error in address parsing
     * @returns Address data or null if address doesn't conform to any known format
     */
    parseAddress(addressString: string): Promise<{
        type: "BITCOIN" | "LIGHTNING" | "LNURL" | ChainIds<T>;
        swapType: SwapType.TO_BTC | SwapType.TO_BTCLN | SwapType.SPV_VAULT_FROM_BTC | SwapType.FROM_BTCLN | null;
        lnurl?: LNURLPay | LNURLWithdraw;
        min?: TokenAmount;
        max?: TokenAmount;
    }>;
    /**
     * Synchronous general parser for bitcoin addresses, LNURLs, lightning invoices, smart chain addresses, doesn't fetch
     *  LNURL data, reports swapType: null instead to prevent returning a Promise
     *
     * @param addressString Address to parse
     * @throws {Error} Error in address parsing
     * @returns Address data or null if address doesn't conform to any known format
     */
    parseAddressSync(addressString: string): {
        type: "BITCOIN" | "LIGHTNING" | "LNURL" | ChainIds<T>;
        swapType: SwapType.TO_BTC | SwapType.TO_BTCLN | SwapType.SPV_VAULT_FROM_BTC | null;
        min?: TokenAmount;
        max?: TokenAmount;
    };
    /**
     * Returns a random PSBT that can be used for fee estimation, the last output (the LP output) is omitted
     *  to allow for coinselection algorithm to determine maximum sendable amount there
     *
     * @param chainIdentifier
     * @param includeGasToken   Whether to return the PSBT also with the gas token amount (increases the vSize by 8)
     */
    getRandomSpvVaultPsbt<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier, includeGasToken?: boolean): Transaction;
    /**
     * Returns the spendable balance of a bitcoin wallet for a given swap type
     *
     * @param addressOrWallet
     * @param swapType
     * @param targetChain
     * @param options Additional options
     */
    getBitcoinSpendableBalance(addressOrWallet: string | IBitcoinWallet, swapType: SwapType.SPV_VAULT_FROM_BTC, targetChain: ChainIds<T>, options?: {
        gasDrop?: boolean;
        feeRate?: number;
        minFeeRate?: number;
    }): Promise<{
        balance: TokenAmount;
        feeRate: number;
    }>;
    getBitcoinSpendableBalance(addressOrWallet: string | IBitcoinWallet, swapType: SwapType.FROM_BTC | SwapType.TRUSTED_FROM_BTC, targetChain?: ChainIds<T>, options?: {
        feeRate?: number;
        minFeeRate?: number;
    }): Promise<{
        balance: TokenAmount;
        feeRate: number;
    }>;
    /**
     * Returns the maximum spendable balance of the wallet, deducting the fee needed to initiate a swap for native balances
     */
    getSpendableBalance<ChainIdentifier extends ChainIds<T>>(wallet: string | T[ChainIdentifier]["Signer"], token: SCToken<ChainIdentifier>, options?: {
        feeMultiplier?: number;
        feeRate?: any;
    }): Promise<TokenAmount>;
    /**
     * Returns the address of the native currency of the chain
     */
    getNativeToken<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): SCToken<ChainIdentifier>;
    /**
     * Returns a random signer for a given smart chain
     *
     * @param chainIdentifier
     */
    randomSigner<ChainIdentifier extends ChainIds<T>>(chainIdentifier: ChainIdentifier): T[ChainIdentifier]["Signer"];
}
