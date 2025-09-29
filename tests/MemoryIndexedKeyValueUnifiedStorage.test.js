"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var src_1 = require("../src");
function makeSyncStorage() {
    var store = {};
    return {
        store: store,
        async: false,
        init: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); });
        },
        get: function (key) { var _a; return (_a = store[key]) !== null && _a !== void 0 ? _a : null; },
        set: function (key, value) { store[key] = value; },
        remove: function (key) { delete store[key]; },
        getKeys: function () { return Object.keys(store); }
    };
}
function makeSyncAllStorage() {
    var store = {};
    return {
        store: store,
        async: false,
        init: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); });
        },
        get: function (key) { var _a; return (_a = store[key]) !== null && _a !== void 0 ? _a : null; },
        set: function (key, value) { store[key] = value; },
        remove: function (key) { delete store[key]; },
        getKeys: function () { return Object.keys(store); },
        getAll: function (keys) { return keys.map(function (k) { var _a; return (_a = store[k]) !== null && _a !== void 0 ? _a : null; }); },
        setAll: function (values) { values.forEach(function (_a) {
            var key = _a.key, value = _a.value;
            return store[key] = value;
        }); },
        removeAll: function (keys) { keys.forEach(function (k) { return delete store[k]; }); }
    };
}
function makeAsyncStorage() {
    var store = {};
    var delay = function () { return new Promise(function (res) { return setTimeout(res, Math.floor(Math.random() * 5)); }); };
    return {
        store: store,
        async: true,
        init: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            }); });
        },
        get: function (key) {
            var _a;
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, (_a = store[key]) !== null && _a !== void 0 ? _a : null];
                }
            }); });
        },
        set: function (key, value) {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        store[key] = value;
                        return [2 /*return*/];
                }
            }); });
        },
        remove: function (key) {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        delete store[key];
                        return [2 /*return*/];
                }
            }); });
        },
        getKeys: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, Object.keys(store)];
                }
            }); });
        }
    };
}
function makeAsyncAllStorage() {
    var store = {};
    var delay = function () { return new Promise(function (res) { return setTimeout(res, Math.floor(Math.random() * 5)); }); };
    return {
        store: store,
        async: true,
        init: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            }); });
        },
        get: function (key) {
            var _a;
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, (_a = store[key]) !== null && _a !== void 0 ? _a : null];
                }
            }); });
        },
        set: function (key, value) {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        store[key] = value;
                        return [2 /*return*/];
                }
            }); });
        },
        remove: function (key) {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        delete store[key];
                        return [2 /*return*/];
                }
            }); });
        },
        getKeys: function () {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, Object.keys(store)];
                }
            }); });
        },
        getAll: function (keys) {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, keys.map(function (k) { var _a; return (_a = store[k]) !== null && _a !== void 0 ? _a : null; })];
                }
            }); });
        },
        setAll: function (values) {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        values.forEach(function (_a) {
                            var key = _a.key, value = _a.value;
                            return store[key] = value;
                        });
                        return [2 /*return*/];
                }
            }); });
        },
        removeAll: function (keys) {
            return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, delay()];
                    case 1:
                        _a.sent();
                        keys.forEach(function (k) { return delete store[k]; });
                        return [2 /*return*/];
                }
            }); });
        }
    };
}
var indexes = [{ key: "type", type: "string" }, { key: "user", type: "string" }];
var compositeIndexes = [{ keys: ["type", "user"] }, { keys: ["user", "id"] }];
var sampleObjects = [
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
])("MemoryIndexedKeyValueUnifiedStorage with %s storage", function (_, makeStorage) {
    var storage;
    beforeEach(function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    storage = new src_1.MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
                    return [4 /*yield*/, storage.init(indexes, compositeIndexes)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.saveAll(sampleObjects)];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test("internal simple index map stays in sync", function () { return __awaiter(void 0, void 0, void 0, function () {
        var typeIndex;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    typeIndex = storage.indexesMaps["type"];
                    expect(Array.from(typeIndex.get("A")).sort()).toEqual(["1", "2"]);
                    // Update id=2 to type=Z
                    return [4 /*yield*/, storage.save({ id: "2", type: "Z", user: "Y" })];
                case 1:
                    // Update id=2 to type=Z
                    _c.sent();
                    expect((_a = typeIndex.get("A")) === null || _a === void 0 ? void 0 : _a.has("2")).toBeFalsy();
                    expect((_b = typeIndex.get("Z")) === null || _b === void 0 ? void 0 : _b.has("2")).toBeTruthy();
                    return [2 /*return*/];
            }
        });
    }); });
    test("internal composite index map stays in sync", function () { return __awaiter(void 0, void 0, void 0, function () {
        var compositeKey, compIndex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    compositeKey = "type,user";
                    compIndex = storage.compositeIndexesMaps[compositeKey];
                    // id=1 is {type:A, user:X}
                    expect(Array.from(compIndex.get("A,X"))).toContain("1");
                    // Update id=1 to user=Z
                    return [4 /*yield*/, storage.save({ id: "1", type: "A", user: "Z" })];
                case 1:
                    // Update id=1 to user=Z
                    _a.sent();
                    expect(compIndex.get("A,X")).toBeUndefined();
                    expect(Array.from(compIndex.get("A,Z"))).toContain("1");
                    return [2 /*return*/];
            }
        });
    }); });
    test("query by simple index", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([[{ key: "type", value: "A" }]])];
                case 1:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; }).sort()).toEqual(["1", "2"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("query by id", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([[{ key: "id", value: "3" }]])];
                case 1:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; })).toEqual(["3"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("query by composite index", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([[{ key: "type", value: "A" }, { key: "user", value: "Y" }]])];
                case 1:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; })).toEqual(["2"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("query with OR", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([
                        [{ key: "type", value: "A" }],
                        [{ key: "user", value: "Z" }]
                    ])];
                case 1:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; }).sort()).toEqual(["1", "2", "4"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("sequential writes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var order, promises, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    order = [];
                    promises = [
                        storage.save({ id: "5", type: "C", user: "U" }).then(function () { return order.push("first"); }),
                        storage.save({ id: "5", type: "D", user: "V" }).then(function () { return order.push("second"); }),
                        storage.remove({ id: "5" }).then(function () { return order.push("third"); })
                    ];
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    _a.sent();
                    expect(order).toEqual(["first", "second", "third"]);
                    return [4 /*yield*/, storage.query([[{ key: "id", value: "5" }]])];
                case 2:
                    result = _a.sent();
                    expect(result.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    test("indexes remain consistent after updates", function () { return __awaiter(void 0, void 0, void 0, function () {
        var resultTypeA, resultTypeB;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.save({ id: "1", type: "B", user: "Z" })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "A" }]])];
                case 2:
                    resultTypeA = _a.sent();
                    expect(resultTypeA.map(function (r) { return r.id; })).not.toContain("1");
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "B" }]])];
                case 3:
                    resultTypeB = _a.sent();
                    expect(resultTypeB.map(function (r) { return r.id; })).toContain("1");
                    return [2 /*return*/];
            }
        });
    }); });
    test("remove updates indexes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.remove({ id: "2" })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "A" }]])];
                case 2:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; })).toEqual(["1"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("composite indexes stay consistent after update", function () { return __awaiter(void 0, void 0, void 0, function () {
        var before, afterOldComposite, afterNewComposite;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([[{ key: "type", value: "A" }, { key: "user", value: "Y" }]])];
                case 1:
                    before = _a.sent();
                    expect(before.map(function (r) { return r.id; })).toEqual(["2"]);
                    return [4 /*yield*/, storage.save({ id: "2", type: "C", user: "Y" })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "A" }, { key: "user", value: "Y" }]])];
                case 3:
                    afterOldComposite = _a.sent();
                    expect(afterOldComposite.map(function (r) { return r.id; })).not.toContain("2");
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "C" }, { key: "user", value: "Y" }]])];
                case 4:
                    afterNewComposite = _a.sent();
                    expect(afterNewComposite.map(function (r) { return r.id; })).toContain("2");
                    return [2 /*return*/];
            }
        });
    }); });
    test("query fails when index does not exist", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, expect(storage.query([[{ key: "nonexistent", value: "foo" }]])).rejects.toThrow(/Disallowed querying without index/)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test("mix of simple and composite indexes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([
                        [{ key: "user", value: "X" }],
                        [{ key: "user", value: "Y" }, { key: "id", value: "2" }]
                    ])];
                case 1:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; }).sort()).toEqual(["1", "2", "3"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("query results are deduplicated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, ids;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([
                        [{ key: "type", value: "A" }],
                        [{ key: "user", value: "X" }]
                    ])];
                case 1:
                    result = _a.sent();
                    ids = result.map(function (r) { return r.id; });
                    expect(ids).toContain("1");
                    // It should only appear once
                    expect(ids.filter(function (id) { return id === "1"; }).length).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    test("stress test concurrent writes and deletes are sequential", function () { return __awaiter(void 0, void 0, void 0, function () {
        var ops, i, i, i, all, updated, ids, i, updatedIds;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    ops = [];
                    // Insert a bunch of objects concurrently
                    for (i = 0; i < 50; i++) {
                        ops.push(storage.save({ id: String(i), type: "bulk", user: "stress" }));
                    }
                    // Mix in some deletes concurrently
                    for (i = 0; i < 20; i++) {
                        ops.push(storage.remove({ id: String(i) }));
                    }
                    // Also do updates concurrently
                    for (i = 30; i < 40; i++) {
                        ops.push(storage.save({ id: String(i), type: "updated", user: "stress2" }));
                    }
                    return [4 /*yield*/, Promise.all(ops)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "bulk" }]])];
                case 2:
                    all = _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "updated" }]])];
                case 3:
                    updated = _a.sent();
                    ids = __spreadArray(__spreadArray([], all, true), updated, true).map(function (r) { return r.id; });
                    for (i = 0; i < 20; i++) {
                        expect(ids).not.toContain(String(i));
                    }
                    updatedIds = updated.map(function (r) { return r.id; }).sort();
                    expect(updatedIds).toEqual(["30", "31", "32", "33", "34", "35", "36", "37", "38", "39"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("concurrent saveAll operations are processed sequentially", function () { return __awaiter(void 0, void 0, void 0, function () {
        var objsBatch1, objsBatch2, promises, allA, allB;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    objsBatch1 = Array.from({ length: 10 }, function (_, i) { return ({ id: "s1-".concat(i), type: "A0" }); });
                    objsBatch2 = Array.from({ length: 10 }, function (_, i) { return ({ id: "s2-".concat(i), type: "B0" }); });
                    promises = [
                        storage.saveAll(objsBatch1),
                        storage.saveAll(objsBatch2)
                    ];
                    return [4 /*yield*/, Promise.all(promises)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "A0" }]])];
                case 2:
                    allA = _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "B0" }]])];
                case 3:
                    allB = _a.sent();
                    expect(allA.map(function (r) { return r.id; }).sort()).toEqual(objsBatch1.map(function (o) { return o.id; }).sort());
                    expect(allB.map(function (r) { return r.id; }).sort()).toEqual(objsBatch2.map(function (o) { return o.id; }).sort());
                    return [2 /*return*/];
            }
        });
    }); });
    test("concurrent removeAll operations are processed sequentially", function () { return __awaiter(void 0, void 0, void 0, function () {
        var objs, promises, remaining;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    objs = Array.from({ length: 10 }, function (_, i) { return ({ id: "r-".concat(i), type: "C" }); });
                    return [4 /*yield*/, storage.saveAll(objs)];
                case 1:
                    _a.sent();
                    promises = [
                        storage.removeAll(objs.slice(0, 5)),
                        storage.removeAll(objs.slice(5))
                    ];
                    return [4 /*yield*/, Promise.all(promises)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "C" }]])];
                case 3:
                    remaining = _a.sent();
                    expect(remaining.length).toBe(0);
                    return [2 /*return*/];
            }
        });
    }); });
    test("concurrent saveAll and removeAll maintain consistency", function () { return __awaiter(void 0, void 0, void 0, function () {
        var saveObjs, saveBatch, removeBatch, remaining, remainingIds, expectedIds;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    saveObjs = Array.from({ length: 10 }, function (_, i) { return ({ id: "sc-".concat(i), type: "D" }); });
                    return [4 /*yield*/, storage.saveAll(saveObjs)];
                case 1:
                    _a.sent();
                    saveBatch = Array.from({ length: 5 }, function (_, i) { return ({ id: "sc-new-".concat(i), type: "D" }); });
                    removeBatch = saveObjs.slice(0, 5);
                    // Fire off saveAll and removeAll concurrently
                    return [4 /*yield*/, Promise.all([
                            storage.saveAll(saveBatch),
                            storage.removeAll(removeBatch)
                        ])];
                case 2:
                    // Fire off saveAll and removeAll concurrently
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "D" }]])];
                case 3:
                    remaining = _a.sent();
                    remainingIds = remaining.map(function (r) { return r.id; }).sort();
                    expectedIds = __spreadArray(__spreadArray([], saveObjs.slice(5).map(function (o) { return o.id; }), true), saveBatch.map(function (o) { return o.id; }), true).sort();
                    expect(remainingIds).toEqual(expectedIds);
                    return [2 /*return*/];
            }
        });
    }); });
    test("saveAll updates existing values and indexes", function () { return __awaiter(void 0, void 0, void 0, function () {
        var resultOld, resultNew;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.saveAll([{ id: "1", type: "Z", user: "X" }])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "A" }]])];
                case 2:
                    resultOld = _a.sent();
                    expect(resultOld.map(function (r) { return r.id; })).not.toContain("1");
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "Z" }]])];
                case 3:
                    resultNew = _a.sent();
                    expect(resultNew.map(function (r) { return r.id; })).toContain("1");
                    return [2 /*return*/];
            }
        });
    }); });
    test("remove then re-add keeps indexes consistent", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, byType;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.remove({ id: "3" })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "id", value: "3" }]])];
                case 2:
                    result = _a.sent();
                    expect(result.length).toBe(0);
                    return [4 /*yield*/, storage.save({ id: "3", type: "B", user: "X" })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "id", value: "3" }]])];
                case 4:
                    result = _a.sent();
                    expect(result.length).toBe(1);
                    return [4 /*yield*/, storage.query([[{ key: "type", value: "B" }]])];
                case 5:
                    byType = _a.sent();
                    expect(byType.map(function (r) { return r.id; })).toContain("3");
                    return [2 /*return*/];
            }
        });
    }); });
    test("overlapping OR queries are deduplicated", function () { return __awaiter(void 0, void 0, void 0, function () {
        var result, ids;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.query([
                        [{ key: "type", value: "A" }],
                        [{ key: "type", value: "A" }, { key: "user", value: "X" }]
                    ])];
                case 1:
                    result = _a.sent();
                    ids = result.map(function (r) { return r.id; });
                    // "1" should appear only once even though it matches both branches
                    expect(ids.filter(function (id) { return id === "1"; }).length).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
    test("saveAll rolls back on error when backend has no setAll", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _loop_1, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_1 = function (i) {
                        var base, faultyBackend, faultyStorage, result, ids;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    base = makeStorage();
                                    delete base.setAll; // ensure no setAll
                                    faultyBackend = __assign(__assign({}, base), { set: function (key, value) {
                                            if (key.includes("FAIL")) {
                                                if (base.async) {
                                                    return Promise.reject(new Error("Simulated failure"));
                                                }
                                                else {
                                                    throw new Error("Simulated failure");
                                                }
                                            }
                                            return base.set(key, value);
                                        } });
                                    faultyStorage = new src_1.MemoryIndexedKeyValueUnifiedStorage(faultyBackend, { allowQueryWithoutIndexes: false });
                                    return [4 /*yield*/, faultyStorage.init([{ key: "type" }], [])];
                                case 1:
                                    _b.sent();
                                    // initial state
                                    return [4 /*yield*/, faultyStorage.saveAll([
                                            { id: "ok1", type: "T" },
                                            { id: "ok2", type: "T" }
                                        ])];
                                case 2:
                                    // initial state
                                    _b.sent();
                                    // try to save one good + one bad
                                    return [4 /*yield*/, expect(faultyStorage.saveAll([
                                            { id: "ok1", type: "U" },
                                            { id: "FAIL", type: "U" } // will fail
                                        ])).rejects.toThrow("Simulated failure")];
                                case 3:
                                    // try to save one good + one bad
                                    _b.sent();
                                    return [4 /*yield*/, faultyStorage.query([[{ key: "type", value: "T" }]])];
                                case 4:
                                    result = _b.sent();
                                    ids = result.map(function (r) { return r.id; }).sort();
                                    expect(ids).toEqual(["ok1", "ok2"]);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < 100)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_1(i)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    }); }, 15000);
    test("removeAll rolls back on error when backend has no removeAll", function () { return __awaiter(void 0, void 0, void 0, function () {
        var _loop_2, i;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _loop_2 = function (i) {
                        var base, faultyBackend, faultyStorage, result, ids;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    base = makeStorage();
                                    delete base.removeAll;
                                    faultyBackend = __assign(__assign({}, base), { remove: function (key) {
                                            if (key.includes("FAIL")) {
                                                if (base.async) {
                                                    return Promise.reject(new Error("Simulated failure"));
                                                }
                                                else {
                                                    throw new Error("Simulated failure");
                                                }
                                            }
                                            return base.remove(key);
                                        } });
                                    faultyStorage = new src_1.MemoryIndexedKeyValueUnifiedStorage(faultyBackend, { allowQueryWithoutIndexes: false });
                                    return [4 /*yield*/, faultyStorage.init([{ key: "type" }], [])];
                                case 1:
                                    _b.sent();
                                    // initial state
                                    return [4 /*yield*/, faultyStorage.saveAll([
                                            { id: "ok1", type: "T" },
                                            { id: "FAIL", type: "T" }
                                        ])];
                                case 2:
                                    // initial state
                                    _b.sent();
                                    // attempt to remove both -> FAIL triggers rejection
                                    return [4 /*yield*/, expect(faultyStorage.removeAll([
                                            { id: "ok1" },
                                            { id: "FAIL" }
                                        ])).rejects.toThrow("Simulated failure")];
                                case 3:
                                    // attempt to remove both -> FAIL triggers rejection
                                    _b.sent();
                                    return [4 /*yield*/, faultyStorage.query([[{ key: "type", value: "T" }]])];
                                case 4:
                                    result = _b.sent();
                                    ids = result.map(function (r) { return r.id; }).sort();
                                    expect(ids).toEqual(["FAIL", "ok1"]);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    i = 0;
                    _a.label = 1;
                case 1:
                    if (!(i < 100)) return [3 /*break*/, 4];
                    return [5 /*yield**/, _loop_2(i)];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/];
            }
        });
    }); }, 15000);
    test("empty storage returns [] and removes are no-op", function () { return __awaiter(void 0, void 0, void 0, function () {
        var fresh, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fresh = new src_1.MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
                    return [4 /*yield*/, fresh.init([{ key: "type" }], [])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, fresh.query([[{ key: "type", value: "A" }]])];
                case 2:
                    result = _a.sent();
                    expect(result).toEqual([]);
                    return [4 /*yield*/, expect(fresh.remove({ id: "does-not-exist" })).resolves.toBeUndefined()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, expect(fresh.removeAll([{ id: "does-not-exist" }])).resolves.toBeUndefined()];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test("batching with maxBatchItems=1 still works", function () { return __awaiter(void 0, void 0, void 0, function () {
        var smallBatch, objs, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    smallBatch = new src_1.MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false, maxBatchItems: 1 });
                    return [4 /*yield*/, smallBatch.init([{ key: "type" }], [])];
                case 1:
                    _a.sent();
                    objs = Array.from({ length: 5 }, function (_, i) { return ({ id: String(i), type: "T" }); });
                    return [4 /*yield*/, smallBatch.saveAll(objs)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, smallBatch.query([[{ key: "type", value: "T" }]])];
                case 3:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; }).sort()).toEqual(["0", "1", "2", "3", "4"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("null values in indexed fields are handled", function () { return __awaiter(void 0, void 0, void 0, function () {
        var resultNullType, resultNullUser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, storage.save({ id: "10", type: null, user: null })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, storage.query([[{ key: "type", value: null }]])];
                case 2:
                    resultNullType = _a.sent();
                    expect(resultNullType.map(function (r) { return r.id; })).toContain("10");
                    return [4 /*yield*/, storage.query([[{ key: "user", value: null }]])];
                case 3:
                    resultNullUser = _a.sent();
                    expect(resultNullUser.map(function (r) { return r.id; })).toContain("10");
                    return [2 /*return*/];
            }
        });
    }); });
    test("composite index with three keys works", function () { return __awaiter(void 0, void 0, void 0, function () {
        var triple, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    triple = new src_1.MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
                    return [4 /*yield*/, triple.init([{ key: "type" }, { key: "user" }, { key: "group" }], [{ keys: ["type", "user", "group"] }])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, triple.saveAll([
                            { id: "t1", type: "A", user: "U1", group: "G1" },
                            { id: "t2", type: "A", user: "U2", group: "G1" },
                        ])];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, triple.query([[{ key: "type", value: "A" }, { key: "user", value: "U1" }, { key: "group", value: "G1" }]])];
                case 3:
                    result = _a.sent();
                    expect(result.map(function (r) { return r.id; })).toEqual(["t1"]);
                    return [2 /*return*/];
            }
        });
    }); });
    test("internal composite index map with multiple keys", function () { return __awaiter(void 0, void 0, void 0, function () {
        var multi, compositeKey, compIndex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    multi = new src_1.MemoryIndexedKeyValueUnifiedStorage(makeStorage(), { allowQueryWithoutIndexes: false });
                    return [4 /*yield*/, multi.init([{ key: "type" }, { key: "user" }, { key: "group" }], [{ keys: ["type", "user", "group"] }])];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, multi.save({ id: "99", type: "Q", user: "UQ", group: "GQ" })];
                case 2:
                    _a.sent();
                    compositeKey = "type,user,group";
                    compIndex = multi.compositeIndexesMaps[compositeKey];
                    expect(Array.from(compIndex.get("Q,UQ,GQ"))).toContain("99");
                    return [4 /*yield*/, multi.remove({ id: "99" })];
                case 3:
                    _a.sent();
                    expect(compIndex.get("Q,UQ,GQ")).toBeUndefined();
                    return [2 /*return*/];
            }
        });
    }); });
});
