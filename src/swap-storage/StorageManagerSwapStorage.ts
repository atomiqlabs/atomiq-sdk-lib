import {ChainType, IStorageManager} from "@atomiqlabs/base";
import {getLogger} from "../utils/Utils";
import {SwapType} from "../swaps/SwapType";
import {ISwap} from "../swaps/ISwap";
import {ISwapWrapper} from "../swaps/ISwapWrapper";
import {ISwapStorage, QueryParams} from "./ISwapStorage";

const logger = getLogger("SwapWrapperStorage: ");

export type QuerySetCondition = {
    key: string,
    values: Set<any>
}

function matches(conditions: Array<QuerySetCondition>, swap: ISwap): boolean {
    for(let condition of conditions) {
        let value: any = swap[condition.key];
        if(condition.key==="initiator") value = swap.getInitiator();
        if(condition.key==="escrowHash") value = swap.getEscrowHash();
        if(condition.key==="identifier") value = swap.getIdentifierHashString();
        if(condition.key==="type") value = swap.getType();

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

export class SwapWrapperStorage<T extends ChainType> implements ISwapStorage<ISwap<T>>{

    readonly storageManagers: {
        [key in SwapType]?: IStorageManager<ISwap<T>>
    } = {};
    readonly wrappers: {[key in SwapType]: ISwapWrapper<T, ISwap<T>>};
    readonly swapData: {
        [key in SwapType]?: Map<string, ISwap<T>>
    } = {};
    readonly swapDataByEscrowHash: Map<string, ISwap<T>>;

    constructor(
        storage: (swapType: SwapType) => IStorageManager<ISwap<T>>,
        wrappers: {[key in SwapType]: ISwapWrapper<T, ISwap<T>>}
    ) {
        this.wrappers = wrappers;
        const arr = [
            SwapType.FROM_BTCLN,
            SwapType.FROM_BTC,
            SwapType.TRUSTED_FROM_BTC,
            SwapType.TRUSTED_FROM_BTCLN,
            SwapType.TO_BTC,
            SwapType.TO_BTCLN
        ];
        for(let key of arr) {
            this.storageManagers[key] = storage(key);
        }
    }

    /**
     * Initializes the underlying storage manager, needs to be called before any other action is taken
     */
    async init(): Promise<void> {
        await Promise.all(Object.keys(this.storageManagers).map(async (key) => {
            const storage: IStorageManager<ISwap<T>> = this.storageManagers[key];
            const wrapper: ISwapWrapper<T, ISwap<T>> = this.wrappers[key];
            await storage.init();
            const res= await storage.loadData(wrapper.swapDeserializer.bind(null, wrapper));
            this.swapData[key] = new Map<string, ISwap<T>>(res.map(value => [value.getIdentifierHashString(), value]));
        }));
    }

    /**
     * Params are specified in the following way:
     *  - [condition1, condition2] - returns all rows where condition1 AND condition2 is met
     * @param params
     * @param reviver
     */
    query<S extends ISwap<T>>(params: Array<QueryParams>, reviver: (obj: any) => S): Promise<Array<S>> {
        const escrowHashConditionIndex = params.findIndex(obj => obj.key==="escrowHash");
        if(escrowHashConditionIndex!==-1) {
            const setConditions = toSetConditions(params);
            const escrowHashCondition = setConditions[escrowHashConditionIndex];
            setConditions.splice(escrowHashConditionIndex, 1);

            const resultSwaps: S[] = [];

            for(let escrowHash of escrowHashCondition.values.values()) {
                const swap = this.swapDataByEscrowHash.get(escrowHash);
                if(matches(setConditions, swap)) resultSwaps.push(swap as S);
            }

            return Promise.resolve(resultSwaps);
        }

        const swapTypeConditionIndex = params.findIndex(obj => obj.key==="type");
        let useTypes: SwapType[] = null;
        if(swapTypeConditionIndex!==-1) {
            const swapTypeCondition = params[swapTypeConditionIndex];
            params.splice(swapTypeConditionIndex, 1);
            if(Array.isArray(swapTypeCondition.value)) {
                useTypes = swapTypeCondition.value;
            } else {
                useTypes = [swapTypeCondition.value];
            }
        }

        const setConditions = toSetConditions(params);

        const resultSwaps: S[] = [];

        if(useTypes==null) {
            for(let type in this.swapData) {
                const swaps: Map<string, S> = this.swapData[type];
                for(let swap of swaps.values()) {
                    if(matches(setConditions, swap)) resultSwaps.push(swap);
                }
            }
        } else {
            for(let type of useTypes) {
                const swaps: Map<string, S> = this.swapData[type] as any;
                for(let swap of swaps.values()) {
                    if(matches(setConditions, swap)) resultSwaps.push(swap);
                }
            }
        }

        return Promise.resolve(resultSwaps);
    }

    save<S extends ISwap<T>>(swapData: S): Promise<void> {
        const id = swapData.getIdentifierHashString();
        const storedSwaps = this.swapData[swapData.getType()];
        storedSwaps.set(id, swapData);
        const escrowHash = swapData.getEscrowHash();
        if(escrowHash!=null) this.swapDataByEscrowHash.set(escrowHash, swapData);
        return this.storageManagers[swapData.getType()].saveData(id, swapData);
    }

    async saveAll<S extends ISwap<T>>(values: S[]): Promise<void> {
        const swapsByType: {[key in SwapType]?: S[]} = {};
        values.forEach(swapData => {
            const type = swapData.getType();
            swapsByType[type] ??= [];
            swapsByType[type].push(swapData);
        });

        for(let type in swapsByType) {
            const storage: IStorageManager<S> = this.storageManagers[type];
            const swaps = swapsByType[type as unknown as SwapType];
            const storedSwaps = this.swapData[type as unknown as SwapType];

            const saveSwaps = swaps.map(swap => {
                return {id: swap.getIdentifierHashString(), object: swap};
            });

            if(storage.saveDataArr!=null) {
                await storage.saveDataArr(saveSwaps);
                saveSwaps.forEach(({id, object}) => storedSwaps.set(id, object));
                return;
            }

            for(let swap of saveSwaps) {
                storedSwaps.set(swap.id, swap.object);
                const escrowHash = swap.object.getEscrowHash();
                if(escrowHash!=null) this.swapDataByEscrowHash.set(escrowHash, swap.object);
                await storage.saveData(swap.id, swap.object);
            }
        }
    }

    remove<S extends ISwap<T>>(swapData: S): Promise<void> {
        const id = swapData.getIdentifierHashString();
        const storedSwaps = this.swapData[swapData.getType()];
        if(!storedSwaps.delete(id)) return;
        const escrowHash = swapData.getEscrowHash();
        if(escrowHash!=null) this.swapDataByEscrowHash.delete(escrowHash);
        return this.storageManagers[swapData.getType()].removeData(id);
    }

    async removeAll<S extends ISwap<T>>(values: S[]): Promise<void> {
        const swapsByType: {[key in SwapType]?: S[]} = {};
        values.forEach(swapData => {
            const type = swapData.getType();
            swapsByType[type] ??= [];
            swapsByType[type].push(swapData);
        });

        for(let type in swapsByType) {
            const storage: IStorageManager<S> = this.storageManagers[type];
            const swaps = swapsByType[type as unknown as SwapType];
            const storedSwaps = this.swapData[type as unknown as SwapType];

            const swapIds = swaps.map(swap => swap.getIdentifierHashString());

            if(storage.removeDataArr!=null) {
                await storage.removeDataArr(swapIds);
                swapIds.forEach(swapId => storedSwaps.delete(swapId));
                return;
            }

            for(let swap of swaps) {
                const swapId = swap.getIdentifierHashString();
                if(!storedSwaps.delete(swapId)) continue;
                const escrowHash = swap.getEscrowHash();
                if(escrowHash!=null) this.swapDataByEscrowHash.delete(escrowHash);
                await storage.removeData(swapId);
            }
        }
    }

}