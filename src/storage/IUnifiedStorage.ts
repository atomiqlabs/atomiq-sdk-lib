
export type QueryParams = {
    key: string,
    value: any | any[]
};

export type UnifiedStoredObject = {id: string} & any;

export interface IUnifiedStorage {

    init(): Promise<void>;

    /**
     * Params are specified in the following way:
     *  - [[condition1, condition2]] - returns all rows where condition1 AND condition2 is met
     *  - [[condition1], [condition2]] - returns all rows where condition1 OR condition2 is met
     *  - [[condition1, condition2], [condition3]] - returns all rows where (condition1 AND condition2) OR condition3 is met
     * @param params
     */
    query(params: Array<Array<QueryParams>>): Promise<Array<UnifiedStoredObject>>;

    save(value: UnifiedStoredObject): Promise<void>;

    saveAll(value: UnifiedStoredObject[]): Promise<void>;

    remove(value: UnifiedStoredObject): Promise<void>;

    removeAll(value: UnifiedStoredObject[]): Promise<void>;

}
