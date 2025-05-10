import {IBitcoinWallet} from "../btc/wallet/IBitcoinWallet";
import {BtcToken, TokenAmount} from "../Tokens";

export interface IBTCWalletSwap {

    estimateBitcoinFee(wallet: IBitcoinWallet, feeRate?: number): Promise<TokenAmount<any, BtcToken<false>>>;
    sendBitcoinTransaction(wallet: IBitcoinWallet, feeRate?: number): Promise<string>;

    /**
     * Waits till the bitcoin transaction confirms
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to check the bitcoin transaction
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {Error} if in invalid state (must be CLAIM_COMMITED)
     */
    waitForBitcoinTransaction(
        abortSignal?: AbortSignal,
        checkIntervalSeconds?: number,
        updateCallback?: (txId: string, confirmations: number, targetConfirmations: number, txEtaMs: number) => void
    ): Promise<string>;

}