"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryIndexedKeyValueUnifiedStorage = void 0;
const promise_queue_ts_1 = require("promise-queue-ts");
const Utils_1 = require("../utils/Utils");
function toCompositeIndexIdentifier(keys) {
    return keys.join(",");
}
function toCompositeIndexValueArr(values) {
    return values.map(value => toIndexValueString(value))
        .join(",");
}
function toCompositeIndexValue(keys, obj) {
    return keys
        .map(key => toIndexValueString(obj[key]))
        .join(",");
}
function toIndexValueString(value) {
    if (value == null)
        return "NULL";
    return value.toString(10);
}
function toIndexValue(value) {
    return value == null ? null : value;
}
function matches(conditions, obj) {
    for (let condition of conditions) {
        let value = obj[condition.key];
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
function toCompositeIndex(values) {
    if (values.length === 0)
        return [];
    if (values.length === 1) {
        return values[0];
    }
    else {
        const compositeArray = [];
        const firstValues = values.shift();
        const restValues = toCompositeIndex(values);
        for (let value of firstValues) {
            for (let restValue of restValues) {
                compositeArray.push([value].concat(restValue));
            }
        }
        return compositeArray;
    }
}
const logger = (0, Utils_1.getLogger)("MemoryIndexedKeyValueUnifiedStorage: ");
/**
 * Unified storage wrapper that can be used on top of a simple key-value storage, this should only ever be used
 *  for a single-user swap databases (e.g. to be used on the client-side), because:
 *  - in-memory indexes are used (which can get out of hand for large datasets & don't support multi-process access)
 *  - uses a single write queue, meaning even concurrent writes are always processed sequentially
 */
class MemoryIndexedKeyValueUnifiedStorage {
    constructor(storageBackend, options) {
        this.writeQueue = new promise_queue_ts_1.PromiseQueue();
        this.storageBackend = storageBackend;
        this.options = options ?? {};
        this.options.maxBatchItems ??= 100;
    }
    _get(key) {
        const _existingValueStr = this.storageBackend.get(key);
        if (_existingValueStr instanceof Promise) {
            return _existingValueStr.then(str => str == null ? null : JSON.parse(str));
        }
        else {
            return _existingValueStr == null ? null : JSON.parse(_existingValueStr);
        }
    }
    _getAll(keys) {
        if (this.storageBackend.getAll != null) {
            const result = this.storageBackend.getAll(keys);
            if (result instanceof Promise)
                return result.then(response => response.map(value => value == null ? null : JSON.parse(value)));
            return result.map(value => value == null ? null : JSON.parse(value));
        }
        else {
            //Get one by one
            const promisesOrResult = keys.map(key => this.storageBackend.get(key));
            if (promisesOrResult.length === 0)
                return [];
            if (promisesOrResult[0] instanceof Promise)
                return Promise.all(promisesOrResult)
                    .then(response => response.map(value => value == null ? null : JSON.parse(value)));
            return promisesOrResult.map(value => value == null ? null : JSON.parse(value));
        }
    }
    _set(key, value) {
        return this.storageBackend.set(key, JSON.stringify(value));
    }
    _setAll(values) {
        if (this.storageBackend.setAll != null) {
            return this.storageBackend.setAll(values.map(val => ({ key: val.key, value: JSON.stringify(val.value) })));
        }
        else {
            const rollbackAndThrow = (e) => {
                const promisesOrResult = values.map(val => {
                    if (val.initialValue == null) {
                        return this.storageBackend.remove(val.key);
                    }
                    else {
                        return this.storageBackend.set(val.key, JSON.stringify(val.initialValue));
                    }
                });
                if (promisesOrResult.length > 0 && promisesOrResult[0] instanceof Promise) {
                    return Promise.all(promisesOrResult).then(() => {
                        return Promise.reject(e);
                    });
                }
                else {
                    throw e;
                }
            };
            //Get one by one
            try {
                const promisesOrResult = values.map(val => this.storageBackend.set(val.key, JSON.stringify(val.value)));
                if (promisesOrResult.length === 0)
                    return;
                if (typeof (promisesOrResult[0]) === "undefined")
                    return;
                return Promise.allSettled(promisesOrResult).then((resultArr) => {
                    for (let result of resultArr) {
                        if (result.status === "rejected")
                            return rollbackAndThrow(result.reason);
                    }
                });
            }
            catch (e) {
                //Try to rollback by saving the initial values
                return rollbackAndThrow(e);
            }
        }
    }
    _removeAll(values) {
        if (this.storageBackend.removeAll != null) {
            return this.storageBackend.removeAll(values.map(val => val.key));
        }
        else {
            const rollbackAndThrow = (e) => {
                const promisesOrResult = values.map(val => {
                    if (val.initialValue == null) {
                        return this.storageBackend.remove(val.key);
                    }
                    else {
                        return this.storageBackend.set(val.key, JSON.stringify(val.initialValue));
                    }
                });
                if (promisesOrResult.length > 0 && promisesOrResult[0] instanceof Promise) {
                    return Promise.all(promisesOrResult).then(() => { throw e; });
                }
                else {
                    throw e;
                }
            };
            try {
                //Get one by one
                const promisesOrResult = values.map(val => this.storageBackend.remove(val.key));
                if (promisesOrResult.length === 0)
                    return;
                if (typeof (promisesOrResult[0]) === "undefined")
                    return;
                return Promise.allSettled(promisesOrResult).then((resultArr) => {
                    for (let result of resultArr) {
                        if (result.status === "rejected")
                            return rollbackAndThrow(result.reason);
                    }
                });
            }
            catch (e) {
                return rollbackAndThrow(e);
            }
        }
    }
    async _getAllSequential(keys) {
        const results = [];
        for (let i = 0; i < keys.length; i += this.options.maxBatchItems) {
            let items;
            const _items = this._getAll(keys.slice(i, i + this.options.maxBatchItems));
            if (_items instanceof Promise) {
                items = await _items;
            }
            else {
                items = _items;
            }
            results.push(items.filter(val => val != null));
        }
        return results.flat();
    }
    //Indexes
    _saveIndex(indexMap, indexValue, obj) {
        let indexSet = indexMap.get(indexValue);
        if (indexSet == null)
            indexMap.set(indexValue, indexSet = new Set());
        indexSet.add(obj.id);
    }
    _removeIndex(indexMap, indexValue, obj) {
        const indexOldSet = indexMap.get(indexValue);
        if (indexOldSet != null) {
            indexOldSet.delete(obj.id);
            if (indexOldSet.size === 0)
                indexMap.delete(indexValue);
        }
    }
    _updateIndex(indexMap, indexOldValue, indexNewValue, obj) {
        this._removeIndex(indexMap, indexOldValue, obj);
        this._saveIndex(indexMap, indexNewValue, obj);
    }
    _saveObjectIndexes(obj) {
        for (let index of this.indexes) {
            const indexKey = index.key;
            const indexValue = toIndexValue(obj[indexKey]);
            const indexMap = this.indexesMaps[indexKey] ??= new Map();
            this._saveIndex(indexMap, indexValue, obj);
        }
        for (let compositeIndex of this.compositeIndexes) {
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            const indexMap = this.compositeIndexesMaps[indexKey] ??= new Map();
            this._saveIndex(indexMap, indexValue, obj);
        }
    }
    _removeObjectIndexes(obj) {
        for (let index of this.indexes) {
            const indexKey = index.key;
            const indexValue = toIndexValue(obj[indexKey]);
            const indexMap = this.indexesMaps[indexKey];
            this._removeIndex(indexMap, indexValue, obj);
        }
        for (let compositeIndex of this.compositeIndexes) {
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            const indexMap = this.compositeIndexesMaps[indexKey];
            this._removeIndex(indexMap, indexValue, obj);
        }
    }
    _updateObjectIndexes(obj, existingValue) {
        //Check indexes changed
        for (let index of this.indexes) {
            if (obj[index.key] === existingValue[index.key])
                continue; //Not changed
            const indexKey = index.key;
            const indexMap = this.indexesMaps[indexKey];
            const indexOldValue = toIndexValue(existingValue[indexKey]);
            const indexNewValue = toIndexValue(obj[indexKey]);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }
        //Check indexes changed
        for (let compositeIndex of this.compositeIndexes) {
            const changed = compositeIndex.keys.reduce((previousValue, key) => previousValue || (obj[key] === existingValue[key]), false);
            if (!changed)
                continue; //Not changed
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexMap = this.compositeIndexesMaps[indexKey];
            const indexOldValue = toCompositeIndexValue(compositeIndex.keys, existingValue);
            const indexNewValue = toCompositeIndexValue(compositeIndex.keys, obj);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }
    }
    /**
     * Initializes the storage with given indexes and composite indexes
     * @param indexes
     * @param compositeIndexes
     */
    async init(indexes, compositeIndexes) {
        this.indexes = indexes;
        this.compositeIndexes = compositeIndexes;
        await this.storageBackend.init();
        //Setup indexes
        this.indexesMaps = {};
        indexes.forEach(index => {
            this.indexesMaps[index.key] = new Map();
        });
        this.compositeIndexesMaps = {};
        compositeIndexes.forEach(index => {
            this.indexesMaps[toCompositeIndexIdentifier(index.keys)] = new Map();
        });
        let allKeys;
        const _allKeys = this.storageBackend.getKeys();
        if (Array.isArray(_allKeys)) {
            allKeys = _allKeys;
        }
        else {
            allKeys = await _allKeys;
        }
        for (let i = 0; i < allKeys.length; i += this.options.maxBatchItems) {
            let loadedItems;
            const _loadedItems = this._getAll(allKeys.slice(i, i + this.options.maxBatchItems));
            if (Array.isArray(_loadedItems)) {
                loadedItems = _loadedItems;
            }
            else {
                loadedItems = await _loadedItems;
            }
            //Save indexes
            loadedItems.forEach((obj) => {
                if (obj == null)
                    return;
                this._saveObjectIndexes(obj);
            });
        }
    }
    /**
     * Params are specified in the following way:
     *  - [[condition1, condition2]] - returns all rows where condition1 AND condition2 is met
     *  - [[condition1], [condition2]] - returns all rows where condition1 OR condition2 is met
     *  - [[condition1, condition2], [condition3]] - returns all rows where (condition1 AND condition2) OR condition3 is met
     * @param params
     */
    async query(params) {
        if (params.length === 0)
            return await this.querySingle([]);
        const results = await Promise.all(params.map(singleParam => this.querySingle(singleParam)));
        //Deduplicate
        const knownIds = new Set();
        return results.flat().filter(value => {
            if (knownIds.has(value.id))
                return false;
            knownIds.add(value.id);
            return true;
        });
    }
    async querySingle(params) {
        if (params.length === 0) {
            //Get all
            let keys;
            const _keys = this.storageBackend.getKeys();
            if (_keys instanceof Promise) {
                keys = await _keys;
            }
            else {
                keys = _keys;
            }
            return await this._getAllSequential(keys);
        }
        const queryKeys = params.map(param => param.key);
        if (params.length === 1) {
            //Simple indexes
            const requiredIndex = params[0].key;
            if (requiredIndex === "id") {
                //ID is the index
                const keys = Array.isArray(params[0].value) ? params[0].value : [params[0].value];
                return await this._getAllSequential(keys);
            }
            else {
                const indexMap = this.indexesMaps[requiredIndex];
                if (indexMap != null) {
                    const indexValues = Array.isArray(params[0].value) ? params[0].value : [params[0].value];
                    let keys = [];
                    indexValues.forEach(indexValue => {
                        const indexSet = indexMap.get(toIndexValue(indexValue));
                        if (indexSet == null)
                            return;
                        indexSet.forEach(key => keys.push(key));
                    });
                    const result = await this._getAllSequential(keys);
                    //Also run the final matches check on the returned items
                    const setConditions = toSetConditions(params);
                    return result.filter(val => matches(setConditions, val));
                }
            }
        }
        else {
            //Composite indexes
            const requiredIndex = toCompositeIndexIdentifier(queryKeys);
            const indexMap = this.compositeIndexesMaps[requiredIndex];
            if (indexMap != null) {
                const values = params.map(param => Array.isArray(param.value) ? param.value : [param.value]);
                const compositeIndexValues = toCompositeIndex(values);
                let keys = [];
                compositeIndexValues.forEach(indexValues => {
                    const indexSet = indexMap.get(toCompositeIndexValueArr(indexValues));
                    if (indexSet == null)
                        return [];
                    indexSet.forEach(key => keys.push(key));
                });
                const result = await this._getAllSequential(keys);
                //Also run the final matches check on the returned items
                const setConditions = toSetConditions(params);
                return result.filter(val => matches(setConditions, val));
            }
        }
        //Need to go over all values
        logger.warn("query(): Index cannot be used for query, required index: " + queryKeys.join(",") + " query params: ", params);
        if (!this.options.allowQueryWithoutIndexes)
            throw new Error("Disallowed querying without index");
        //Get all
        let keys;
        const _keys = this.storageBackend.getKeys();
        if (_keys instanceof Promise) {
            keys = await _keys;
        }
        else {
            keys = _keys;
        }
        const setConditions = toSetConditions(params);
        const results = [];
        for (let i = 0; i < keys.length; i += this.options.maxBatchItems) {
            let items;
            const _items = this._getAll(keys.slice(i, i + this.options.maxBatchItems));
            if (_items instanceof Promise) {
                items = await _items;
            }
            else {
                items = _items;
            }
            results.push(items.filter(val => val != null && matches(setConditions, val)));
        }
        return results.flat();
    }
    save(value) {
        return this.writeQueue.enqueue(async () => {
            let existingValue;
            const _existingValue = this._get(value.id);
            if (_existingValue instanceof Promise) {
                existingValue = await _existingValue;
            }
            else {
                existingValue = _existingValue;
            }
            const result = this._set(value.id, value);
            if (result instanceof Promise)
                await result;
            if (existingValue != null) {
                //Update indexes
                this._updateObjectIndexes(value, existingValue);
            }
            else {
                //Save new indexes
                this._saveObjectIndexes(value);
            }
        });
    }
    async saveAll(_values) {
        return this.writeQueue.enqueue(async () => {
            for (let e = 0; e < _values.length; e += this.options.maxBatchItems) {
                const values = _values.slice(e, e + this.options.maxBatchItems);
                let existingValues;
                const _existingValues = this._getAll(values.map(val => val.id));
                if (_existingValues instanceof Promise) {
                    existingValues = await _existingValues;
                }
                else {
                    existingValues = _existingValues;
                }
                const result = this._setAll(values.map((val, index) => ({ key: val.id, value: val, initialValue: existingValues[index] })));
                if (result instanceof Promise)
                    await result;
                for (let i = 0; i < existingValues.length; i++) {
                    const existingValue = existingValues[i];
                    const value = values[i];
                    if (existingValue != null) {
                        //Update indexes
                        this._updateObjectIndexes(value, existingValue);
                    }
                    else {
                        //Save new indexes
                        this._saveObjectIndexes(value);
                    }
                }
            }
        });
    }
    // async saveAll(_values: any[]): Promise<void> {
    //     // return this.writeQueue.enqueue(async () => {
    //     for(let e=0; e<_values.length; e+=this.options.maxBatchItems) {
    //         const values = _values.slice(e, e+this.options.maxBatchItems);
    //
    //         let existingValues: (any | null)[];
    //         if(this.storageBackend.async) {
    //             existingValues = await this._getAll(values.map(val => val.id));
    //             await this._setAll(values.map((val, index) => ({key: val.id, value: val, initialValue: existingValues[index]})));
    //         } else {
    //             existingValues = this._getAll(values.map(val => val.id)) as (any | null)[];
    //             this._setAll(values.map((val, index) => ({key: val.id, value: val, initialValue: existingValues[index]})));
    //         }
    //
    //         for(let i=0; i<existingValues.length; i++) {
    //             const existingValue = existingValues[i];
    //             const value = values[i];
    //             if(existingValue!=null) {
    //                 //Update indexes
    //                 this._updateObjectIndexes(value, existingValue);
    //             } else {
    //                 //Save new indexes
    //                 this._saveObjectIndexes(value);
    //             }
    //         }
    //     }
    //     // });
    // }
    remove(value) {
        return this.writeQueue.enqueue(async () => {
            let existingValue;
            const _existingValue = this._get(value.id);
            if (_existingValue instanceof Promise) {
                existingValue = await _existingValue;
            }
            else {
                existingValue = _existingValue;
            }
            const result = this.storageBackend.remove(value.id);
            if (result instanceof Promise)
                await result;
            if (existingValue == null)
                return;
            //Remove indexes
            this._removeObjectIndexes(existingValue);
        });
    }
    removeAll(_values) {
        return this.writeQueue.enqueue(async () => {
            for (let e = 0; e < _values.length; e += this.options.maxBatchItems) {
                const values = _values.slice(e, e + this.options.maxBatchItems);
                const valuesIds = values.map(val => val.id);
                let existingValues;
                const _existingValues = this._getAll(valuesIds);
                if (_existingValues instanceof Promise) {
                    existingValues = await _existingValues;
                }
                else {
                    existingValues = _existingValues;
                }
                const result = this._removeAll(valuesIds.map((id, index) => ({ key: id, initialValue: existingValues[index] })));
                if (result instanceof Promise)
                    await result;
                for (let i = 0; i < existingValues.length; i++) {
                    const existingValue = existingValues[i];
                    if (existingValue == null)
                        continue;
                    this._removeObjectIndexes(existingValue);
                }
            }
        });
    }
}
exports.MemoryIndexedKeyValueUnifiedStorage = MemoryIndexedKeyValueUnifiedStorage;
