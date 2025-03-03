import { ChainType } from "@atomiqlabs/base";
import { IUnifiedStorage } from "../storage/IUnifiedStorage";
import { ISwap } from "../swaps/ISwap";
export type QueryParams = {
    key: string;
    value: any | any[];
};
export declare class UnifiedSwapStorage<T extends ChainType> {
    readonly storage: IUnifiedStorage;
    readonly weakRefCache: Map<string, WeakRef<ISwap<T>>>;
    constructor(storage: IUnifiedStorage);
    init(): Promise<void>;
    /**
     * Params are specified in the following way:
     *  - [condition1, condition2] - returns all rows where condition1 AND condition2 is met
     * @param params
     * @param reviver
     */
    query<S extends ISwap<T>>(params: Array<QueryParams>, reviver: (obj: any) => S): Promise<Array<S>>;
    save<S extends ISwap<T>>(value: S): Promise<void>;
    saveAll<S extends ISwap<T>>(value: S[]): Promise<void>;
    remove<S extends ISwap<T>>(value: S): Promise<void>;
    removeAll<S extends ISwap<T>>(value: S[]): Promise<void>;
}
