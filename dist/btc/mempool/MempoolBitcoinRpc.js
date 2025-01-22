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
exports.MempoolBitcoinRpc = void 0;
const MempoolBitcoinBlock_1 = require("./MempoolBitcoinBlock");
const buffer_1 = require("buffer");
const createHash = require("create-hash");
const BN = require("bn.js");
const Utils_1 = require("../../utils/Utils");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
const BITCOIN_BLOCKTIME = 600 * 1000;
const BITCOIN_BLOCKSIZE = 1024 * 1024;
class MempoolBitcoinRpc {
    constructor(mempoolApi) {
        this.api = mempoolApi;
    }
    /**
     * Returns a txo hash for a specific transaction vout
     *
     * @param vout
     * @private
     */
    static getTxoHash(vout) {
        return createHash("sha256").update(buffer_1.Buffer.concat([
            buffer_1.Buffer.from(new BN(vout.value).toArray("le", 8)),
            buffer_1.Buffer.from(vout.scriptpubkey, "hex")
        ])).digest();
    }
    /**
     * Returns delay in milliseconds till an unconfirmed transaction is expected to confirm, returns -1
     *  if the transaction won't confirm any time soon
     *
     * @param feeRate
     * @private
     */
    getTimeTillConfirmation(feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const mempoolBlocks = yield this.api.getPendingBlocks();
            const mempoolBlockIndex = mempoolBlocks.findIndex(block => block.feeRange[0] <= feeRate);
            if (mempoolBlockIndex === -1)
                return -1;
            //Last returned block is usually an aggregate (or a stack) of multiple btc blocks, if tx falls in this block
            // and the last returned block really is an aggregate one (size bigger than BITCOIN_BLOCKSIZE) we return -1
            if (mempoolBlockIndex + 1 === mempoolBlocks.length &&
                mempoolBlocks[mempoolBlocks.length - 1].blockVSize > BITCOIN_BLOCKSIZE)
                return -1;
            return (mempoolBlockIndex + 1) * BITCOIN_BLOCKTIME;
        });
    }
    /**
     * Returns an estimate after which time the tx will confirm with the required amount of confirmations,
     *  confirmationDelay of -1 means the transaction won't confirm in the near future
     *
     * @param tx
     * @param requiredConfirmations
     * @private
     *
     * @returns estimated confirmation delay, -1 if the transaction won't confirm in the near future, null if the
     *  transaction was replaced or was confirmed in the meantime
     */
    getConfirmationDelay(tx, requiredConfirmations) {
        return __awaiter(this, void 0, void 0, function* () {
            if (tx.confirmations > requiredConfirmations)
                return 0;
            if (tx.confirmations === 0) {
                //Get CPFP data
                const cpfpData = yield this.api.getCPFPData(tx.txid);
                if (cpfpData.effectiveFeePerVsize == null) {
                    //Transaction is either confirmed in the meantime, or replaced
                    return null;
                }
                let confirmationDelay = (yield this.getTimeTillConfirmation(cpfpData.effectiveFeePerVsize));
                if (confirmationDelay !== -1)
                    confirmationDelay += (requiredConfirmations - 1) * BITCOIN_BLOCKTIME;
                return confirmationDelay;
            }
            return ((requiredConfirmations - tx.confirmations) * BITCOIN_BLOCKTIME);
        });
    }
    /**
     * Converts mempool API's transaction to BtcTx object
     * @param tx Transaction to convert
     * @param getRaw If the raw transaction field should be filled (requires one more network request)
     * @private
     */
    toBtcTx(tx, getRaw = true) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const rawTx = !getRaw ? null : yield this.api.getRawTransaction(tx.txid);
            let confirmations = 0;
            if (tx.status != null && tx.status.confirmed) {
                const blockheight = yield this.api.getTipBlockHeight();
                confirmations = blockheight - tx.status.block_height + 1;
            }
            let strippedRawTx;
            if (rawTx != null) {
                //Strip witness data
                const btcTx = bitcoinjs_lib_1.Transaction.fromBuffer(rawTx);
                btcTx.ins.forEach(txIn => txIn.witness = []);
                strippedRawTx = btcTx.toHex();
            }
            return {
                blockheight: (_a = tx.status) === null || _a === void 0 ? void 0 : _a.block_height,
                blockhash: (_b = tx.status) === null || _b === void 0 ? void 0 : _b.block_hash,
                confirmations,
                txid: tx.txid,
                vsize: tx.weight / 4,
                hex: strippedRawTx,
                raw: rawTx == null ? null : rawTx.toString("hex"),
                outs: tx.vout.map((e, index) => {
                    return {
                        value: e.value,
                        n: index,
                        scriptPubKey: {
                            hex: e.scriptpubkey,
                            asm: e.scriptpubkey_asm
                        }
                    };
                }),
                ins: tx.vin.map(e => {
                    return {
                        txid: e.txid,
                        vout: e.vout,
                        scriptSig: {
                            hex: e.scriptsig,
                            asm: e.scriptsig_asm
                        },
                        sequence: e.sequence,
                        txinwitness: e.witness
                    };
                }),
            };
        });
    }
    getTipHeight() {
        return this.api.getTipBlockHeight();
    }
    getBlockHeader(blockhash) {
        return __awaiter(this, void 0, void 0, function* () {
            return new MempoolBitcoinBlock_1.MempoolBitcoinBlock(yield this.api.getBlockHeader(blockhash));
        });
    }
    getMerkleProof(txId, blockhash) {
        return __awaiter(this, void 0, void 0, function* () {
            const proof = yield this.api.getTransactionProof(txId);
            return {
                reversedTxId: buffer_1.Buffer.from(txId, "hex").reverse(),
                pos: proof.pos,
                merkle: proof.merkle.map(e => buffer_1.Buffer.from(e, "hex").reverse()),
                blockheight: proof.block_height
            };
        });
    }
    getTransaction(txId) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = yield this.api.getTransaction(txId);
            if (tx == null)
                return null;
            return yield this.toBtcTx(tx);
        });
    }
    isInMainChain(blockhash) {
        return __awaiter(this, void 0, void 0, function* () {
            const blockStatus = yield this.api.getBlockStatus(blockhash);
            return blockStatus.in_best_chain;
        });
    }
    getBlockhash(height) {
        return this.api.getBlockHash(height);
    }
    getBlockWithTransactions(blockhash) {
        throw new Error("Unsupported.");
    }
    getSyncInfo() {
        return __awaiter(this, void 0, void 0, function* () {
            const tipHeight = yield this.api.getTipBlockHeight();
            return {
                verificationProgress: 1,
                blocks: tipHeight,
                headers: tipHeight,
                ibd: false
            };
        });
    }
    getPast15Blocks(height) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.api.getPast15BlockHeaders(height)).map(blockHeader => new MempoolBitcoinBlock_1.MempoolBitcoinBlock(blockHeader));
        });
    }
    checkAddressTxos(address, txoHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const allTxs = yield this.api.getAddressTransactions(address);
            const relevantTxs = allTxs
                .map(tx => {
                return {
                    tx,
                    vout: tx.vout.findIndex(vout => MempoolBitcoinRpc.getTxoHash(vout).equals(txoHash))
                };
            })
                .filter(obj => obj.vout >= 0)
                .sort((a, b) => {
                if (a.tx.status.confirmed && !b.tx.status.confirmed)
                    return -1;
                if (!a.tx.status.confirmed && b.tx.status.confirmed)
                    return 1;
                if (a.tx.status.confirmed && b.tx.status.confirmed)
                    return a.tx.status.block_height - b.tx.status.block_height;
                return 0;
            });
            if (relevantTxs.length === 0)
                return null;
            return {
                tx: yield this.toBtcTx(relevantTxs[0].tx, false),
                vout: relevantTxs[0].vout
            };
        });
    }
    /**
     * Waits till the address receives a transaction containing a specific txoHash
     *
     * @param address
     * @param txoHash
     * @param requiredConfirmations
     * @param stateUpdateCbk
     * @param abortSignal
     * @param intervalSeconds
     */
    waitForAddressTxo(address, txoHash, requiredConfirmations, stateUpdateCbk, abortSignal, intervalSeconds) {
        return __awaiter(this, void 0, void 0, function* () {
            if (abortSignal != null)
                abortSignal.throwIfAborted();
            while (abortSignal == null || !abortSignal.aborted) {
                yield (0, Utils_1.timeoutPromise)((intervalSeconds || 5) * 1000, abortSignal);
                const result = yield this.checkAddressTxos(address, txoHash);
                if (result == null) {
                    stateUpdateCbk(null, null, null, null);
                    continue;
                }
                const confirmationDelay = yield this.getConfirmationDelay(result.tx, requiredConfirmations);
                if (confirmationDelay == null)
                    continue;
                if (stateUpdateCbk != null)
                    stateUpdateCbk(result.tx.confirmations, result.tx.txid, result.vout, confirmationDelay);
                if (confirmationDelay === 0)
                    return result;
            }
            abortSignal.throwIfAborted();
        });
    }
    getLNNodeLiquidity(pubkey) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeInfo = yield this.api.getLNNodeInfo(pubkey);
            return {
                publicKey: nodeInfo.public_key,
                capacity: new BN(nodeInfo.capacity),
                numChannels: nodeInfo.active_channel_count
            };
        });
    }
    sendRawTransaction(rawTx) {
        return this.api.sendTransaction(rawTx);
    }
    sendRawPackage(rawTx) {
        throw new Error("Unsupported");
    }
}
exports.MempoolBitcoinRpc = MempoolBitcoinRpc;
