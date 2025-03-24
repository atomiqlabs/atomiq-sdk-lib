"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedSwapEventListener = void 0;
const base_1 = require("@atomiqlabs/base");
function chainEventToEscrowHash(event) {
    if (event instanceof base_1.SwapEvent)
        return event.escrowHash;
    if (event instanceof base_1.SpvVaultFrontEvent ||
        event instanceof base_1.SpvVaultClaimEvent ||
        event instanceof base_1.SpvVaultCloseEvent)
        return event.btcTxId;
}
class UnifiedSwapEventListener {
    constructor(unifiedStorage, events) {
        this.listeners = {};
        this.storage = unifiedStorage;
        this.events = events;
    }
    async processEvents(events) {
        const swapsByEscrowHash = {};
        events.forEach(event => {
            swapsByEscrowHash[chainEventToEscrowHash(event)] = null;
        });
        const swaps = await this.storage.query([
            [{ key: "escrowHash", value: Object.keys(swapsByEscrowHash) }]
        ], (val) => {
            const obj = this.listeners[val.type];
            if (obj == null)
                return null;
            return new obj.reviver(val);
        });
        swaps.forEach(swap => swapsByEscrowHash[swap.getEscrowHash()] = swap);
        for (let event of events) {
            const swap = swapsByEscrowHash[chainEventToEscrowHash(event)];
            if (swap == null)
                continue;
            const obj = this.listeners[swap.getType()];
            if (obj == null)
                continue;
            await obj.listener(event, swap);
        }
    }
    async start() {
        if (this.listener != null)
            return;
        await this.storage.init();
        await this.events.init();
        this.events.registerListener(this.listener = async (events) => {
            await this.processEvents(events);
            return true;
        });
    }
    stop() {
        this.events.unregisterListener(this.listener);
    }
    registerListener(type, listener, reviver) {
        this.listeners[type] = {
            listener,
            reviver
        };
    }
    unregisterListener(type) {
        if (this.listeners[type])
            return false;
        delete this.listeners[type];
        return true;
    }
}
exports.UnifiedSwapEventListener = UnifiedSwapEventListener;
