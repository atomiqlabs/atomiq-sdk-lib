"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemStorageManager = void 0;
const fs = require("fs/promises");
const Utils_1 = require("../utils/Utils");
/**
 * StorageManager using local filesystem to persists data, creates a new file for every save object
 */
class FileSystemStorageManager {
    constructor(directory) {
        this.data = {};
        this.directory = directory;
        this.logger = (0, Utils_1.getLogger)("FileSystemStorageManager(" + directory + "): ");
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.mkdir(this.directory);
            }
            catch (e) { }
        });
    }
    saveData(hash, object) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield fs.mkdir(this.directory);
            }
            catch (e) { }
            this.data[hash] = object;
            const cpy = object.serialize();
            yield fs.writeFile(this.directory + "/" + hash + ".json", JSON.stringify(cpy));
        });
    }
    removeData(hash) {
        return __awaiter(this, void 0, void 0, function* () {
            const paymentHash = hash;
            try {
                if (this.data[paymentHash] != null)
                    delete this.data[paymentHash];
                yield fs.rm(this.directory + "/" + paymentHash + ".json");
            }
            catch (e) {
                this.logger.error("removeData(): Error: ", e);
            }
        });
    }
    loadData(type) {
        return __awaiter(this, void 0, void 0, function* () {
            let files;
            try {
                files = yield fs.readdir(this.directory);
            }
            catch (e) {
                this.logger.error("loadData(): Error: ", e);
                return [];
            }
            const arr = [];
            for (let file of files) {
                const paymentHash = file.split(".")[0];
                const result = yield fs.readFile(this.directory + "/" + file);
                const obj = JSON.parse(result.toString());
                const parsed = new type(obj);
                arr.push(parsed);
                this.data[paymentHash] = parsed;
            }
            return arr;
        });
    }
}
exports.FileSystemStorageManager = FileSystemStorageManager;
