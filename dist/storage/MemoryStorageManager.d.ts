import { IStorageManager, StorageObject } from "@atomiqlabs/base";
/**
 * StorageManager storing the data in memory, the data is lost after page refresh
 */
export declare class MemoryStorageManager<T extends StorageObject> implements IStorageManager<T> {
    data: {
        [p: string]: T;
    };
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
