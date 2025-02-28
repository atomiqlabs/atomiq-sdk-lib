"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwapWrapperStorage = void 0;
class SwapWrapperStorage {
    constructor(storage) {
        this.storage = storage;
    }
    /**
     * Initializes the underlying storage manager, needs to be called before any other action is taken
     */
    init() {
        return this.storage.init();
    }
    /**
     * Removes the swap data from the underlying storage manager
     *
     * @param swapData Swap to remove
     */
    async removeSwapData(swapData) {
        const id = swapData.getIdentifierHashString();
        if (this.storage.data[id] == null)
            return false;
        await this.storage.removeData(id);
        return true;
    }
    /**
     * Removes an array of swap data from the underlying storage manager
     *
     * @param arr Array of swaps to remove
     */
    async removeSwapDataArr(arr) {
        if (this.storage.removeDataArr != null) {
            await this.storage.removeDataArr(arr.map(swap => swap.getIdentifierHashString()));
            return;
        }
        for (let swapData of arr) {
            const id = swapData.getIdentifierHashString();
            await this.storage.removeData(id);
        }
    }
    /**
     * Saves the swap to the underlying storage manager
     *
     * @param swapData Swap to save
     */
    saveSwapData(swapData) {
        const id = swapData.getIdentifierHashString();
        return this.storage.saveData(id, swapData);
    }
    /**
     * Saves an array of swaps to the underlying storage manager
     *
     * @param arr Array of swaps to save
     */
    async saveSwapDataArr(arr) {
        if (this.storage.saveDataArr != null) {
            await this.storage.saveDataArr(arr.map(swap => {
                return { id: swap.getIdentifierHashString(), object: swap };
            }));
            return;
        }
        for (let swapData of arr) {
            const id = swapData.getIdentifierHashString();
            await this.storage.saveData(id, swapData);
        }
    }
    /**
     * Loads all the swaps from the underlying storage manager
     *
     * @param wrapper Swap wrapper
     * @param type Constructor for the swap
     */
    async loadSwapData(wrapper, type) {
        const res = await this.storage.loadData(type.bind(null, wrapper));
        return new Map(res.map(value => [value.getIdentifierHashString(), value]));
    }
}
exports.SwapWrapperStorage = SwapWrapperStorage;
