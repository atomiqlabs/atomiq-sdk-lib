"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexedDBStorageManager = void 0;
const Utils_1 = require("../utils/Utils");
/**
 * StorageManager using browser's IndexedDB storage, also migrates the data from prior LocalStorage API, if that was
 *  used before for a given "storageKey"
 */
class IndexedDBStorageManager {
    constructor(storageKey) {
        this.data = {};
        this.storageKey = storageKey;
        this.logger = (0, Utils_1.getLogger)("IndexedDBStorageManager(" + this.storageKey + "): ");
    }
    executeTransaction(cbk, readonly) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction("swaps", readonly ? "readonly" : "readwrite", { durability: "strict" });
            const req = cbk(tx.objectStore("swaps"));
            req.onsuccess = (event) => resolve(event.target.result);
            req.onerror = (event) => reject(event);
        });
    }
    executeTransactionArr(cbk, readonly) {
        const tx = this.db.transaction("swaps", readonly ? "readonly" : "readwrite", { durability: "strict" });
        const reqs = cbk(tx.objectStore("swaps"));
        return Promise.all(reqs.map(req => new Promise((resolve, reject) => {
            req.onsuccess = (event) => resolve(event.target.result);
            req.onerror = (event) => reject(event);
        })));
    }
    /**
     * Tries to migrate old LocalStorage API stored objects (if they exist) to the IndexedDB
     *
     * @private
     */
    async tryMigrate() {
        const txt = window.localStorage.getItem(this.storageKey);
        if (txt == null)
            return false;
        let data;
        try {
            data = JSON.parse(txt);
        }
        catch (e) {
            this.logger.error("tryMigrate(): Tried to migrate the database, but cannot parse old local storage!");
            return false;
        }
        await this.executeTransactionArr(store => Object.keys(data).map(id => {
            return store.put({ id, data: data[id] });
        }), false);
        window.localStorage.removeItem(this.storageKey);
        this.logger.info("tryMigrate(): Database successfully migrated from localStorage to indexedDB!");
        return true;
    }
    async init() {
        if (this.db == null) {
            this.db = await new Promise((resolve, reject) => {
                const request = window.indexedDB.open(this.storageKey, 1);
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    db.createObjectStore("swaps", { keyPath: "id" });
                };
                request.onerror = (e) => reject(e);
                request.onsuccess = (e) => resolve(e.target.result);
            });
        }
    }
    async loadData(type) {
        await this.tryMigrate();
        const result = await this.executeTransaction(store => store.getAll(), true);
        const returnObj = [];
        result.forEach(data => {
            const deserialized = new type(data.data);
            this.data[data.id] = deserialized;
            returnObj.push(deserialized);
        });
        return returnObj;
    }
    async removeData(hash) {
        await this.executeTransaction(store => store.delete(hash), false)
            .catch(() => null);
        if (this.data[hash] != null)
            delete this.data[hash];
    }
    async removeDataArr(arr) {
        await this.executeTransactionArr(store => arr.map(id => {
            return store.delete(id);
        }), false);
        arr.forEach(id => {
            if (this.data[id] != null)
                delete this.data[id];
        });
    }
    async saveData(hash, object) {
        await this.executeTransaction(store => store.put({
            id: hash,
            data: object.serialize()
        }), false);
        this.data[hash] = object;
    }
    async saveDataArr(arr) {
        await this.executeTransactionArr(store => arr.map(data => {
            return store.put({ id: data.id, data: data.object.serialize() });
        }), false);
        arr.forEach(data => {
            this.data[data.id] = data.object;
        });
    }
}
exports.IndexedDBStorageManager = IndexedDBStorageManager;
