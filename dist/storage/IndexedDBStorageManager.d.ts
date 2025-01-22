import { IStorageManager, StorageObject } from "@atomiqlabs/base";
import { LoggerType } from "../utils/Utils";
/**
 * StorageManager using browser's IndexedDB storage, also migrates the data from prior LocalStorage API, if that was
 *  used before for a given "storageKey"
 */
export declare class IndexedDBStorageManager<T extends StorageObject> implements IStorageManager<T> {
    protected readonly logger: LoggerType;
    storageKey: string;
    db: IDBDatabase;
    data: {
        [p: string]: T;
    };
    constructor(storageKey: string);
    private executeTransaction;
    private executeTransactionArr;
    /**
     * Tries to migrate old LocalStorage API stored objects (if they exist) to the IndexedDB
     *
     * @private
     */
    private tryMigrate;
    init(): Promise<void>;
    loadData(type: {
        new (data: any): T;
    }): Promise<T[]>;
    removeData(hash: string): Promise<void>;
    removeDataArr(arr: string[]): Promise<void>;
    saveData(hash: string, object: T): Promise<void>;
    saveDataArr(arr: {
        id: string;
        object: T;
    }[]): Promise<void>;
}
