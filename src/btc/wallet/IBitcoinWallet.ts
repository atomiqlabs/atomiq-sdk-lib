
export interface IBitcoinWallet {
    sendTransaction(address: string, amount: bigint, feeRate?: number): Promise<string>;
    getTransactionFee(address: string, amount: bigint, feeRate?: number): Promise<number>;
    getReceiveAddress(): string;
    getBalance(): Promise<{
        confirmedBalance: bigint,
        unconfirmedBalance: bigint
    }>;
    getSpendableBalance(): Promise<{
        balance: bigint,
        feeRate: number,
        totalFee: number
    }>;
}
