import { SwapType } from "../../enums/SwapType";
import { ChainType } from "@atomiqlabs/base";
import { ISwap, ISwapInit } from "../../ISwap";
import { BtcToken, SCToken, TokenAmount } from "../../../Tokens";
import { OnchainForGasWrapper } from "./OnchainForGasWrapper";
import { Fee, FeeType } from "../../fee/Fee";
import { IBitcoinWallet } from "../../../btc/wallet/IBitcoinWallet";
import { IAddressSwap } from "../../IAddressSwap";
import { IBTCWalletSwap } from "../../IBTCWalletSwap";
import { Transaction } from "@scure/btc-signer";
export declare enum OnchainForGasSwapState {
    EXPIRED = -3,
    FAILED = -2,
    REFUNDED = -1,
    PR_CREATED = 0,
    FINISHED = 1,
    REFUNDABLE = 2
}
export type OnchainForGasSwapInit = ISwapInit & {
    paymentHash: string;
    sequence: bigint;
    address: string;
    inputAmount: bigint;
    outputAmount: bigint;
    recipient: string;
    token: string;
    refundAddress?: string;
};
export declare function isOnchainForGasSwapInit(obj: any): obj is OnchainForGasSwapInit;
export declare class OnchainForGasSwap<T extends ChainType = ChainType> extends ISwap<T, OnchainForGasSwapState> implements IAddressSwap, IBTCWalletSwap {
    getSmartChainNetworkFee: any;
    protected readonly TYPE: SwapType;
    private readonly paymentHash;
    private readonly sequence;
    private readonly address;
    private readonly recipient;
    private readonly token;
    private inputAmount;
    private outputAmount;
    private refundAddress;
    scTxId: string;
    txId: string;
    refundTxId: string;
    wrapper: OnchainForGasWrapper<T>;
    constructor(wrapper: OnchainForGasWrapper<T>, init: OnchainForGasSwapInit);
    constructor(wrapper: OnchainForGasWrapper<T>, obj: any);
    protected upgradeVersion(): void;
    /**
     * In case swapFee in BTC is not supplied it recalculates it based on swap price
     * @protected
     */
    protected tryRecomputeSwapPrice(): void;
    _getEscrowHash(): string;
    getOutputAddress(): string | null;
    getInputTxId(): string | null;
    getOutputTxId(): string | null;
    getId(): string;
    getAddress(): string;
    getHyperlink(): string;
    requiresAction(): boolean;
    isFinished(): boolean;
    isQuoteExpired(): boolean;
    isQuoteSoftExpired(): boolean;
    isFailed(): boolean;
    isSuccessful(): boolean;
    verifyQuoteValid(): Promise<boolean>;
    protected getOutAmountWithoutFee(): bigint;
    getOutput(): TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>;
    getInput(): TokenAmount<T["ChainId"], BtcToken<false>>;
    getInputWithoutFee(): TokenAmount<T["ChainId"], BtcToken<false>>;
    protected getSwapFee(): Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
    getFee(): Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
    getFeeBreakdown(): [{
        type: FeeType.SWAP;
        fee: Fee<T["ChainId"], BtcToken<false>, SCToken<T["ChainId"]>>;
    }];
    getFundedPsbt(_bitcoinWallet: IBitcoinWallet | {
        address: string;
        publicKey: string;
    }, feeRate?: number): Promise<{
        psbt: Transaction;
        signInputs: number[];
    }>;
    submitPsbt(psbt: Transaction): Promise<string>;
    estimateBitcoinFee(wallet: IBitcoinWallet, feeRate?: number): Promise<TokenAmount<any, BtcToken<false>>>;
    sendBitcoinTransaction(wallet: IBitcoinWallet, feeRate?: number): Promise<string>;
    protected checkAddress(save?: boolean): Promise<boolean>;
    protected setRefundAddress(refundAddress: string): Promise<void>;
    /**
     * A blocking promise resolving when payment was received by the intermediary and client can continue
     * rejecting in case of failure
     *
     * @param abortSignal Abort signal
     * @param checkIntervalSeconds How often to poll the intermediary for answer
     * @param updateCallback Callback called when txId is found, and also called with subsequent confirmations
     * @throws {PaymentAuthError} If swap expired or failed
     * @throws {Error} When in invalid state (not PR_CREATED)
     */
    waitForBitcoinTransaction(abortSignal?: AbortSignal, checkIntervalSeconds?: number, updateCallback?: (txId: string, confirmations: number, targetConfirmations: number, txEtaMs: number) => void): Promise<string>;
    waitTillRefunded(abortSignal?: AbortSignal, checkIntervalSeconds?: number): Promise<void>;
    requestRefund(refundAddress?: string, abortSignal?: AbortSignal): Promise<void>;
    serialize(): any;
    _getInitiator(): string;
    _sync(save?: boolean): Promise<boolean>;
    _tick(save?: boolean): Promise<boolean>;
}
