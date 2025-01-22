"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntermediaryError = void 0;
/**
 * An error or inconsistency in the intermediary's returned data, this will blacklist the intermediary
 */
class IntermediaryError extends Error {
    constructor(msg) {
        super(msg);
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, IntermediaryError.prototype);
    }
}
exports.IntermediaryError = IntermediaryError;
