/**
 * An error or inconsistency in the intermediary's returned data, this will blacklist the intermediary
 */
export declare class IntermediaryError extends Error {
    constructor(msg: string);
}
