import { BtcRelay, BtcStoredHeader, RelaySynchronizer } from "@atomiqlabs/base";
import { MempoolBitcoinBlock } from "../MempoolBitcoinBlock";
import { MempoolBitcoinRpc } from "../MempoolBitcoinRpc";
export declare class MempoolBtcRelaySynchronizer<B extends BtcStoredHeader<any>, TX> implements RelaySynchronizer<B, TX, MempoolBitcoinBlock> {
    bitcoinRpc: MempoolBitcoinRpc;
    btcRelay: BtcRelay<B, TX, MempoolBitcoinBlock>;
    constructor(btcRelay: BtcRelay<B, TX, MempoolBitcoinBlock>, bitcoinRpc: MempoolBitcoinRpc);
    syncToLatestTxs(signer: string): Promise<{
        txs: TX[];
        targetCommitedHeader: B;
        computedHeaderMap: {
            [blockheight: number]: B;
        };
        blockHeaderMap: {
            [blockheight: number]: MempoolBitcoinBlock;
        };
        btcRelayTipBlockHash: string;
        latestBlockHeader: MempoolBitcoinBlock;
        startForkId: number;
    }>;
}
