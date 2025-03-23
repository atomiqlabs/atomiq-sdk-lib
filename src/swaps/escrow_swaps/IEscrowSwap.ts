import {isISwapInit, ISwap, ISwapInit} from "../ISwap";
import {ChainType, SignatureData, SignatureVerificationError, SwapCommitStatus, SwapData} from "@atomiqlabs/base";
import {IEscrowSwapWrapper} from "./IEscrowSwapWrapper";
import {timeoutPromise, tryWithRetries} from "../../utils/Utils";
import {Buffer} from "buffer";
import {SCToken, TokenAmount, toTokenAmount} from "../../Tokens";

export type IEscrowSwapInit<T extends SwapData> = ISwapInit & {
    feeRate: any,
    signatureData?: SignatureData,
    data?: T,
};

export function isIEscrowSwapInit<T extends SwapData>(obj: any): obj is IEscrowSwapInit<T> {
    return typeof obj === 'object' &&
        obj.feeRate != null &&
        (obj.signatureData == null || (
            typeof(obj.signatureData) === 'object' &&
            typeof(obj.signatureData.prefix)==="string" &&
            typeof(obj.signatureData.timeout)==="string" &&
            typeof(obj.signatureData.signature)==="string"
        )) &&
        (obj.data == null || typeof obj.data === 'object') &&
        isISwapInit(obj);
}

export abstract class IEscrowSwap<
    T extends ChainType = ChainType,
    S extends number = number
> extends ISwap<T, S> {

    protected readonly wrapper: IEscrowSwapWrapper<T, IEscrowSwap<T, S>>;

    data: T["Data"];
    signatureData?: SignatureData;
    feeRate?: any;

    /**
     * Transaction IDs for the swap on the smart chain side
     */
    commitTxId: string;
    refundTxId?: string;
    claimTxId?: string;

    protected constructor(wrapper: IEscrowSwapWrapper<T, IEscrowSwap<T, S>>, obj: any);
    protected constructor(wrapper: IEscrowSwapWrapper<T, IEscrowSwap<T, S>>, swapInit: IEscrowSwapInit<T["Data"]>);
    protected constructor(
        wrapper: IEscrowSwapWrapper<T, IEscrowSwap<T, S>>,
        swapInitOrObj: IEscrowSwapInit<T["Data"]> | any,
    ) {
        super(wrapper, swapInitOrObj);

        if(!isIEscrowSwapInit(swapInitOrObj)) {
            this.data = swapInitOrObj.data!=null ? new wrapper.swapDataDeserializer(swapInitOrObj.data) : null;
            this.signatureData = swapInitOrObj.signature==null ? null : {
                prefix: swapInitOrObj.prefix,
                timeout: swapInitOrObj.timeout,
                signature: swapInitOrObj.signature
            };
            this.feeRate = swapInitOrObj.feeRate;

            this.commitTxId = swapInitOrObj.commitTxId;
            this.claimTxId = swapInitOrObj.claimTxId;
            this.refundTxId = swapInitOrObj.refundTxId;
        }
    }

    /**
     * Returns the escrow hash - i.e. hash of the escrow data
     */
    getEscrowHash(): string | null {
        return this.data?.getEscrowHash();
    }

    /**
     * Returns the claim data hash - i.e. hash passed to the claim handler
     */
    getClaimHash(): string {
        return this.data?.getClaimHash();
    }

    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHash(): Buffer {
        const claimHashBuffer = Buffer.from(this.getClaimHash(), "hex");
        if(this.randomNonce==null) return claimHashBuffer;
        return Buffer.concat([claimHashBuffer, Buffer.from(this.randomNonce, "hex")]);
    }

    /**
     * Returns the identification hash of the swap, usually claim data hash, but can be overriden, e.g. for
     *  lightning swaps the identifier hash is used instead of claim data hash
     */
    getIdentifierHashString(): string {
        const paymentHash = this.getIdentifierHash();
        if(paymentHash==null) return null;
        return paymentHash.toString("hex");
    }

    getId(): string {
        return this.getIdentifierHashString();
    }

    /**
     * Periodically checks for init signature's expiry
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected async watchdogWaitTillSignatureExpiry(abortSignal?: AbortSignal, interval: number = 5): Promise<void> {
        let expired = false
        while(!expired) {
            await timeoutPromise(interval*1000, abortSignal);
            try {
                expired = await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData);
            } catch (e) {
                this.logger.error("watchdogWaitTillSignatureExpiry(): Error when checking signature expiry: ", e);
            }
        }
        if(abortSignal!=null) abortSignal.throwIfAborted();
    }

    /**
     * Periodically checks the chain to see whether the swap is committed
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected async watchdogWaitTillCommited(abortSignal?: AbortSignal, interval: number = 5): Promise<boolean> {
        let status: SwapCommitStatus = SwapCommitStatus.NOT_COMMITED;
        while(status===SwapCommitStatus.NOT_COMMITED) {
            await timeoutPromise(interval*1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data);
                if(
                    status===SwapCommitStatus.NOT_COMMITED &&
                    await this.wrapper.contract.isInitAuthorizationExpired(this.data, this.signatureData)
                ) return false;
            } catch (e) {
                this.logger.error("watchdogWaitTillCommited(): Error when fetching commit status or signature expiry: ", e);
            }
        }
        if(abortSignal!=null) abortSignal.throwIfAborted();
        return true;
    }

    /**
     * Periodically checks the chain to see whether the swap was finished (claimed or refunded)
     *
     * @param abortSignal
     * @param interval How often to check (in seconds), default to 5s
     * @protected
     */
    protected async watchdogWaitTillResult(abortSignal?: AbortSignal, interval: number = 5): Promise<
        SwapCommitStatus.PAID | SwapCommitStatus.EXPIRED | SwapCommitStatus.NOT_COMMITED
    > {
        let status: SwapCommitStatus = SwapCommitStatus.COMMITED;
        while(status===SwapCommitStatus.COMMITED || status===SwapCommitStatus.REFUNDABLE) {
            await timeoutPromise(interval*1000, abortSignal);
            try {
                status = await this.wrapper.contract.getCommitStatus(this.getInitiator(), this.data);
            } catch (e) {
                this.logger.error("watchdogWaitTillResult(): Error when fetching commit status: ", e);
            }
        }
        if(abortSignal!=null) abortSignal.throwIfAborted();
        return status;
    }

    /**
     * Checks if the swap's quote is still valid
     */
    async isQuoteValid(): Promise<boolean> {
        try {
            await tryWithRetries(
                () => this.wrapper.contract.isValidInitAuthorization(
                    this.data, this.signatureData, this.feeRate
                ),
                null,
                SignatureVerificationError
            );
            return true;
        } catch (e) {
            if(e instanceof SignatureVerificationError) {
                return false;
            }
        }
    }

    /**
     * Checks if the swap's quote is expired for good (i.e. the swap strictly cannot be committed on-chain anymore)
     */
    async isQuoteDefinitelyExpired(): Promise<boolean> {
        return tryWithRetries(
            () => this.wrapper.contract.isInitAuthorizationExpired(
                this.data, this.signatureData
            )
        );
    }

    //////////////////////////////
    //// Amounts & fees

    /**
     * Get the estimated smart chain fee of the commit transaction
     */
    getCommitFee(): Promise<bigint> {
        return this.wrapper.contract.getCommitFee(this.data, this.feeRate);
    }

    /**
     * Returns the transaction fee paid on the smart chain
     */
    async getSmartChainNetworkFee(): Promise<TokenAmount<T["ChainId"], SCToken<T["ChainId"]>>> {
        const swapContract: T["Contract"] & {getRawCommitFee?: (data: T["Data"], feeRate?: string) => Promise<bigint>} = this.wrapper.contract;
        return toTokenAmount(
            await (
                swapContract.getRawCommitFee!=null ?
                    swapContract.getRawCommitFee(this.data, this.feeRate) :
                    swapContract.getCommitFee(this.data, this.feeRate)
            ),
            this.wrapper.getNativeToken(),
            this.wrapper.prices
        );
    }

    serialize(): any {
        return {
            ...super.serialize(),
            data: this.data!=null ? this.data.serialize() : null,
            prefix: this.signatureData?.prefix,
            timeout: this.signatureData?.timeout,
            signature: this.signatureData?.signature,
            feeRate: this.feeRate==null ? null : this.feeRate.toString(),
            commitTxId: this.commitTxId,
            claimTxId: this.claimTxId,
            refundTxId: this.refundTxId
        }
    };

}