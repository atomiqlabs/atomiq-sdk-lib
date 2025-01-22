import * as BN from "bn.js";
/**
 * An error returned by the intermediary in a http response
 */
export declare class RequestError extends Error {
    httpCode: number;
    constructor(msg: string, httpCode: number);
    static parse(msg: string, httpCode: number): RequestError;
}
/**
 * An error indicating out of bounds (amount too high or too low) on swap initialization
 */
export declare class OutOfBoundsError extends RequestError {
    min: BN;
    max: BN;
    constructor(msg: string, httpCode: number, min: BN, max: BN);
}
