"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapWrapperStorage = void 0;
const Utils_1 = require("../utils/Utils");
const SwapType_1 = require("../swaps/SwapType");
const logger = (0, Utils_1.getLogger)("SwapWrapperStorage: ");
function matches(conditions, swap) {
    for (let condition of conditions) {
        let value = swap[condition.key];
        if (condition.key === "initiator")
            value = swap.getInitiator();
        if (condition.key === "escrowHash")
            value = swap.getEscrowHash();
        if (condition.key === "identifier")
            value = swap.getIdentifierHashString();
        if (condition.key === "type")
            value = swap.getType();
        if (!condition.values.has(value))
            return false;
    }
    return true;
}
function toSetConditions(input) {
    return input.map(val => {
        return {
            key: val.key,
            values: Array.isArray(val.value) ? new Set(val.value) : new Set([val.value])
        };
    });
}
class SwapWrapperStorage {
    constructor(storage, wrappers) {
        this.storageManagers = {};
        this.swapData = {};
        this.wrappers = wrappers;
        const arr = [
            SwapType_1.SwapType.FROM_BTCLN,
            SwapType_1.SwapType.FROM_BTC,
            SwapType_1.SwapType.TRUSTED_FROM_BTC,
            SwapType_1.SwapType.TRUSTED_FROM_BTCLN,
            SwapType_1.SwapType.TO_BTC,
            SwapType_1.SwapType.TO_BTCLN
        ];
        for (let key of arr) {
            this.storageManagers[key] = storage(key);
        }
    }
    /**
     * Initializes the underlying storage manager, needs to be called before any other action is taken
     */
    async init() {
        await Promise.all(Object.keys(this.storageManagers).map(async (key) => {
            const storage = this.storageManagers[key];
            const wrapper = this.wrappers[key];
            await storage.init();
            const res = await storage.loadData(wrapper.swapDeserializer.bind(null, wrapper));
            this.swapData[key] = new Map(res.map(value => [value.getIdentifierHashString(), value]));
        }));
    }
    /**
     * Params are specified in the following way:
     *  - [condition1, condition2] - returns all rows where condition1 AND condition2 is met
     * @param params
     * @param reviver
     */
    query(params, reviver) {
        const escrowHashConditionIndex = params.findIndex(obj => obj.key === "escrowHash");
        if (escrowHashConditionIndex !== -1) {
            const setConditions = toSetConditions(params);
            const escrowHashCondition = setConditions[escrowHashConditionIndex];
            setConditions.splice(escrowHashConditionIndex, 1);
            const resultSwaps = [];
            for (let escrowHash of escrowHashCondition.values.values()) {
                const swap = this.swapDataByEscrowHash.get(escrowHash);
                if (matches(setConditions, swap))
                    resultSwaps.push(swap);
            }
            return Promise.resolve(resultSwaps);
        }
        const swapTypeConditionIndex = params.findIndex(obj => obj.key === "type");
        let useTypes = null;
        if (swapTypeConditionIndex !== -1) {
            const swapTypeCondition = params[swapTypeConditionIndex];
            params.splice(swapTypeConditionIndex, 1);
            if (Array.isArray(swapTypeCondition.value)) {
                useTypes = swapTypeCondition.value;
            }
            else {
                useTypes = [swapTypeCondition.value];
            }
        }
        const setConditions = toSetConditions(params);
        const resultSwaps = [];
        if (useTypes == null) {
            for (let type in this.swapData) {
                const swaps = this.swapData[type];
                for (let swap of swaps.values()) {
                    if (matches(setConditions, swap))
                        resultSwaps.push(swap);
                }
            }
        }
        else {
            for (let type of useTypes) {
                const swaps = this.swapData[type];
                for (let swap of swaps.values()) {
                    if (matches(setConditions, swap))
                        resultSwaps.push(swap);
                }
            }
        }
        return Promise.resolve(resultSwaps);
    }
    save(swapData) {
        const id = swapData.getIdentifierHashString();
        const storedSwaps = this.swapData[swapData.getType()];
        storedSwaps.set(id, swapData);
        const escrowHash = swapData.getEscrowHash();
        if (escrowHash != null)
            this.swapDataByEscrowHash.set(escrowHash, swapData);
        return this.storageManagers[swapData.getType()].saveData(id, swapData);
    }
    async saveAll(values) {
        const swapsByType = {};
        values.forEach(swapData => {
            const type = swapData.getType();
            swapsByType[type] ?? (swapsByType[type] = []);
            swapsByType[type].push(swapData);
        });
        for (let type in swapsByType) {
            const storage = this.storageManagers[type];
            const swaps = swapsByType[type];
            const storedSwaps = this.swapData[type];
            const saveSwaps = swaps.map(swap => {
                return { id: swap.getIdentifierHashString(), object: swap };
            });
            if (storage.saveDataArr != null) {
                await storage.saveDataArr(saveSwaps);
                saveSwaps.forEach(({ id, object }) => storedSwaps.set(id, object));
                return;
            }
            for (let swap of saveSwaps) {
                storedSwaps.set(swap.id, swap.object);
                const escrowHash = swap.object.getEscrowHash();
                if (escrowHash != null)
                    this.swapDataByEscrowHash.set(escrowHash, swap.object);
                await storage.saveData(swap.id, swap.object);
            }
        }
    }
    remove(swapData) {
        const id = swapData.getIdentifierHashString();
        const storedSwaps = this.swapData[swapData.getType()];
        if (!storedSwaps.delete(id))
            return;
        const escrowHash = swapData.getEscrowHash();
        if (escrowHash != null)
            this.swapDataByEscrowHash.delete(escrowHash);
        return this.storageManagers[swapData.getType()].removeData(id);
    }
    async removeAll(values) {
        const swapsByType = {};
        values.forEach(swapData => {
            const type = swapData.getType();
            swapsByType[type] ?? (swapsByType[type] = []);
            swapsByType[type].push(swapData);
        });
        for (let type in swapsByType) {
            const storage = this.storageManagers[type];
            const swaps = swapsByType[type];
            const storedSwaps = this.swapData[type];
            const swapIds = swaps.map(swap => swap.getIdentifierHashString());
            if (storage.removeDataArr != null) {
                await storage.removeDataArr(swapIds);
                swapIds.forEach(swapId => storedSwaps.delete(swapId));
                return;
            }
            for (let swap of swaps) {
                const swapId = swap.getIdentifierHashString();
                if (!storedSwaps.delete(swapId))
                    continue;
                const escrowHash = swap.getEscrowHash();
                if (escrowHash != null)
                    this.swapDataByEscrowHash.delete(escrowHash);
                await storage.removeData(swapId);
            }
        }
    }
}
exports.SwapWrapperStorage = SwapWrapperStorage;
