import { StorageObject } from "@atomiqlabs/base";
export type QueryParams = {
    key: string;
    value: any | any[];
};
export interface ISwapStorage<R extends StorageObject> {
    init(): Promise<void>;
    /**
     * Params are specified in the following way:
     *  - [condition1, condition2] - returns all rows where condition1 AND condition2 is met
     * @param params
     * @param reviver
     */
    query<T extends R>(params: Array<QueryParams>, reviver: (obj: any) => T): Promise<Array<T>>;
    save<T extends R>(value: T): Promise<void>;
    saveAll<T extends R>(value: T[]): Promise<void>;
    remove<T extends R>(value: T): Promise<void>;
    removeAll<T extends R>(value: T[]): Promise<void>;
}
