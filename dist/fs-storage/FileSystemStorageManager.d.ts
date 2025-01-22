import { StorageObject, IStorageManager } from "@atomiqlabs/base";
import { LoggerType } from "../utils/Utils";
/**
 * StorageManager using local filesystem to persists data, creates a new file for every save object
 */
export declare class FileSystemStorageManager<T extends StorageObject> implements IStorageManager<T> {
    protected readonly logger: LoggerType;
    private readonly directory;
    data: {
        [key: string]: T;
    };
    constructor(directory: string);
    init(): Promise<void>;
    saveData(hash: string, object: T): Promise<void>;
    removeData(hash: string): Promise<void>;
    loadData(type: new (data: any) => T): Promise<T[]>;
}
