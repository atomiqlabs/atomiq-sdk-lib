"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MempoolApi = void 0;
const BN = require("bn.js");
const buffer_1 = require("buffer");
const Utils_1 = require("../../utils/Utils");
const RequestError_1 = require("../../errors/RequestError");
class MempoolApi {
    /**
     * Sends a GET or POST request to the mempool api, handling the non-200 responses as errors & throwing
     *
     * @param path
     * @param responseType
     * @param type
     * @param body
     */
    request(path, responseType, type = "GET", body) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield (0, Utils_1.tryWithRetries)(() => (0, Utils_1.fetchWithTimeout)(this.url + path, {
                method: type,
                timeout: this.timeout,
                body: typeof (body) === "string" ? body : JSON.stringify(body)
            }));
            if (response.status !== 200) {
                let resp;
                try {
                    resp = yield response.text();
                }
                catch (e) {
                    throw new RequestError_1.RequestError(response.statusText, response.status);
                }
                throw RequestError_1.RequestError.parse(resp, response.status);
            }
            if (responseType === "str")
                return yield response.text();
            return yield response.json();
        });
    }
    constructor(url, timeout) {
        this.url = url || "https://mempool.space/testnet/api/";
        this.timeout = timeout;
    }
    /**
     * Returns information about a specific lightning network node as identified by the public key (in hex encoding)
     *
     * @param pubkey
     */
    getLNNodeInfo(pubkey) {
        return this.request("v1/lightning/nodes/" + pubkey, "obj").catch((e) => {
            if (e.message === "This node does not exist, or our node is not seeing it yet")
                return null;
            throw e;
        });
    }
    /**
     * Returns on-chain transaction as identified by its txId
     *
     * @param txId
     */
    getTransaction(txId) {
        return this.request("tx/" + txId, "obj").catch((e) => {
            if (e.message === "Transaction not found")
                return null;
            throw e;
        });
    }
    /**
     * Returns raw binary encoded bitcoin transaction, also strips the witness data from the transaction
     *
     * @param txId
     */
    getRawTransaction(txId) {
        return __awaiter(this, void 0, void 0, function* () {
            const rawTransaction = yield this.request("tx/" + txId + "/hex", "str");
            return buffer_1.Buffer.from(rawTransaction, "hex");
        });
    }
    /**
     * Returns confirmed & unconfirmed balance of the specific bitcoin address
     *
     * @param address
     */
    getAddressBalances(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const jsonBody = yield this.request("address/" + address, "obj");
            const confirmedInput = new BN(jsonBody.chain_stats.funded_txo_sum);
            const confirmedOutput = new BN(jsonBody.chain_stats.spent_txo_sum);
            const unconfirmedInput = new BN(jsonBody.mempool_stats.funded_txo_sum);
            const unconfirmedOutput = new BN(jsonBody.mempool_stats.spent_txo_sum);
            return {
                confirmedBalance: confirmedInput.sub(confirmedOutput),
                unconfirmedBalance: unconfirmedInput.sub(unconfirmedOutput)
            };
        });
    }
    /**
     * Returns CPFP (children pays for parent) data for a given transaction
     *
     * @param txId
     */
    getCPFPData(txId) {
        return this.request("v1/cpfp/" + txId, "obj");
    }
    /**
     * Returns UTXOs (unspent transaction outputs) for a given address
     *
     * @param address
     */
    getAddressUTXOs(address) {
        return __awaiter(this, void 0, void 0, function* () {
            let jsonBody = yield this.request("address/" + address + "/utxo", "obj");
            jsonBody.forEach(e => e.value = new BN(e.value));
            return jsonBody;
        });
    }
    /**
     * Returns current on-chain bitcoin fees
     */
    getFees() {
        return this.request("v1/fees/recommended", "obj");
    }
    /**
     * Returns all transactions for a given address
     *
     * @param address
     */
    getAddressTransactions(address) {
        return this.request("address/" + address + "/txs", "obj");
    }
    /**
     * Returns expected pending (mempool) blocks
     */
    getPendingBlocks() {
        return this.request("v1/fees/mempool-blocks", "obj");
    }
    /**
     * Returns the blockheight of the current bitcoin blockchain's tip
     */
    getTipBlockHeight() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.request("blocks/tip/height", "str");
            return parseInt(response);
        });
    }
    /**
     * Returns the bitcoin blockheader as identified by its blockhash
     *
     * @param blockhash
     */
    getBlockHeader(blockhash) {
        return this.request("block/" + blockhash, "obj");
    }
    /**
     * Returns the block status
     *
     * @param blockhash
     */
    getBlockStatus(blockhash) {
        return this.request("block/" + blockhash + "/status", "obj");
    }
    /**
     * Returns the transaction's proof (merkle proof)
     *
     * @param txId
     */
    getTransactionProof(txId) {
        return this.request("tx/" + txId + "/merkle-proof", "obj");
    }
    /**
     * Returns blockhash of a block at a specific blockheight
     *
     * @param height
     */
    getBlockHash(height) {
        return this.request("block-height/" + height, "str");
    }
    /**
     * Returns past 15 blockheaders before (and including) the specified height
     *
     * @param endHeight
     */
    getPast15BlockHeaders(endHeight) {
        return this.request("v1/blocks/" + endHeight, "obj");
    }
    /**
     * Sends raw hex encoded bitcoin transaction
     *
     * @param transactionHex
     */
    sendTransaction(transactionHex) {
        return this.request("tx", "str", "POST", transactionHex);
    }
}
exports.MempoolApi = MempoolApi;
