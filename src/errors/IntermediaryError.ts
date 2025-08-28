/**
 * An error or inconsistency in the intermediary's returned data, this will blacklist the intermediary
 */
export class IntermediaryError extends Error {

    recoverable: boolean;

    constructor(msg: string, recoverable: boolean = false) {
        super(msg);
        this.recoverable = recoverable;
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, IntermediaryError.prototype);
    }

}
