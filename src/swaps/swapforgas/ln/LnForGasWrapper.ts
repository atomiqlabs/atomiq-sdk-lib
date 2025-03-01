import {LnForGasSwap, LnForGasSwapInit, LnForGasSwapState} from "./LnForGasSwap";
import {ISwapWrapper} from "../../ISwapWrapper";
import {TrustedIntermediaryAPI} from "../../../intermediaries/TrustedIntermediaryAPI";
import {decode as bolt11Decode} from "@atomiqlabs/bolt11";
import {IntermediaryError} from "../../../errors/IntermediaryError";
import {ChainType} from "@atomiqlabs/base";
import {Intermediary} from "../../../intermediaries/Intermediary";
import {SwapType} from "../../SwapType";

export class LnForGasWrapper<T extends ChainType> extends ISwapWrapper<T, LnForGasSwap<T>> {
    public TYPE = SwapType.TRUSTED_FROM_BTCLN;
    public readonly swapDeserializer = LnForGasSwap;

    /**
     * Returns a newly created swap, receiving 'amount' on lightning network
     *
     * @param signer
     * @param amount            Amount you wish to receive in base units (satoshis)
     * @param lpOrUrl           Intermediary/Counterparty swap service Intermediary object or raw url
     */
    async create(signer: string, amount: bigint, lpOrUrl: Intermediary | string): Promise<LnForGasSwap<T>> {
        if(!this.isInitialized) throw new Error("Not initialized, call init() first!");

        const lpUrl = typeof(lpOrUrl)==="string" ? lpOrUrl : lpOrUrl.url;

        const token = this.contract.getNativeCurrencyAddress();

        const resp = await TrustedIntermediaryAPI.initTrustedFromBTCLN(this.chainIdentifier, lpUrl, {
            address: signer,
            amount,
            token
        }, this.options.getRequestTimeout);

        const decodedPr = bolt11Decode(resp.pr);
        const amountIn = (BigInt(decodedPr.millisatoshis) + 999n) / 1000n;

        if(resp.total!==amount) throw new IntermediaryError("Invalid total returned");

        const pricingInfo = await this.verifyReturnedPrice(
            typeof(lpOrUrl)==="string" ?
                {swapFeePPM: 10000, swapBaseFee: 10} :
                lpOrUrl.services[SwapType.TRUSTED_FROM_BTCLN],
            false, amountIn,
            amount, this.contract.getNativeCurrencyAddress(), resp
        );

        const quote = new LnForGasSwap(this, {
            pr: resp.pr,
            outputAmount: resp.total,
            recipient: signer,
            pricingInfo,
            url: lpUrl,
            expiry: decodedPr.timeExpireDate*1000,
            swapFee: resp.swapFee,
            feeRate: "",
            token,
            exactIn: false
        } as LnForGasSwapInit<T["Data"]>);
        await quote._save();
        return quote;
    }

    protected checkPastSwapStates = [LnForGasSwapState.PR_CREATED];
    protected async checkPastSwap(swap: LnForGasSwap<T>): Promise<boolean> {
        if(swap.state===LnForGasSwapState.PR_CREATED) {
            //Check if it's maybe already paid
            const res = await swap.checkInvoicePaid(false);
            if(res!==null) return true;
        }
        return false;
    }

    protected isOurSwap(signer: string, swap: LnForGasSwap<T>): boolean {
        return signer===swap.getRecipient();
    }

    protected tickSwapState = null;
    protected tickSwap(swap: LnForGasSwap<T>): void {}

}
