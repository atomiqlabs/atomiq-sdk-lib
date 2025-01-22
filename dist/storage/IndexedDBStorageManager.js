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
    tryMigrate() {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield this.executeTransactionArr(store => Object.keys(data).map(id => {
                return store.put({ id, data: data[id] });
            }), false);
            window.localStorage.removeItem(this.storageKey);
            this.logger.info("tryMigrate(): Database successfully migrated from localStorage to indexedDB!");
            return true;
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.db == null) {
                this.db = yield new Promise((resolve, reject) => {
                    const request = window.indexedDB.open(this.storageKey, 1);
                    request.onupgradeneeded = (event) => {
                        const db = event.target.result;
                        db.createObjectStore("swaps", { keyPath: "id" });
                    };
                    request.onerror = (e) => reject(e);
                    request.onsuccess = (e) => resolve(e.target.result);
                });
            }
        });
    }
    loadData(type) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.tryMigrate();
            const result = yield this.executeTransaction(store => store.getAll(), true);
            const returnObj = [];
            result.forEach(data => {
                const deserialized = new type(data.data);
                this.data[data.id] = deserialized;
                returnObj.push(deserialized);
            });
            return returnObj;
        });
    }
    removeData(hash) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.executeTransaction(store => store.delete(hash), false)
                .catch(() => null);
            if (this.data[hash] != null)
                delete this.data[hash];
        });
    }
    removeDataArr(arr) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.executeTransactionArr(store => arr.map(id => {
                return store.delete(id);
            }), false);
            arr.forEach(id => {
                if (this.data[id] != null)
                    delete this.data[id];
            });
        });
    }
    saveData(hash, object) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.executeTransaction(store => store.put({
                id: hash,
                data: object.serialize()
            }), false);
            this.data[hash] = object;
        });
    }
    saveDataArr(arr) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.executeTransactionArr(store => arr.map(data => {
                return store.put({ id: data.id, data: data.object.serialize() });
            }), false);
            arr.forEach(data => {
                this.data[data.id] = data.object;
            });
        });
    }
}
exports.IndexedDBStorageManager = IndexedDBStorageManager;
