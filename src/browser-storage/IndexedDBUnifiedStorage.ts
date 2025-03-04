import {getLogger, LoggerType} from "../utils/Utils";
import {IUnifiedStorage, QueryParams, UnifiedStoredObject} from "../storage/IUnifiedStorage";

export type QuerySetCondition = {
    key: string,
    values: Set<any>
}

function toCompositeIndex(values: Array<any[]>): Array<any[]> {
    if(values.length===0) return [];
    if(values.length===1) {
        return values[0];
    } else {
        const compositeArray = [];
        const firstValues = values.shift();
        const restValues = toCompositeIndex(values);
        for(let value of firstValues) {
            for(let restValue of restValues) {
                compositeArray.push([value].concat(restValue));
            }
        }
        return compositeArray;
    }
}

function matches(conditions: Array<QuerySetCondition>, obj: any): boolean {
    for(let condition of conditions) {
        let value = obj[condition.key];
        if(!condition.values.has(value)) return false;
    }
    return true;
}

function toSetConditions(input: Array<QueryParams>): Array<QuerySetCondition>  {
    return input.map(val => {
        return {
            key: val.key,
            values: Array.isArray(val.value) ? new Set(val.value) : new Set([val.value])
        };
    })
}

const indexes = {
    "escrowHash": { key: "escrowHash", unique: true},
    "type": {key: "type", unique: false},
    "initiator": {key: "initiator", unique: false},
    "initiator, id": {key: ["initiator", "id"], unique: false},
    "type, state": {key: ["type", "state"], unique: false},
    "type, paymentHash": {key: ["type", "paymentHash"], unique: false},
    "type, initiator, state": {key: ["type", "initiator", "state"], unique: false}
}

export class IndexedDBUnifiedStorage implements IUnifiedStorage {

    protected readonly logger: LoggerType;

    storageKey: string;
    db: IDBDatabase;

    constructor(storageKey: string) {
        this.storageKey = storageKey;
        this.logger = getLogger("IndexedDBUnifiedStorage("+this.storageKey+"): ");
    }

    private executeTransaction<T>(cbk: (tx: IDBObjectStore) => IDBRequest<T>, readonly: boolean): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const tx = this.db.transaction("swaps", readonly ? "readonly" : "readwrite", {durability: "strict"});
            const req = cbk(tx.objectStore("swaps"));
            req.onsuccess = (event: any) => resolve(event.target.result);
            req.onerror = (event) => reject(event);
        });
    }

    private executeTransactionArr<T>(cbk: (tx: IDBObjectStore) => IDBRequest<T>[], readonly: boolean): Promise<T[]> {
        const tx = this.db.transaction("swaps", readonly ? "readonly" : "readwrite", {durability: "strict"});
        const reqs = cbk(tx.objectStore("swaps"));
        return Promise.all(reqs.map(req => new Promise<T>((resolve, reject) => {
            req.onsuccess = (event: any) => resolve(event.target.result);
            req.onerror = (event) => reject(event);
        })));
    }

    private executeTransactionWithCursor<T>(cbk: (tx: IDBObjectStore) => IDBRequest<IDBCursorWithValue>[], valueCbk: (value: T) => boolean): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            const tx = this.db.transaction("swaps", "readonly", {durability: "strict"});
            const cursorRequests = cbk(tx.objectStore("swaps"));
            const resultObjects: T[] = [];
            for(let cursorRequest of cursorRequests) {
                cursorRequest.onsuccess = (event: any) => {
                    const cursor = event.target.result;
                    if(cursor!=null) {
                        const value = cursor.value;
                        if(valueCbk(value)) resultObjects.push(value);
                        cursor.continue();
                    } else {
                        resolve(resultObjects);
                    }
                }
                cursorRequest.onerror = (event) => reject(event);
            }
        });
    }

    async init(): Promise<void> {
        if(this.db==null) {
            this.db = await new Promise<IDBDatabase>((resolve, reject) => {
                const request = window.indexedDB.open(this.storageKey, 1);
                request.onupgradeneeded = (event: any) => {
                    const db: IDBDatabase = event.target.result;
                    const objectStore = db.createObjectStore("swaps", { keyPath: "id" });

                    Object.keys(indexes).forEach(name => {
                        const index = indexes[name];
                        objectStore.createIndex(name, index.key, {unique: index.unique});
                    })
                };
                request.onerror = (e) => reject(e);
                request.onsuccess = (e: any) => resolve(e.target.result);
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
    async query(params: Array<Array<QueryParams>>): Promise<Array<UnifiedStoredObject>> {
        if(params.length===0) return await this.querySingle([]);
        const results = await Promise.all(params.map(singleParam => this.querySingle(singleParam)));
        const resultSet = new Set(results.flat()); //Deduplicate
        return Array.from(resultSet);
    }

    async querySingle(params: Array<QueryParams>): Promise<Array<UnifiedStoredObject>> {
        if(params.length===0) {
            return await this.executeTransaction((objectStore) => objectStore.getAll(), true);
        }

        const queryKeys = params.map(param => param.key);
        const requiredIndex = queryKeys.join(", ");

        if(requiredIndex==="id") {
            //ID is the index
            const values: any[] = Array.isArray(params[0].value) ? params[0].value : [params[0].value];
            const res = await this.executeTransactionArr((objectStore) => {
                return values.map(val => objectStore.getAll(val));
            }, true);
            return res.flat();
        } else if(indexes[requiredIndex]!=null) {
            //Index exists
            const values: Array<any[]> = params.map(param => Array.isArray(param.value) ? param.value : [param.value]);
            const compositeIndexQueries = toCompositeIndex(values);

            const resp = await this.executeTransactionArr(objectStore => {
                const index = objectStore.index(requiredIndex);
                return compositeIndexQueries.map(indexQuery => index.getAll(indexQuery));
            }, true);

            return resp.flat();
        } else {
            //Need to go over all values
            this.logger.warn("query(): Index cannot be used for query, required index: "+requiredIndex+" query params: ", params);

            const setConditions = toSetConditions(params);
            return await this.executeTransactionWithCursor(objectStore => [objectStore.openCursor()], (val: any) => matches(setConditions, val));
        }
    }

    async remove(object: UnifiedStoredObject): Promise<void> {
        await this.executeTransaction<undefined>(store => store.delete(object.id), false)
            .catch(() => null);
    }

    async removeAll(arr: UnifiedStoredObject[]): Promise<void> {
        if(arr.length===0) return;
        await this.executeTransactionArr<IDBValidKey>(store => arr.map(object => {
            return store.delete(object.id);
        }), false);
    }

    async save(object: UnifiedStoredObject): Promise<void> {
        await this.executeTransaction<IDBValidKey>(store => store.put(object), false);
    }

    async saveAll(arr: UnifiedStoredObject[]): Promise<void> {
        if(arr.length===0) return;
        await this.executeTransactionArr<IDBValidKey>(store => arr.map(object => {
            return store.put(object);
        }), false);
    }

}