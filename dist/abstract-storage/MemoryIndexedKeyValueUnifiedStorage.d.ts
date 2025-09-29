import { IUnifiedStorage, QueryParams, UnifiedStorageCompositeIndexes, UnifiedStoredObject } from "../storage/IUnifiedStorage";
import { UnifiedSwapStorageIndexes } from "../storage/UnifiedSwapStorage";
import { PromiseQueue } from "promise-queue-ts";
export interface KeyValueStorage<Async extends boolean> {
    async: Async;
    init(): Promise<void>;
    get(key: string): Async extends true ? Promise<string> : string;
    set(key: string, value: string): Async extends true ? Promise<void> : void;
    remove(key: string): Async extends true ? Promise<void> : void;
    getKeys(): Async extends true ? Promise<string[]> : string[];
    getAll?(keys: string[]): Async extends true ? Promise<(string | null)[]> : (string | null)[];
    setAll?(values: {
        key: string;
        value: string;
    }[]): Async extends true ? Promise<void> : void;
    removeAll?(keys: string[]): Async extends true ? Promise<void> : void;
}
type MemoryIndexedKeyValueUnifiedStorageOptions = {
    maxBatchItems?: number;
    allowQueryWithoutIndexes?: boolean;
};
/**
 * Unified storage wrapper that can be used on top of a simple key-value storage, this should only ever be used
 *  for a single-user swap databases (e.g. to be used on the client-side), because:
 *  - in-memory indexes are used (which can get out of hand for large datasets & don't support multi-process access)
 *  - uses a single write queue, meaning even concurrent writes are always processed sequentially
 */
export declare class MemoryIndexedKeyValueUnifiedStorage implements IUnifiedStorage<UnifiedSwapStorageIndexes, UnifiedStorageCompositeIndexes> {
    storageBackend: KeyValueStorage<boolean>;
    indexes: UnifiedSwapStorageIndexes;
    compositeIndexes: UnifiedStorageCompositeIndexes;
    options: MemoryIndexedKeyValueUnifiedStorageOptions;
    indexesMaps: {
        [indexField: string]: Map<any, Set<string>>;
    };
    compositeIndexesMaps: {
        [compositeIndexIdentifier: string]: Map<string, Set<string>>;
    };
    writeQueue: PromiseQueue;
    constructor(storageBackend: KeyValueStorage<boolean>, options?: MemoryIndexedKeyValueUnifiedStorageOptions);
    protected _get(key: string): Promise<any | null> | (any | null);
    protected _getAll(keys: string[]): Promise<(any | null)[]> | (any | null)[];
    protected _set(key: string, value: any): Promise<void> | void;
    protected _setAll(values: {
        key: string;
        value: any;
        initialValue: any;
    }[]): Promise<void> | void;
    protected _removeAll(values: {
        key: string;
        initialValue: any;
    }[]): Promise<void> | void;
    protected _getAllSequential(keys: string[]): Promise<any[]>;
    protected _saveIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any): void;
    protected _removeIndex(indexMap: Map<any, Set<string>>, indexValue: any, obj: any): void;
    protected _updateIndex(indexMap: Map<any, Set<string>>, indexOldValue: any, indexNewValue: any, obj: any): void;
    protected _saveObjectIndexes(obj: any): void;
    protected _removeObjectIndexes(obj: any): void;
    protected _updateObjectIndexes(obj: any, existingValue: any): void;
    /**
     * Initializes the storage with given indexes and composite indexes
     * @param indexes
     * @param compositeIndexes
     */
    init(indexes: UnifiedSwapStorageIndexes, compositeIndexes: UnifiedStorageCompositeIndexes): Promise<void>;
    /**
     * Params are specified in the following way:
     *  - [[condition1, condition2]] - returns all rows where condition1 AND condition2 is met
     *  - [[condition1], [condition2]] - returns all rows where condition1 OR condition2 is met
     *  - [[condition1, condition2], [condition3]] - returns all rows where (condition1 AND condition2) OR condition3 is met
     * @param params
     */
    query(params: Array<Array<QueryParams>>): Promise<any[]>;
    querySingle(params: Array<QueryParams>): Promise<Array<UnifiedStoredObject>>;
    save(value: any): Promise<void>;
    saveAll(_values: any[]): Promise<void>;
    remove(value: any): Promise<void>;
    removeAll(_values: any[]): Promise<void>;
}
export {};
