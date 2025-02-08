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
    removeSwapData(swapData) {
        return __awaiter(this, void 0, void 0, function* () {
            const id = swapData.getIdentifierHashString();
            if (this.storage.data[id] == null)
                return false;
            yield this.storage.removeData(id);
            return true;
        });
    }
    /**
     * Removes an array of swap data from the underlying storage manager
     *
     * @param arr Array of swaps to remove
     */
    removeSwapDataArr(arr) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.storage.removeDataArr != null) {
                yield this.storage.removeDataArr(arr.map(swap => swap.getIdentifierHashString()));
                return;
            }
            for (let swapData of arr) {
                const id = swapData.getIdentifierHashString();
                yield this.storage.removeData(id);
            }
        });
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
    saveSwapDataArr(arr) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.storage.saveDataArr != null) {
                yield this.storage.saveDataArr(arr.map(swap => {
                    return { id: swap.getIdentifierHashString(), object: swap };
                }));
                return;
            }
            for (let swapData of arr) {
                const id = swapData.getIdentifierHashString();
                yield this.storage.saveData(id, swapData);
            }
        });
    }
    /**
     * Loads all the swaps from the underlying storage manager
     *
     * @param wrapper Swap wrapper
     * @param type Constructor for the swap
     */
    loadSwapData(wrapper, type) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.storage.loadData(type.bind(null, wrapper));
            return new Map(res.map(value => [value.getIdentifierHashString(), value]));
        });
    }
}
exports.SwapWrapperStorage = SwapWrapperStorage;
