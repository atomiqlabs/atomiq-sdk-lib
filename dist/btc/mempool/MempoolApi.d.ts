/// <reference types="node" />
/// <reference types="node" />
import * as BN from "bn.js";
import { Buffer } from "buffer";
export type TxVout = {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
};
export type TxVin = {
    txid: string;
    vout: number;
    prevout: TxVout;
    scriptsig: string;
    scriptsig_asm: string;
    witness: string[];
    is_coinbase: boolean;
    sequence: number;
    inner_witnessscript_asm: string;
};
export type BitcoinTransaction = {
    txid: string;
    version: number;
    locktime: number;
    vin: TxVin[];
    vout: TxVout[];
    size: number;
    weight: number;
    fee: number;
    status: {
        confirmed: boolean;
        block_height: number;
        block_hash: string;
        block_time: number;
    };
};
export type BlockData = {
    bits: number;
    difficulty: number;
    extras: any;
    height: number;
    id: string;
    mediantime: number;
    merkle_root: string;
    nonce: number;
    previousblockhash: string;
    size: number;
    timestamp: number;
    tx_count: number;
    version: number;
    weight: number;
};
export type BitcoinBlockHeader = {
    id: string;
    height: number;
    version: number;
    timestamp: number;
    tx_count: number;
    size: number;
    weight: number;
    merkle_root: string;
    previousblockhash: string;
    mediantime: number;
    nonce: number;
    bits: number;
    difficulty: number;
};
export type LNNodeInfo = {
    public_key: string;
    alias: string;
    first_seen: number;
    updated_at: number;
    color: string;
    sockets: string;
    as_number: number;
    city_id: number;
    country_id: number;
    subdivision_id: number;
    longtitude: number;
    latitude: number;
    iso_code: string;
    as_organization: string;
    city: {
        [lang: string]: string;
    };
    country: {
        [lang: string]: string;
    };
    subdivision: {
        [lang: string]: string;
    };
    active_channel_count: number;
    capacity: string;
    opened_channel_count: number;
    closed_channel_count: number;
};
export type AddressInfo = {
    address: string;
    chain_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
    };
    mempool_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
    };
};
export type TransactionCPFPData = {
    ancestors: {
        txid: string;
        fee: number;
        weight: number;
    }[];
    descendants: {
        txid: string;
        fee: number;
        weight: number;
    }[];
    effectiveFeePerVsize: number;
    sigops: number;
    adjustedVsize: number;
};
export type BitcoinFees = {
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
};
export type BitcoinPendingBlock = {
    blockSize: number;
    blockVSize: number;
    nTx: number;
    totalFees: number;
    medianFee: number;
    feeRange: number[];
};
export type BlockStatus = {
    in_best_chain: boolean;
    height: number;
    next_best: string;
};
export type TransactionProof = {
    block_height: number;
    merkle: string[];
    pos: number;
};
export declare class MempoolApi {
    url: string;
    timeout: number;
    /**
     * Sends a GET or POST request to the mempool api, handling the non-200 responses as errors & throwing
     *
     * @param path
     * @param responseType
     * @param type
     * @param body
     */
    private request;
    constructor(url?: string, timeout?: number);
    /**
     * Returns information about a specific lightning network node as identified by the public key (in hex encoding)
     *
     * @param pubkey
     */
    getLNNodeInfo(pubkey: string): Promise<LNNodeInfo | null>;
    /**
     * Returns on-chain transaction as identified by its txId
     *
     * @param txId
     */
    getTransaction(txId: string): Promise<BitcoinTransaction | null>;
    /**
     * Returns raw binary encoded bitcoin transaction, also strips the witness data from the transaction
     *
     * @param txId
     */
    getRawTransaction(txId: string): Promise<Buffer>;
    /**
     * Returns confirmed & unconfirmed balance of the specific bitcoin address
     *
     * @param address
     */
    getAddressBalances(address: string): Promise<{
        confirmedBalance: BN;
        unconfirmedBalance: BN;
    }>;
    /**
     * Returns CPFP (children pays for parent) data for a given transaction
     *
     * @param txId
     */
    getCPFPData(txId: string): Promise<TransactionCPFPData>;
    /**
     * Returns UTXOs (unspent transaction outputs) for a given address
     *
     * @param address
     */
    getAddressUTXOs(address: string): Promise<{
        txid: string;
        vout: number;
        status: {
            confirmed: boolean;
            block_height: number;
            block_hash: string;
            block_time: number;
        };
        value: BN;
    }[]>;
    /**
     * Returns current on-chain bitcoin fees
     */
    getFees(): Promise<BitcoinFees>;
    /**
     * Returns all transactions for a given address
     *
     * @param address
     */
    getAddressTransactions(address: string): Promise<BitcoinTransaction[]>;
    /**
     * Returns expected pending (mempool) blocks
     */
    getPendingBlocks(): Promise<BitcoinPendingBlock[]>;
    /**
     * Returns the blockheight of the current bitcoin blockchain's tip
     */
    getTipBlockHeight(): Promise<number>;
    /**
     * Returns the bitcoin blockheader as identified by its blockhash
     *
     * @param blockhash
     */
    getBlockHeader(blockhash: string): Promise<BitcoinBlockHeader>;
    /**
     * Returns the block status
     *
     * @param blockhash
     */
    getBlockStatus(blockhash: string): Promise<BlockStatus>;
    /**
     * Returns the transaction's proof (merkle proof)
     *
     * @param txId
     */
    getTransactionProof(txId: string): Promise<TransactionProof>;
    /**
     * Returns blockhash of a block at a specific blockheight
     *
     * @param height
     */
    getBlockHash(height: number): Promise<string>;
    /**
     * Returns past 15 blockheaders before (and including) the specified height
     *
     * @param endHeight
     */
    getPast15BlockHeaders(endHeight: number): Promise<BlockData[]>;
    /**
     * Sends raw hex encoded bitcoin transaction
     *
     * @param transactionHex
     */
    sendTransaction(transactionHex: string): Promise<string>;
}
