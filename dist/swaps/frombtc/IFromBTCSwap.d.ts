import { IFromBTCWrapper } from "./IFromBTCWrapper";
import { Fee, ISwap, ISwapInit } from "../ISwap";
import { ChainType } from "@atomiqlabs/base";
import { PriceInfoType } from "../../prices/abstract/ISwapPrice";
import { BtcToken, SCToken, TokenAmount } from "../Tokens";
export declare abstract class IFromBTCSwap<T extends ChainType = ChainType, S extends number = number> extends ISwap<T, S> {
    protected abstract readonly inputToken: BtcToken;
    protected constructor(wrapper: IFromBTCWrapper<T, IFromBTCSwap<T, S>>, init: ISwapInit<T["Data"]>);
    protected constructor(wrapper: IFromBTCWrapper<T, IFromBTCSwap<T, S>>, obj: any);
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryCalculateSwapFee(): void;
    protected getSwapData(): T["Data"];
    refreshPriceData(): Promise<PriceInfoType>;
    getSwapPrice(): number;
    getMarketPrice(): number;
    getRealSwapFeePercentagePPM(): bigint;
    abstract getInputTxId(): string | null;
    getOutputTxId(): string | null;
    getInputAddress(): string | null;
    getOutputAddress(): string | null;
    /**
     * Returns the bitcoin address or lightning invoice to be paid for the swap
     */
    abstract getAddress(): string;
    /**
     * Returns a string that can be displayed as QR code representation of the address or lightning invoice
     *  (with bitcoin: or lightning: prefix)
     */
    abstract getQrData(): string;
    abstract isClaimable(): boolean;
    isActionable(): boolean;
    /**
     * Returns if the swap can be committed
     */
    abstract canCommit(): boolean;
    protected getOutAmountWithoutFee(): bigint;
    getOutputWithoutFee(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken>;
    getSwapFee(): Fee;
    getSecurityDeposit(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getTotalDeposit(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getInitiator(): string;
    getClaimFee(): Promise<bigint>;
    hasEnoughForTxFees(): Promise<{
        enoughBalance: boolean;
        balance: TokenAmount;
        required: TokenAmount;
    }>;
    /**
     * Commits the swap on-chain, locking the tokens from the intermediary in an HTLC or PTLC
     *
     * @param signer Signer to sign the transactions with, must be the same as used in the initialization
     * @param abortSignal Abort signal to stop waiting for the transaction confirmation and abort
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} If invalid signer is provided that doesn't match the swap data
     */
    abstract commit(signer: T["Signer"], abortSignal?: AbortSignal, skipChecks?: boolean): Promise<string>;
    /**
     * Returns the transactions required for committing the swap on-chain, locking the tokens from the intermediary
     *  in an HTLC or PTLC
     *
     * @param skipChecks Skip checks like making sure init signature is still valid and swap wasn't commited yet
     *  (this is handled when swap is created (quoted), if you commit right after quoting, you can use skipChecks=true)
     * @throws {Error} When in invalid state to commit the swap
     */
    txsCommit(skipChecks?: boolean): Promise<T["TX"][]>;
    abstract waitTillCommited(abortSignal?: AbortSignal): Promise<void>;
    /**
     * Claims and finishes the swap
     *
     * @param signer Signer to sign the transactions with, can also be different to the initializer
     * @param abortSignal Abort signal to stop waiting for transaction confirmation
     */
    abstract claim(signer: T["Signer"], abortSignal?: AbortSignal): Promise<string>;
    abstract txsClaim(signer?: T["Signer"]): Promise<T["TX"][]>;
    /**
     * Waits till the swap is successfully claimed
     *
     * @param abortSignal AbortSignal
     * @throws {Error} If swap is in invalid state (must be COMMIT)
     */
    abstract waitTillClaimed(abortSignal?: AbortSignal): Promise<void>;
}
