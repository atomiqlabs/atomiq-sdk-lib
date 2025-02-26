import {IStorageManager, StorageObject} from "@atomiqlabs/base";

/**
 * StorageManager storing the data in memory, the data is lost after page refresh
 */
export class MemoryStorageManager<T extends StorageObject> implements IStorageManager<T> {

    data: { [p: string]: T } = {};

    init(): Promise<void> {
        return Promise.resolve();
    }

    loadData(type: { new(data: any): T }): Promise<T[]> {
        return Promise.resolve(Object.keys(this.data).map(key => this.data[key]));
    }

    removeData(hash: string): Promise<void> {
        if(this.data[hash]!=null) delete this.data[hash];
        return Promise.resolve();
    }

    removeDataArr(arr: string[]): Promise<void> {
        arr.forEach(id => {
            if(this.data[id]!=null) delete this.data[id];
        })
        return Promise.resolve();
    }

    saveData(hash: string, object: T): Promise<void> {
        this.data[hash] = object;
        return Promise.resolve();
    }

    saveDataArr(arr: {id: string, object: T}[]): Promise<void> {
        arr.forEach(data => {
            this.data[data.id] = data.object;
        });
        return Promise.resolve();
    }

}
