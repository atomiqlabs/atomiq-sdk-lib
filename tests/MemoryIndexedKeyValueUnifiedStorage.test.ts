import { MemoryIndexedKeyValueUnifiedStorage, KeyValueStorage } from "../src";

function makeSyncStorage(): KeyValueStorage<false> & {store: Record<string, string>} {
    const store: Record<string, string> = {};
    return {
        store,
        async: false,
        async init() {},
        get: (key) => store[key] ?? null,
        set: (key, value) => { store[key] = value },
        remove: (key) => { delete store[key] },
        getKeys: () => Object.keys(store)
    };
}

function makeSyncAllStorage(): KeyValueStorage<false> & {store: Record<string, string>} {
    const store: Record<string, string> = {};
    return {
        store,
        async: false,
        async init() {},
        get: (key) => store[key] ?? null,
        set: (key, value) => { store[key] = value },
        remove: (key) => { delete store[key] },
        getKeys: () => Object.keys(store),
        getAll: (keys) => keys.map(k => store[k] ?? null),
        setAll: (values) => { values.forEach(({key, value}) => store[key] = value) },
        removeAll: (keys) => { keys.forEach(k => delete store[k]) }
    };
}

function makeAsyncStorage(): KeyValueStorage<true> & {store: Record<string, string>} {
    const store: Record<string, string> = {};
    const delay = () => new Promise(res => setTimeout(res, Math.floor(Math.random()*5)));
    return {
        store,
        async: true,
        async init() { await delay() },
        async get(key) { await delay(); return store[key] ?? null },
        async set(key, value) { await delay(); store[key] = value },
        async remove(key) { await delay(); delete store[key] },
        async getKeys() { await delay(); return Object.keys(store) }
    };
}

function makeAsyncAllStorage(): KeyValueStorage<true> & {store: Record<string, string>} {
    const store: Record<string, string> = {};
    const delay = () => new Promise(res => setTimeout(res, Math.floor(Math.random()*5)));
    return {
        store,
        async: true,
        async init() { await delay() },
        async get(key) { await delay(); return store[key] ?? null },
        async set(key, value) { await delay(); store[key] = value },
        async remove(key) { await delay(); delete store[key] },
        async getKeys() { await delay(); return Object.keys(store) },
        async getAll(keys) { await delay(); return keys.map(k => store[k] ?? null) },
        async setAll(values) { await delay(); values.forEach(({key, value}) => store[key] = value) },
        async removeAll(keys) { await delay(); keys.forEach(k => delete store[k]) }
    };
}

const indexes = [{ key: "type", type: "string" }, { key: "user", type: "string" }];
const compositeIndexes = [{ keys: ["type", "user"] }, { keys: ["user", "id"] }];

const sampleObjects = [
    { id: "1", type: "A", user: "X" },
    { id: "2", type: "A", user: "Y" },
    { id: "3", type: "B", user: "X" },
    { id: "4", type: "B", user: "Z" },
];

describe.each([
    ["sync", makeSyncStorage],
    ["syncAll", makeSyncAllStorage],
    ["async", makeAsyncStorage],
    ["asyncAll", makeAsyncAllStorage],
])("MemoryIndexedKeyValueUnifiedStorage with %s storage", (_, makeStorage) => {
    let storage: MemoryIndexedKeyValueUnifiedStorage;

    beforeEach(async () => {
        storage = new MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
        await storage.init(indexes as any, compositeIndexes as any);
        await storage.saveAll(sampleObjects);
    });

    test("internal simple index map stays in sync", async () => {
        // For type=A we should have ids "1" and "2" initially
        const typeIndex = storage.indexesMaps["type"];
        expect(Array.from(typeIndex.get("A")).sort()).toEqual(["1", "2"]);

        // Update id=2 to type=Z
        await storage.save({ id: "2", type: "Z", user: "Y" });

        expect(typeIndex.get("A")?.has("2")).toBeFalsy();
        expect(typeIndex.get("Z")?.has("2")).toBeTruthy();
    });

    test("internal composite index map stays in sync", async () => {
        const compositeKey = "type,user";
        const compIndex = storage.compositeIndexesMaps[compositeKey];

        // id=1 is {type:A, user:X}
        expect(Array.from(compIndex.get("A,X"))).toContain("1");

        // Update id=1 to user=Z
        await storage.save({ id: "1", type: "A", user: "Z" });

        expect(compIndex.get("A,X")).toBeUndefined();
        expect(Array.from(compIndex.get("A,Z"))).toContain("1");
    });

    test("query by simple index", async () => {
        const result = await storage.query([[{ key: "type", value: "A" }]]);
        expect(result.map(r => r.id).sort()).toEqual(["1", "2"]);
    });

    test("query by id", async () => {
        const result = await storage.query([[{ key: "id", value: "3" }]]);
        expect(result.map(r => r.id)).toEqual(["3"]);
    });

    test("query by composite index", async () => {
        const result = await storage.query([[{ key: "type", value: "A" }, { key: "user", value: "Y" }]]);
        expect(result.map(r => r.id)).toEqual(["2"]);
    });

    test("query with OR", async () => {
        const result = await storage.query([
            [{ key: "type", value: "A" }],
            [{ key: "user", value: "Z" }]
        ]);
        expect(result.map(r => r.id).sort()).toEqual(["1", "2", "4"]);
    });

    test("sequential writes", async () => {
        const order: string[] = [];
        const promises = [
            storage.save({ id: "5", type: "C", user: "U" }).then(() => order.push("first")),
            storage.save({ id: "5", type: "D", user: "V" }).then(() => order.push("second")),
            storage.remove({ id: "5" }).then(() => order.push("third"))
        ];
        await Promise.all(promises);
        expect(order).toEqual(["first", "second", "third"]);
        const result = await storage.query([[{ key: "id", value: "5" }]]);
        expect(result.length).toBe(0);
    });

    test("indexes remain consistent after updates", async () => {
        await storage.save({ id: "1", type: "B", user: "Z" });
        const resultTypeA = await storage.query([[{ key: "type", value: "A" }]]);
        expect(resultTypeA.map(r => r.id)).not.toContain("1");
        const resultTypeB = await storage.query([[{ key: "type", value: "B" }]]);
        expect(resultTypeB.map(r => r.id)).toContain("1");
    });

    test("remove updates indexes", async () => {
        await storage.remove({ id: "2" });
        const result = await storage.query([[{ key: "type", value: "A" }]]);
        expect(result.map(r => r.id)).toEqual(["1"]);
    });


    test("composite indexes stay consistent after update", async () => {
        const before = await storage.query([[{ key: "type", value: "A" }, { key: "user", value: "Y" }]]);
        expect(before.map(r => r.id)).toEqual(["2"]);

        await storage.save({ id: "2", type: "C", user: "Y" });

        const afterOldComposite = await storage.query([[{ key: "type", value: "A" }, { key: "user", value: "Y" }]]);
        expect(afterOldComposite.map(r => r.id)).not.toContain("2");

        const afterNewComposite = await storage.query([[{ key: "type", value: "C" }, { key: "user", value: "Y" }]]);
        expect(afterNewComposite.map(r => r.id)).toContain("2");
    });

    test("query fails when index does not exist", async () => {
        await expect(
            storage.query([[{ key: "nonexistent", value: "foo" }]])
        ).rejects.toThrow(/Disallowed querying without index/);
    });

    test("mix of simple and composite indexes", async () => {
        const result = await storage.query([
            [{ key: "user", value: "X" }],
            [{ key: "user", value: "Y" }, { key: "id", value: "2" }]
        ]);
        expect(result.map(r => r.id).sort()).toEqual(["1", "2", "3"]);
    });

    test("query results are deduplicated", async () => {
        // id=1 has type=A and user=X, so it matches both branches
        const result = await storage.query([
            [{ key: "type", value: "A" }],
            [{ key: "user", value: "X" }]
        ]);
        const ids = result.map(r => r.id);
        expect(ids).toContain("1");
        // It should only appear once
        expect(ids.filter(id => id === "1").length).toBe(1);
    });

    test("stress test concurrent writes and deletes are sequential", async () => {
        const ops: Promise<void>[] = [];

        // Insert a bunch of objects concurrently
        for (let i = 0; i < 50; i++) {
            ops.push(storage.save({ id: String(i), type: "bulk", user: "stress" }));
        }

        // Mix in some deletes concurrently
        for (let i = 0; i < 20; i++) {
            ops.push(storage.remove({ id: String(i) }));
        }

        // Also do updates concurrently
        for (let i = 30; i < 40; i++) {
            ops.push(storage.save({ id: String(i), type: "updated", user: "stress2" }));
        }

        await Promise.all(ops);

        // Validate consistency
        const all = await storage.query([[{ key: "type", value: "bulk" }]]);
        const updated = await storage.query([[{ key: "type", value: "updated" }]]);

        // The first 20 should have been removed
        const ids = [...all, ...updated].map(r => r.id);
        for (let i = 0; i < 20; i++) {
            expect(ids).not.toContain(String(i));
        }

        // Updated items should be present with new type
        const updatedIds = updated.map(r => r.id).sort();
        expect(updatedIds).toEqual(["30", "31", "32", "33", "34", "35", "36", "37", "38", "39"]);
    });

    test("concurrent saveAll operations are processed sequentially", async () => {
        const objsBatch1 = Array.from({ length: 10 }, (_, i) => ({ id: `s1-${i}`, type: "A0" }));
        const objsBatch2 = Array.from({ length: 10 }, (_, i) => ({ id: `s2-${i}`, type: "B0" }));

        // Fire off both saveAll operations concurrently
        const promises: Promise<void>[] = [
            storage.saveAll(objsBatch1),
            storage.saveAll(objsBatch2)
        ];

        await Promise.all(promises);

        const allA = await storage.query([[{ key: "type", value: "A0" }]]);
        const allB = await storage.query([[{ key: "type", value: "B0" }]]);

        expect(allA.map(r => r.id).sort()).toEqual(objsBatch1.map(o => o.id).sort());
        expect(allB.map(r => r.id).sort()).toEqual(objsBatch2.map(o => o.id).sort());
    });

    test("concurrent removeAll operations are processed sequentially", async () => {
        const objs = Array.from({ length: 10 }, (_, i) => ({ id: `r-${i}`, type: "C" }));
        await storage.saveAll(objs);

        // Fire off multiple removeAll concurrently
        const promises: Promise<void>[] = [
            storage.removeAll(objs.slice(0, 5)),
            storage.removeAll(objs.slice(5))
        ];

        await Promise.all(promises);

        const remaining = await storage.query([[{ key: "type", value: "C" }]]);
        expect(remaining.length).toBe(0);
    });

    test("concurrent saveAll and removeAll maintain consistency", async () => {
        const saveObjs = Array.from({ length: 10 }, (_, i) => ({ id: `sc-${i}`, type: "D" }));
        await storage.saveAll(saveObjs);

        const saveBatch = Array.from({ length: 5 }, (_, i) => ({ id: `sc-new-${i}`, type: "D" }));
        const removeBatch = saveObjs.slice(0, 5);

        // Fire off saveAll and removeAll concurrently
        await Promise.all([
            storage.saveAll(saveBatch),
            storage.removeAll(removeBatch)
        ]);

        const remaining = await storage.query([[{ key: "type", value: "D" }]]);
        const remainingIds = remaining.map(r => r.id).sort();
        const expectedIds = [...saveObjs.slice(5).map(o => o.id), ...saveBatch.map(o => o.id)].sort();
        expect(remainingIds).toEqual(expectedIds);
    });

    test("saveAll updates existing values and indexes", async () => {
        await storage.saveAll([{ id: "1", type: "Z", user: "X" }]);
        const resultOld = await storage.query([[{ key: "type", value: "A" }]]);
        expect(resultOld.map(r => r.id)).not.toContain("1");

        const resultNew = await storage.query([[{ key: "type", value: "Z" }]]);
        expect(resultNew.map(r => r.id)).toContain("1");
    });

    test("remove then re-add keeps indexes consistent", async () => {
        await storage.remove({ id: "3" });
        let result = await storage.query([[{ key: "id", value: "3" }]]);
        expect(result.length).toBe(0);

        await storage.save({ id: "3", type: "B", user: "X" });
        result = await storage.query([[{ key: "id", value: "3" }]]);
        expect(result.length).toBe(1);

        const byType = await storage.query([[{ key: "type", value: "B" }]]);
        expect(byType.map(r => r.id)).toContain("3");
    });

    test("overlapping OR queries are deduplicated", async () => {
        const result = await storage.query([
            [{ key: "type", value: "A" }],
            [{ key: "type", value: "A" }, { key: "user", value: "X" }]
        ]);
        const ids = result.map(r => r.id);
        // "1" should appear only once even though it matches both branches
        expect(ids.filter(id => id === "1").length).toBe(1);
    });

    test("saveAll rolls back on error when backend has no setAll", async () => {
        // Wrap the base backend to simulate errors
        for(let i=0;i<100;i++) {
            const base = makeStorage();
            delete (base as any).setAll; // ensure no setAll
            const faultyBackend = {
                ...base,
                set: (key: string, value: string) => {
                    if (key.includes("FAIL")) {
                        if(base.async) {
                            return Promise.reject(new Error("Simulated failure"));
                        } else {
                            throw new Error("Simulated failure");
                        }
                    }
                    return base.set(key, value);
                }
            };

            const faultyStorage = new MemoryIndexedKeyValueUnifiedStorage(faultyBackend as any, { allowQueryWithoutIndexes: false });
            await faultyStorage.init([{ key: "type" }] as any, []);

            // initial state
            await faultyStorage.saveAll([
                { id: "ok1", type: "T" },
                { id: "ok2", type: "T" }
            ]);

            // try to save one good + one bad
            await expect(faultyStorage.saveAll([
                { id: "ok1", type: "U" },    // will succeed first
                { id: "FAIL", type: "U" }    // will fail
            ])).rejects.toThrow("Simulated failure");

            // verify rollback: ok1 should still have its original value
            const result = await faultyStorage.query([[{ key: "type", value: "T" }]]);
            const ids = result.map(r => r.id).sort();
            expect(ids).toEqual(["ok1", "ok2"]);
        }
    }, 15000);

    test("removeAll rolls back on error when backend has no removeAll", async () => {
        for(let i=0;i<100;i++) {
            const base = makeStorage();
            delete (base as any).removeAll;
            const faultyBackend = {
                ...base,
                remove: (key: string) => {
                    if (key.includes("FAIL")) {
                        if (base.async) {
                            return Promise.reject(new Error("Simulated failure"));
                        } else {
                            throw new Error("Simulated failure");
                        }
                    }
                    return base.remove(key);
                }
            };

            const faultyStorage = new MemoryIndexedKeyValueUnifiedStorage(faultyBackend as any, {allowQueryWithoutIndexes: false});
            await faultyStorage.init([{key: "type"}] as any, []);

            // initial state
            await faultyStorage.saveAll([
                {id: "ok1", type: "T"},
                {id: "FAIL", type: "T"}
            ]);

            // attempt to remove both -> FAIL triggers rejection
            await expect(faultyStorage.removeAll([
                {id: "ok1"},
                {id: "FAIL"}
            ])).rejects.toThrow("Simulated failure");

            // verify rollback: both items should still exist
            const result = await faultyStorage.query([[{key: "type", value: "T"}]]);
            const ids = result.map(r => r.id).sort();
            expect(ids).toEqual(["FAIL", "ok1"]);
        }
    }, 15000);

    test("empty storage returns [] and removes are no-op", async () => {
        const fresh = new MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
        await fresh.init([{ key: "type" }] as any, [] as any);

        const result = await fresh.query([[{ key: "type", value: "A" }]]);
        expect(result).toEqual([]);

        await expect(fresh.remove({ id: "does-not-exist" })).resolves.toBeUndefined();
        await expect(fresh.removeAll([{ id: "does-not-exist" }])).resolves.toBeUndefined();
    });

    test("batching with maxBatchItems=1 still works", async () => {
        const smallBatch = new MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false, maxBatchItems: 1 });
        await smallBatch.init([{ key: "type" }] as any, [] as any);

        const objs = Array.from({ length: 5 }, (_, i) => ({ id: String(i), type: "T" }));
        await smallBatch.saveAll(objs);

        const result = await smallBatch.query([[{ key: "type", value: "T" }]]);
        expect(result.map(r => r.id).sort()).toEqual(["0", "1", "2", "3", "4"]);
    });

    test("null values in indexed fields are handled", async () => {
        await storage.save({ id: "10", type: null, user: null });

        const resultNullType = await storage.query([[{ key: "type", value: null }]]);
        expect(resultNullType.map(r => r.id)).toContain("10");

        const resultNullUser = await storage.query([[{ key: "user", value: null }]]);
        expect(resultNullUser.map(r => r.id)).toContain("10");
    });

    test("composite index with three keys works", async () => {
        const triple = new MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
        await triple.init(
            [{ key: "type" }, { key: "user" }, { key: "group" }] as any,
            [{ keys: ["type", "user", "group"] }] as any
        );
        await triple.saveAll([
            { id: "t1", type: "A", user: "U1", group: "G1" },
            { id: "t2", type: "A", user: "U2", group: "G1" },
        ]);

        const result = await triple.query([[{ key: "type", value: "A" }, { key: "user", value: "U1" }, { key: "group", value: "G1" }]]);
        expect(result.map(r => r.id)).toEqual(["t1"]);
    });

    test("internal composite index map with multiple keys", async () => {
        const multi = new MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
        await multi.init(
            [{ key: "type" }, { key: "user" }, { key: "group" }] as any,
            [{ keys: ["type", "user", "group"] }] as any
        );
        await multi.save({ id: "99", type: "Q", user: "UQ", group: "GQ" });

        const compositeKey = "type,user,group";
        const compIndex = multi.compositeIndexesMaps[compositeKey];
        expect(Array.from(compIndex.get("Q,UQ,GQ"))).toContain("99");

        await multi.remove({ id: "99" });
        expect(compIndex.get("Q,UQ,GQ")).toBeUndefined();
    });

});
