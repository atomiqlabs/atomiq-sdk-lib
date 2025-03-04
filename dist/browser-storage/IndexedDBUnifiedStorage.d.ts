import { LoggerType } from "../utils/Utils";
import { IUnifiedStorage, QueryParams, UnifiedStoredObject } from "../storage/IUnifiedStorage";
export type QuerySetCondition = {
    key: string;
    values: Set<any>;
};
export declare class IndexedDBUnifiedStorage implements IUnifiedStorage {
    protected readonly logger: LoggerType;
    storageKey: string;
    db: IDBDatabase;
    constructor(storageKey: string);
    private executeTransaction;
    private executeTransactionArr;
    private executeTransactionWithCursor;
    init(): Promise<void>;
    /**
     * Params are specified in the following way:
     *  - [[condition1, condition2]] - returns all rows where condition1 AND condition2 is met
     *  - [[condition1], [condition2]] - returns all rows where condition1 OR condition2 is met
     *  - [[condition1, condition2], [condition3]] - returns all rows where (condition1 AND condition2) OR condition3 is met
     * @param params
     */
    query(params: Array<Array<QueryParams>>): Promise<Array<UnifiedStoredObject>>;
    querySingle(params: Array<QueryParams>): Promise<Array<UnifiedStoredObject>>;
    remove(object: UnifiedStoredObject): Promise<void>;
    removeAll(arr: UnifiedStoredObject[]): Promise<void>;
    save(object: UnifiedStoredObject): Promise<void>;
    saveAll(arr: UnifiedStoredObject[]): Promise<void>;
}
