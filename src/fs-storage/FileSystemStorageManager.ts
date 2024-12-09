import {StorageObject, IStorageManager} from "crosslightning-base";
import * as fs from "fs/promises";
import {getLogger, LoggerType} from "../utils/Utils";

/**
 * StorageManager using local filesystem to persists data, creates a new file for every save object
 */
export class FileSystemStorageManager<T extends StorageObject> implements IStorageManager<T> {
    protected readonly logger: LoggerType;

    private readonly directory: string;
    data: {
        [key: string]: T
    } = {};

    constructor(directory: string) {
        this.directory = directory;
        this.logger = getLogger("FileSystemStorageManager("+directory+"): ");
    }

    async init(): Promise<void> {
        try {
            await fs.mkdir(this.directory);
        } catch (e) {}
    }

    async saveData(hash: string, object: T): Promise<void> {

        try {
            await fs.mkdir(this.directory)
        } catch (e) {}

        this.data[hash] = object;

        const cpy = object.serialize();

        await fs.writeFile(this.directory+"/"+hash+".json", JSON.stringify(cpy));

    }

    async removeData(hash: string): Promise<void> {
        const paymentHash = hash;
        try {
            if(this.data[paymentHash]!=null) delete this.data[paymentHash];
            await fs.rm(this.directory+"/"+paymentHash+".json");
        } catch (e) {
            this.logger.error("removeData(): Error: ", e);
        }
    }

    async loadData(type: new(data: any) => T): Promise<T[]> {
        let files;
        try {
            files = await fs.readdir(this.directory);
        } catch (e) {
            this.logger.error("loadData(): Error: ", e);
            return [];
        }

        const arr = [];

        for(let file of files) {
            const paymentHash = file.split(".")[0];
            const result = await fs.readFile(this.directory+"/"+file);
            const obj = JSON.parse(result.toString());
            const parsed = new type(obj);
            arr.push(parsed);
            this.data[paymentHash] = parsed;
        }

        return arr;
    }

}