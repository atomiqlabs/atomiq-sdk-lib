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
exports.MempoolBtcRelaySynchronizer = void 0;
const Utils_1 = require("../../../utils/Utils");
const logger = (0, Utils_1.getLogger)("MempoolBtcRelaySynchronizer: ");
class MempoolBtcRelaySynchronizer {
    constructor(btcRelay, bitcoinRpc) {
        this.btcRelay = btcRelay;
        this.bitcoinRpc = bitcoinRpc;
    }
    syncToLatestTxs(signer, feeRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const tipData = yield this.btcRelay.getTipData();
            let cacheData = {
                forkId: 0,
                lastStoredHeader: null,
                tx: null,
                computedCommitedHeaders: null
            };
            const { resultStoredHeader, resultBitcoinHeader } = yield this.btcRelay.retrieveLatestKnownBlockLog();
            cacheData.lastStoredHeader = resultStoredHeader;
            if (resultStoredHeader.getBlockheight() < tipData.blockheight)
                cacheData.forkId = -1; //Indicate that we will be submitting blocks to fork
            let spvTipBlockHeader = resultBitcoinHeader;
            const btcRelayTipBlockHash = spvTipBlockHeader.getHash();
            logger.debug("Retrieved stored header with commitment: ", cacheData.lastStoredHeader);
            logger.debug("SPV tip bitcoin RPC block header: ", spvTipBlockHeader);
            let spvTipBlockHeight = spvTipBlockHeader.height;
            const txsList = [];
            const blockHeaderMap = {
                [resultBitcoinHeader.getHeight()]: resultBitcoinHeader
            };
            const computedHeaderMap = {
                [resultStoredHeader.getBlockheight()]: resultStoredHeader
            };
            let startForkId = null;
            let forkFee = feeRate;
            let mainFee = feeRate;
            const saveHeaders = (headerCache) => __awaiter(this, void 0, void 0, function* () {
                if (cacheData.forkId === -1) {
                    if (mainFee == null)
                        mainFee = yield this.btcRelay.getMainFeeRate(signer);
                    cacheData = yield this.btcRelay.saveNewForkHeaders(signer, headerCache, cacheData.lastStoredHeader, tipData.chainWork, mainFee);
                }
                else if (cacheData.forkId === 0) {
                    if (mainFee == null)
                        mainFee = yield this.btcRelay.getMainFeeRate(signer);
                    cacheData = yield this.btcRelay.saveMainHeaders(signer, headerCache, cacheData.lastStoredHeader, mainFee);
                }
                else {
                    if (forkFee == null)
                        forkFee = yield this.btcRelay.getForkFeeRate(signer, cacheData.forkId);
                    cacheData = yield this.btcRelay.saveForkHeaders(signer, headerCache, cacheData.lastStoredHeader, cacheData.forkId, tipData.chainWork, forkFee);
                }
                if (cacheData.forkId !== -1 && cacheData.forkId !== 0)
                    startForkId = cacheData.forkId;
                txsList.push(cacheData.tx);
                for (let storedHeader of cacheData.computedCommitedHeaders) {
                    computedHeaderMap[storedHeader.getBlockheight()] = storedHeader;
                }
            });
            let retrievedHeaders = null;
            let headerCache = [];
            while (retrievedHeaders == null || retrievedHeaders.length > 0) {
                retrievedHeaders = yield this.bitcoinRpc.getPast15Blocks(spvTipBlockHeight + 15);
                for (let i = retrievedHeaders.length - 1; i >= 0; i--) {
                    const header = retrievedHeaders[i];
                    blockHeaderMap[header.height] = header;
                    headerCache.push(header);
                    if (cacheData.forkId === 0 ?
                        headerCache.length >= this.btcRelay.maxHeadersPerTx :
                        headerCache.length >= this.btcRelay.maxForkHeadersPerTx) {
                        yield saveHeaders(headerCache);
                        headerCache = [];
                    }
                }
                if (retrievedHeaders.length > 0) {
                    spvTipBlockHeight = retrievedHeaders[0].height;
                    yield (0, Utils_1.timeoutPromise)(1000);
                }
            }
            if (headerCache.length > 0)
                yield saveHeaders(headerCache);
            return {
                txs: txsList,
                targetCommitedHeader: cacheData.lastStoredHeader,
                blockHeaderMap,
                computedHeaderMap,
                btcRelayTipBlockHash: btcRelayTipBlockHash,
                latestBlockHeader: spvTipBlockHeader,
                startForkId
            };
        });
    }
}
exports.MempoolBtcRelaySynchronizer = MempoolBtcRelaySynchronizer;
