export interface KeyValueStorage {
    init(): Promise<void>;
    get(key: string): Promise<string> | string;
    set(key: string, value: string): Promise<void> | void;
    remove(key: string): Promise<void> | void;
    getKeys(): Promise<string[]> | string;
    getAll?(keys: string[]): Promise<(string | null)[]> | (string | null)[];
    setAll?(values: {
        key: string;
        value: string;
    }[]): Promise<void> | void;
    removeAll?(values: {
        key: string;
        value: string;
    }[]): Promise<void> | void;
}
