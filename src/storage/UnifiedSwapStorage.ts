import {ChainType} from "@atomiqlabs/base";
import {IUnifiedStorage} from "./IUnifiedStorage";
import {ISwap} from "../swaps/ISwap";
import { getLogger } from "../utils/Utils";

export type QueryParams = {
    key: string,
    value: any | any[]
};

const logger = getLogger("UnifiedSwapStorage: ");

export class UnifiedSwapStorage<T extends ChainType> {

    readonly storage: IUnifiedStorage;
    readonly weakRefCache: Map<string, WeakRef<ISwap<T>>> = new Map();
    readonly noWeakRefMap: boolean;

    constructor(storage: IUnifiedStorage, noWeakRefMap?: boolean) {
        this.storage = storage;
        this.noWeakRefMap = noWeakRefMap;
    }

    init(): Promise<void> {
        return this.storage.init();
    }

    /**
     * Params are specified in the following way:
     *  - [[condition1, condition2]] - returns all rows where condition1 AND condition2 is met
     *  - [[condition1], [condition2]] - returns all rows where condition1 OR condition2 is met
     *  - [[condition1, condition2], [condition3]] - returns all rows where (condition1 AND condition2) OR condition3 is met
     * @param params
     * @param reviver
     */
    async query<S extends ISwap<T>>(params: Array<Array<QueryParams>>, reviver: (obj: any) => S): Promise<Array<S>> {
        const rawSwaps = await this.storage.query(params);

        return rawSwaps.map(rawObj => {
            if(!this.noWeakRefMap) {
                const savedRef = this.weakRefCache.get(rawObj.id)?.deref();
                if(savedRef!=null) return savedRef as S;
                logger.debug("query(): Reviving new swap instance: "+rawObj.id);
            }
            const value = reviver(rawObj);
            if(!this.noWeakRefMap) this.weakRefCache.set(rawObj.id, new WeakRef<ISwap<T>>(value));
            return value;
        });
    }

    save<S extends ISwap<T>>(value: S): Promise<void> {
        if(!this.noWeakRefMap) this.weakRefCache.set(value.getId(), new WeakRef<ISwap<T>>(value));
        return this.storage.save(value.serialize());
    }

    saveAll<S extends ISwap<T>>(values: S[]): Promise<void> {
        if(!this.noWeakRefMap) values.forEach(value => this.weakRefCache.set(value.getId(), new WeakRef<ISwap<T>>(value)));
        return this.storage.saveAll(values.map(obj => obj.serialize()));
    }

    remove<S extends ISwap<T>>(value: S): Promise<void> {
        if(!this.noWeakRefMap) this.weakRefCache.delete(value.getId());
        return this.storage.remove(value.serialize());
    }

    removeAll<S extends ISwap<T>>(values: S[]): Promise<void> {
        if(!this.noWeakRefMap) values.forEach(value => this.weakRefCache.delete(value.getId()));
        return this.storage.removeAll(values.map(obj => obj.serialize()));
    }

}
