"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStorageManager = void 0;
/**
 * StorageManager storing the data in memory, the data is lost after page refresh
 */
class MemoryStorageManager {
    constructor() {
        this.data = {};
    }
    init() {
        return Promise.resolve();
    }
    loadData(type) {
        return Promise.resolve(Object.keys(this.data).map(key => this.data[key]));
    }
    removeData(hash) {
        if (this.data[hash] != null)
            delete this.data[hash];
        return Promise.resolve();
    }
    removeDataArr(arr) {
        arr.forEach(id => {
            if (this.data[id] != null)
                delete this.data[id];
        });
        return Promise.resolve();
    }
    saveData(hash, object) {
        this.data[hash] = object;
        return Promise.resolve();
    }
    saveDataArr(arr) {
        arr.forEach(data => {
            this.data[data.id] = data.object;
        });
        return Promise.resolve();
    }
}
exports.MemoryStorageManager = MemoryStorageManager;
