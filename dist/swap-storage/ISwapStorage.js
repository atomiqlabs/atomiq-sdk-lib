"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnifiedSwapStorage = void 0;
class UnifiedSwapStorage {
    constructor(storage) {
        this.storage = storage;
    }
    init() {
        return this.storage.init();
    }
    /**
     * Params are specified in the following way:
     *  - [condition1, condition2] - returns all rows where condition1 AND condition2 is met
     * @param params
     * @param reviver
     */
    async query(params, reviver) {
        const rawSwaps = await this.storage.query(params);
        return rawSwaps.map(rawObj => {
            const savedRef = this.weakRefCache.get(rawObj.id)?.deref();
            if (savedRef != null)
                return savedRef;
            const value = reviver(rawObj);
            this.weakRefCache.set(rawObj.id, new WeakRef(value));
            return value;
        });
    }
    save(value) {
        return this.storage.save(value.serialize());
    }
    saveAll(value) {
        return this.storage.save(value.map(obj => obj.serialize()));
    }
    remove(value) {
        return this.storage.remove(value.serialize());
    }
    removeAll(value) {
        return this.storage.removeAll(value.map(obj => obj.serialize()));
    }
}
exports.UnifiedSwapStorage = UnifiedSwapStorage;
