import { ISwap } from "./ISwap";
import { IStorageManager } from "@atomiqlabs/base";
import { ISwapWrapper } from "./ISwapWrapper";
export declare class SwapWrapperStorage<T extends ISwap<any>> {
    storage: IStorageManager<T>;
    constructor(storage: IStorageManager<T>);
    /**
     * Initializes the underlying storage manager, needs to be called before any other action is taken
     */
    init(): Promise<void>;
    /**
     * Removes the swap data from the underlying storage manager
     *
     * @param swapData Swap to remove
     */
    removeSwapData(swapData: T): Promise<boolean>;
    /**
     * Removes an array of swap data from the underlying storage manager
     *
     * @param arr Array of swaps to remove
     */
    removeSwapDataArr(arr: T[]): Promise<void>;
    /**
     * Saves the swap to the underlying storage manager
     *
     * @param swapData Swap to save
     */
    saveSwapData(swapData: T): Promise<void>;
    /**
     * Saves an array of swaps to the underlying storage manager
     *
     * @param arr Array of swaps to save
     */
    saveSwapDataArr(arr: T[]): Promise<void>;
    /**
     * Loads all the swaps from the underlying storage manager
     *
     * @param wrapper Swap wrapper
     * @param type Constructor for the swap
     */
    loadSwapData(wrapper: ISwapWrapper<any, T>, type: new (wrapper: ISwapWrapper<any, T>, data: any) => T): Promise<Map<string, T>>;
}
