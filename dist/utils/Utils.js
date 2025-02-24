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
exports.timeoutSignal = exports.timeoutPromise = exports.httpPost = exports.httpGet = exports.fetchWithTimeout = exports.tryWithRetries = exports.extendAbortController = exports.mapToArray = exports.objectMap = exports.promiseAny = exports.getLogger = void 0;
const RequestError_1 = require("../errors/RequestError");
function isConstructor(fn) {
    return (typeof fn === 'function' &&
        fn.prototype != null &&
        fn.prototype.constructor === fn);
}
function isConstructorArray(fnArr) {
    return Array.isArray(fnArr) && fnArr.every(isConstructor);
}
/**
 * Checks whether the passed error is allowed to pass through
 *
 * @param e Error in question
 * @param errorAllowed Allowed errors as defined as a callback function, specific error type, or an array of error types
 */
function checkError(e, errorAllowed) {
    if (isConstructorArray(errorAllowed))
        return errorAllowed.find(error => e instanceof error) != null;
    if (isConstructor(errorAllowed))
        return e instanceof errorAllowed;
    return errorAllowed(e);
}
function getLogger(prefix) {
    return {
        debug: (msg, ...args) => console.debug(prefix + msg, ...args),
        info: (msg, ...args) => console.info(prefix + msg, ...args),
        warn: (msg, ...args) => console.warn(prefix + msg, ...args),
        error: (msg, ...args) => console.error(prefix + msg, ...args)
    };
}
exports.getLogger = getLogger;
const logger = getLogger("Utils: ");
/**
 * Returns a promise that resolves when any of the passed promises resolves, and rejects if all the underlying
 *  promises fail with an array of errors returned by the respective promises
 *
 * @param promises
 */
function promiseAny(promises) {
    return new Promise((resolve, reject) => {
        let numRejected = 0;
        const rejectReasons = Array(promises.length);
        promises.forEach((promise, index) => {
            promise.then((val) => {
                if (resolve != null)
                    resolve(val);
                resolve = null;
            }).catch(err => {
                rejectReasons[index] = err;
                numRejected++;
                if (numRejected === promises.length) {
                    reject(rejectReasons);
                }
            });
        });
    });
}
exports.promiseAny = promiseAny;
/**
 * Maps a JS object to another JS object based on the translation function, the translation function is called for every
 *  property (value/key) of the old object and returns the new value of for this property
 *
 * @param obj
 * @param translator
 */
function objectMap(obj, translator) {
    const resp = {};
    for (let key in obj) {
        resp[key] = translator(obj[key], key);
    }
    return resp;
}
exports.objectMap = objectMap;
/**
 * Maps the entries from the map to the array using the translator function
 *
 * @param map
 * @param translator
 */
function mapToArray(map, translator) {
    const arr = Array(map.size);
    let pointer = 0;
    for (let entry of map.entries()) {
        arr[pointer++] = translator(entry[0], entry[1]);
    }
    return arr;
}
exports.mapToArray = mapToArray;
/**
 * Creates a new abort controller that will abort if the passed abort signal aborts
 *
 * @param abortSignal
 */
function extendAbortController(abortSignal) {
    const _abortController = new AbortController();
    if (abortSignal != null) {
        abortSignal.throwIfAborted();
        abortSignal.onabort = () => _abortController.abort(abortSignal.reason);
    }
    return _abortController;
}
exports.extendAbortController = extendAbortController;
/**
 * Runs the passed function multiple times if it fails
 *
 * @param func A callback for executing the action
 * @param func.retryCount Count of the current retry, starting from 0 for original request and increasing
 * @param retryPolicy Retry policy
 * @param retryPolicy.maxRetries How many retries to attempt in total
 * @param retryPolicy.delay How long should the delay be
 * @param retryPolicy.exponential Whether to use exponentially increasing delays
 * @param errorAllowed A callback for determining whether a given error is allowed, and we should therefore not retry
 * @param abortSignal
 * @returns Result of the action executing callback
 */
function tryWithRetries(func, retryPolicy, errorAllowed, abortSignal) {
    return __awaiter(this, void 0, void 0, function* () {
        retryPolicy = retryPolicy || {};
        retryPolicy.maxRetries = retryPolicy.maxRetries || 5;
        retryPolicy.delay = retryPolicy.delay || 500;
        retryPolicy.exponential = retryPolicy.exponential == null ? true : retryPolicy.exponential;
        let err = null;
        for (let i = 0; i < retryPolicy.maxRetries; i++) {
            try {
                return yield func(i);
            }
            catch (e) {
                if (errorAllowed != null && checkError(e, errorAllowed))
                    throw e;
                err = e;
                logger.warn("tryWithRetries(): Error on try number: " + i, e);
            }
            if (abortSignal != null && abortSignal.aborted)
                throw (abortSignal.reason || new Error("Aborted"));
            if (i !== retryPolicy.maxRetries - 1) {
                yield timeoutPromise(retryPolicy.exponential ? retryPolicy.delay * Math.pow(2, i) : retryPolicy.delay, abortSignal);
            }
        }
        throw err;
    });
}
exports.tryWithRetries = tryWithRetries;
/**
 * Mimics fetch API byt adds a timeout to the request
 *
 * @param input
 * @param init
 */
function fetchWithTimeout(input, init) {
    if (init == null)
        init = {};
    if (init.timeout != null)
        init.signal = timeoutSignal(init.timeout, new Error("Network request timed out"), init.signal);
    return fetch(input, init).catch(e => {
        if (e.name === "AbortError") {
            throw init.signal.reason;
        }
        else {
            throw e;
        }
    });
}
exports.fetchWithTimeout = fetchWithTimeout;
/**
 * Sends an HTTP GET request through a fetch API, handles non 200 response codes as errors
 * @param url Send request to this URL
 * @param timeout Timeout (in milliseconds) for the request to conclude
 * @param abortSignal
 * @param allowNon200 Whether to allow non-200 status code HTTP responses
 * @throws {RequestError} if non 200 response code was returned or body cannot be parsed
 */
function httpGet(url, timeout, abortSignal, allowNon200 = false) {
    return __awaiter(this, void 0, void 0, function* () {
        const init = {
            method: "GET",
            timeout,
            signal: abortSignal
        };
        const response = yield fetchWithTimeout(url, init);
        if (response.status !== 200) {
            let resp;
            try {
                resp = yield response.text();
            }
            catch (e) {
                throw new RequestError_1.RequestError(response.statusText, response.status);
            }
            if (allowNon200) {
                try {
                    return JSON.parse(resp);
                }
                catch (e) { }
            }
            throw RequestError_1.RequestError.parse(resp, response.status);
        }
        return yield response.json();
    });
}
exports.httpGet = httpGet;
/**
 * Sends an HTTP POST request through a fetch API, handles non 200 response codes as errors
 * @param url Send request to this URL
 * @param body A HTTP request body to send to the server
 * @param timeout Timeout (in milliseconds) for the request to conclude
 * @param abortSignal
 * @throws {RequestError} if non 200 response code was returned
 */
function httpPost(url, body, timeout, abortSignal) {
    return __awaiter(this, void 0, void 0, function* () {
        const init = {
            method: "POST",
            timeout,
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' },
            signal: abortSignal
        };
        const response = timeout == null ? yield fetch(url, init) : yield fetchWithTimeout(url, init);
        if (response.status !== 200) {
            let resp;
            try {
                resp = yield response.text();
            }
            catch (e) {
                throw new RequestError_1.RequestError(response.statusText, response.status);
            }
            throw RequestError_1.RequestError.parse(resp, response.status);
        }
        return yield response.json();
    });
}
exports.httpPost = httpPost;
/**
 * Returns a promise that resolves after given amount seconds
 *
 * @param timeout how many milliseconds to wait for
 * @param abortSignal
 */
function timeoutPromise(timeout, abortSignal) {
    return new Promise((resolve, reject) => {
        if (abortSignal != null && abortSignal.aborted) {
            reject(abortSignal.reason);
            return;
        }
        let timeoutHandle = setTimeout(resolve, timeout);
        if (abortSignal != null) {
            abortSignal.addEventListener("abort", () => {
                if (timeoutHandle != null)
                    clearTimeout(timeoutHandle);
                timeoutHandle = null;
                reject(abortSignal.reason);
            });
        }
    });
}
exports.timeoutPromise = timeoutPromise;
/**
 * Returns an abort signal that aborts after a specified timeout in milliseconds
 *
 * @param timeout Milliseconds to wait
 * @param abortReason Abort with this abort reason
 * @param abortSignal Abort signal to extend
 */
function timeoutSignal(timeout, abortReason, abortSignal) {
    if (timeout == null)
        return abortSignal;
    const abortController = new AbortController();
    const timeoutHandle = setTimeout(() => abortController.abort(abortReason || new Error("Timed out")), timeout);
    if (abortSignal != null) {
        abortSignal.addEventListener("abort", () => {
            clearTimeout(timeoutHandle);
            abortController.abort(abortSignal.reason);
        });
    }
    return abortController.signal;
}
exports.timeoutSignal = timeoutSignal;
