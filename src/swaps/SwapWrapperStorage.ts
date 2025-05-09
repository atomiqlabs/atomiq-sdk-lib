import {ISwap} from "./ISwap";
import {IStorageManager} from "@atomiqlabs/base";
import {ISwapWrapper} from "./ISwapWrapper";
import {getLogger, randomBytes} from "../utils/Utils";

const logger = getLogger("SwapWrapperStorage: ");

export class SwapWrapperStorage<T extends ISwap<any>> {

    storage: IStorageManager<T>;

    constructor(storage: IStorageManager<T>) {
        this.storage = storage;
    }

    /**
     * Initializes the underlying storage manager, needs to be called before any other action is taken
     */
    init(): Promise<void> {
        return this.storage.init();
    }

    /**
     * Removes the swap data from the underlying storage manager
     *
     * @param swapData Swap to remove
     */
    async removeSwapData(swapData: T): Promise<boolean> {
        const id = swapData.getIdentifierHashString();
        if(this.storage.data[id]==null) return false;
        await this.storage.removeData(id);
        return true;
    }

    /**
     * Removes an array of swap data from the underlying storage manager
     *
     * @param arr Array of swaps to remove
     */
    async removeSwapDataArr(arr: T[]): Promise<void> {
        if(this.storage.removeDataArr!=null) {
            await this.storage.removeDataArr(arr.map(swap => swap.getIdentifierHashString()));
            return;
        }

        for(let swapData of arr) {
            const id = swapData.getIdentifierHashString();
            await this.storage.removeData(id);
        }
    }

    /**
     * Saves the swap to the underlying storage manager
     *
     * @param swapData Swap to save
     */
    saveSwapData(swapData: T): Promise<void> {
        const id = swapData.getIdentifierHashString();
        return this.storage.saveData(id, swapData);
    }

    /**
     * Saves an array of swaps to the underlying storage manager
     *
     * @param arr Array of swaps to save
     */
    async saveSwapDataArr(arr: T[]): Promise<void> {
        if(this.storage.saveDataArr!=null) {
            await this.storage.saveDataArr(arr.map(swap => {
                return {id: swap.getIdentifierHashString(), object: swap}
            }));
            return;
        }

        for(let swapData of arr) {
            const id = swapData.getIdentifierHashString();
            await this.storage.saveData(id, swapData);
        }
    }

    /**
     * Loads all the swaps from the underlying storage manager
     *
     * @param wrapper Swap wrapper
     * @param type Constructor for the swap
     */
    async loadSwapData(
        wrapper: ISwapWrapper<any, T>,
        type: new(wrapper: ISwapWrapper<any, T>, data: any) => T
    ): Promise<Map<string, T>> {
        const res = await this.storage.loadData(type.bind(null, wrapper));

        for(let value of res) {
            if(value.randomNonce==null) {
                const oldIdentifierHash = value.getIdentifierHashString();
                //Workaround for old Solana swaps - take the first 32 bytes of the claim hash which should stay the same
                // for both old and new version of the libs
                await this.storage.removeData(oldIdentifierHash.slice(0, 64));
                value.randomNonce = randomBytes(16).toString("hex");
                const newIdentifierHash = value.getIdentifierHashString();
                await this.saveSwapData(value);
                logger.info("init(): Found older swap version without randomNonce, replacing, old hash: "+oldIdentifierHash+
                    " new hash: "+newIdentifierHash);
            }
        }

        return new Map<string, T>(res.map(value => [value.getIdentifierHashString(), value]));
    }

}