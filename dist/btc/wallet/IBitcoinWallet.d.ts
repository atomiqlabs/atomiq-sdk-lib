import * as BN from "bn.js";
export interface IBitcoinWallet {
    sendTransaction(address: string, amount: BN, feeRate?: number): Promise<string>;
    getTransactionFee(address: string, amount: BN, feeRate?: number): Promise<number>;
    getReceiveAddress(): string;
    getBalance(): Promise<{
        confirmedBalance: BN;
        unconfirmedBalance: BN;
    }>;
    getSpendableBalance(): Promise<{
        balance: BN;
        feeRate: number;
        totalFee: number;
    }>;
}
