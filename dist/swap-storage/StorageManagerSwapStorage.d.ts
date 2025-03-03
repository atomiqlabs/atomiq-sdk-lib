import { ChainType, IStorageManager } from "@atomiqlabs/base";
import { SwapType } from "../swaps/SwapType";
import { ISwap } from "../swaps/ISwap";
import { ISwapWrapper } from "../swaps/ISwapWrapper";
import { ISwapStorage, QueryParams } from "./ISwapStorage";
export type QuerySetCondition = {
    key: string;
    values: Set<any>;
};
export declare class SwapWrapperStorage<T extends ChainType> implements ISwapStorage<ISwap<T>> {
    readonly storageManagers: {
        [key in SwapType]?: IStorageManager<ISwap<T>>;
    };
    readonly wrappers: {
        [key in SwapType]: ISwapWrapper<T, ISwap<T>>;
    };
    readonly swapData: {
        [key in SwapType]?: Map<string, ISwap<T>>;
    };
    readonly swapDataByEscrowHash: Map<string, ISwap<T>>;
    constructor(storage: (swapType: SwapType) => IStorageManager<ISwap<T>>, wrappers: {
        [key in SwapType]: ISwapWrapper<T, ISwap<T>>;
    });
    /**
     * Initializes the underlying storage manager, needs to be called before any other action is taken
     */
    init(): Promise<void>;
    /**
     * Params are specified in the following way:
     *  - [condition1, condition2] - returns all rows where condition1 AND condition2 is met
     * @param params
     * @param reviver
     */
    query<S extends ISwap<T>>(params: Array<QueryParams>, reviver: (obj: any) => S): Promise<Array<S>>;
    save<S extends ISwap<T>>(swapData: S): Promise<void>;
    saveAll<S extends ISwap<T>>(values: S[]): Promise<void>;
    remove<S extends ISwap<T>>(swapData: S): Promise<void>;
    removeAll<S extends ISwap<T>>(values: S[]): Promise<void>;
}
