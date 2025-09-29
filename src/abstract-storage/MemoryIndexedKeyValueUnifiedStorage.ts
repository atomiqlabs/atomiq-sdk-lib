import {IUnifiedStorage, QueryParams, UnifiedStorageCompositeIndexes} from "../storage/IUnifiedStorage";
import {UnifiedSwapStorageIndexes} from "../storage/UnifiedSwapStorage";


export interface KeyValueStorage {

    init(): Promise<void>;

    get(key: string): Promise<string> | string;

    set(key: string, value: string): Promise<void> | void;

    remove(key: string): Promise<void> | void;

    getKeys(): Promise<string[]> | string[];

    getAll?(keys: string[]): Promise<(string | null)[]> | (string | null)[];

    setAll?(values: { key: string, value: string }[]): Promise<void> | void;

    removeAll?(keys: string[]): Promise<void> | void;

}

type MemoryIndexedKeyValueUnifiedStorageOptions = {
    maxBatchItems?: number;
};

function toCompositeIndexIdentifier(keys: readonly string[]) {
    return keys.join(",");
}

function toCompositeIndexValue(keys: readonly string[], obj: any): string {
    return keys
        .map(key => toIndexValueString(obj[key]))
        .join(",");
}

function toIndexValueString(value: any): string {
    if(value==null) return "NULL";
    return value.toString(10);
}

function toIndexValue(value: any): any {
    return value==null ? null : value;
}

export class MemoryIndexedKeyValueUnifiedStorage implements IUnifiedStorage<UnifiedSwapStorageIndexes, UnifiedStorageCompositeIndexes> {

    storageBackend: KeyValueStorage;
    indexes: UnifiedSwapStorageIndexes;
    compositeIndexes: UnifiedStorageCompositeIndexes;

    options: MemoryIndexedKeyValueUnifiedStorageOptions;
    indexesMaps: {[indexField: string]: Map<any, Set<string>>};
    compositeIndexesMaps: {[compositeIndexIdentifier: string]: Map<string, Set<string>>};

    constructor(storageBackend: KeyValueStorage, options?: MemoryIndexedKeyValueUnifiedStorageOptions) {
        this.storageBackend = storageBackend;
        this.options = options ?? {};
        this.options.maxBatchItems ??= 100;
    }

    protected _get(key: string): Promise<any | null> | (any | null) {

    }

    protected _getAll(keys: string[]): Promise<(string | null)[]> | (string | null)[] {
        if(this.storageBackend.getAll!=null) {
            return this.storageBackend.getAll(keys);
        } else {
            //Get one by one
            const promisesOrResult = keys.map(key => this.storageBackend.get(key));
            if(promisesOrResult.length===0) return [];
            if(typeof(promisesOrResult[0])==="string") return promisesOrResult as (string | null)[];
            return Promise.all(promisesOrResult as Promise<string | null>[]);
        }
    }

    protected _set(key: string, value: any): Promise<void> | void {

    }

    protected _setAll(values: { key: string, value: any }[]): Promise<void> | void {
        if(this.storageBackend.setAll!=null) {
            return this.storageBackend.setAll(values.map(val => ({key: val.key, value: JSON.stringify(val.value)})));
        } else {
            //Get one by one
            const promisesOrResult = values.map(val => this.storageBackend.set(val.key, JSON.stringify(val.value)));
            if(promisesOrResult.length===0) return;
            if(typeof(promisesOrResult[0])==="undefined") return;
            return Promise.all(promisesOrResult as Promise<void>[]).then(() => {});
        }
    }

    protected _removeAll(keys: string[]): Promise<void> | void {
        if(this.storageBackend.removeAll!=null) {
            return this.storageBackend.removeAll(keys);
        } else {
            //Get one by one
            const promisesOrResult = keys.map(key => this.storageBackend.remove(key));
            if(promisesOrResult.length===0) return;
            if(typeof(promisesOrResult[0])==="undefined") return;
            return Promise.all(promisesOrResult as Promise<void>[]).then(() => {});
        }
    }

    protected _saveIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any) {
        let indexSet = indexMap.get(indexValue);
        if(indexSet==null) indexMap.set(indexValue, indexSet = new Set());
        indexSet.add(obj.id);
    }

    protected _removeIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any) {
        const indexOldSet = indexMap.get(indexValue);
        if(indexOldSet!=null) indexOldSet.delete(obj.id);
    }

    protected _updateIndex(indexMap: Map<any, Set<string>>, indexOldValue: any, indexNewValue: any, obj: any) {
        this._removeIndex(indexMap, indexOldValue, obj);
        this._saveIndex(indexMap, indexNewValue, obj);
    }

    protected _saveObjectIndexes(obj: any) {
        for(let index of this.indexes) {
            const indexKey = index.key;
            const indexValue = toIndexValue(obj[indexKey]);
            const indexMap = this.indexesMaps[indexKey] ??= new Map<any, Set<string>>();
            this._saveIndex(indexMap, indexValue, obj);
        }

        for(let compositeIndex of this.compositeIndexes) {
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            const indexMap = this.compositeIndexesMaps[indexKey] ??= new Map<string, Set<string>>();
            this._saveIndex(indexMap, indexValue, obj);
        }
    }

    protected _removeObjectIndexes(obj: any) {
        for(let index of this.indexes) {
            const indexKey = index.key;
            const indexValue = toIndexValue(obj[indexKey]);
            const indexMap = this.indexesMaps[indexKey] ??= new Map<any, Set<string>>();
            this._removeIndex(indexMap, indexValue, obj);
        }

        for(let compositeIndex of this.compositeIndexes) {
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexValue = toCompositeIndexValue(compositeIndex.keys, obj);
            const indexMap = this.compositeIndexesMaps[indexKey] ??= new Map<string, Set<string>>();
            this._removeIndex(indexMap, indexValue, obj);
        }
    }

    protected _updateObjectIndexes(obj: any, existingValue: any) {
        //Check indexes changed
        for(let index of this.indexes) {
            if(obj[index.key]===existingValue[index.key]) continue; //Not changed
            const indexKey = index.key;
            const indexMap = this.indexesMaps[indexKey] ??= new Map<any, Set<string>>();
            const indexOldValue = toIndexValue(existingValue[indexKey]);
            const indexNewValue = toIndexValue(obj[indexKey]);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }

        //Check indexes changed
        for(let compositeIndex of this.compositeIndexes) {
            const changed = compositeIndex.keys.reduce((previousValue, key) => previousValue || (obj[key]===existingValue[key]), false)
            if(!changed) continue; //Not changed
            const indexKey = toCompositeIndexIdentifier(compositeIndex.keys);
            const indexMap = this.compositeIndexesMaps[indexKey] ??= new Map<string, Set<string>>();
            const indexOldValue = toCompositeIndexValue(compositeIndex.keys, existingValue);
            const indexNewValue = toCompositeIndexValue(compositeIndex.keys, obj);
            this._updateIndex(indexMap, indexOldValue, indexNewValue, obj);
        }
    }

    async init(indexes: UnifiedSwapStorageIndexes, compositeIndexes: UnifiedStorageCompositeIndexes): Promise<void> {
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

        let allKeys: string[];
        const _allKeys = this.storageBackend.getKeys();
        if(Array.isArray(_allKeys)) {
            allKeys = _allKeys;
        } else {
            allKeys = await _allKeys;
        }

        for(let i=0; i<allKeys.length; i+=this.options.maxBatchItems) {
            let loadedItems: (string | null)[];
            const _loadedItems = this._getAll(allKeys.slice(i, i+this.options.maxBatchItems));
            if(Array.isArray(_loadedItems)) {
                loadedItems = _loadedItems;
            } else {
                loadedItems = await _loadedItems;
            }

            //Save indexes
            loadedItems.forEach((item: string | null) => {
                if(item==null) return;
                const obj = JSON.parse(item);
                this._saveObjectIndexes(obj);
            });
        }
    }

    query(params: QueryParams[][]): Promise<any[]> {
        throw new Error("Method not implemented.");
    }

    async save(value: any): Promise<void> {
        let existingValueStr: string;
        const _existingValueStr = this.storageBackend.get(value.id);
        if(typeof(_existingValueStr)==="string") {
            existingValueStr = _existingValueStr;
        } else {
            existingValueStr = await _existingValueStr;
        }

        const result = this.storageBackend.set(value.id, value);
        if(result!==undefined) await result;

        const existingValue = existingValueStr==null ? null : JSON.parse(existingValueStr);
        if(existingValue!=null) {
            //Update indexes
            this._updateObjectIndexes(value, existingValue);
        } else {
            //Save new indexes
            this._saveObjectIndexes(value);
        }
    }

    async saveAll(_values: any[]): Promise<void> {
        for(let e=0; e<_values.length; e+=this.options.maxBatchItems) {
            const values = _values.slice(e, e+this.options.maxBatchItems);

            let existingValuesStr: (string | null)[];
            const _existingValuesStr = this._getAll(values.map(val => val.id));
            if(typeof(_existingValuesStr)==="string") {
                existingValuesStr = _existingValuesStr;
            } else {
                existingValuesStr = await _existingValuesStr;
            }

            const result = this._setAll(values.map(val => ({key: val.id, value: val})));
            if(result!==undefined) await result;

            for(let i=0; i<existingValuesStr.length; i++) {
                const existingValueStr = existingValuesStr[i];
                const value = values[i];
                const existingValue = existingValueStr==null ? null : JSON.parse(existingValueStr);
                if(existingValue!=null) {
                    //Update indexes
                    this._updateObjectIndexes(value, existingValue);
                } else {
                    //Save new indexes
                    this._saveObjectIndexes(value);
                }
            }
        }
    }

    async remove(value: any): Promise<void> {
        let existingValueStr: string;
        const _existingValueStr = this.storageBackend.get(value.id);
        if(typeof(_existingValueStr)==="string") {
            existingValueStr = _existingValueStr;
        } else {
            existingValueStr = await _existingValueStr;
        }

        const result = this.storageBackend.remove(value.id);
        if(result!==undefined) await result;

        const existingValue = existingValueStr==null ? null : JSON.parse(existingValueStr);
        if(existingValue==null) return;

        //Remove indexes
        this._removeObjectIndexes(existingValue);
    }

    async removeAll(_values: any[]): Promise<void> {
        for(let e=0; e<_values.length; e+=this.options.maxBatchItems) {
            const values = _values.slice(e, e+this.options.maxBatchItems);
            const valuesIds: string[] = values.map(val => val.id);

            let existingValuesStr: (string | null)[];
            const _existingValuesStr = this._getAll(valuesIds);
            if(typeof(_existingValuesStr)==="string") {
                existingValuesStr = _existingValuesStr;
            } else {
                existingValuesStr = await _existingValuesStr;
            }

            const result = this._removeAll(valuesIds);
            if(result!==undefined) await result;

            for(let i=0; i<existingValuesStr.length; i++) {
                const existingValueStr = existingValuesStr[i];
                const existingValue = existingValueStr==null ? null : JSON.parse(existingValueStr);
                if(existingValue==null) continue;
                this._removeObjectIndexes(existingValue);
            }
        }
    }

}

