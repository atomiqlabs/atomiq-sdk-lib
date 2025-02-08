/// <reference types="node" />
/// <reference types="node" />
import * as BN from "bn.js";
import { FieldTypeEnum, RequestSchemaResult } from "../utils/paramcoders/SchemaVerifier";
export type InfoHandlerResponse = {
    address: string;
    envelope: string;
    signature: string;
    chains: {
        [chainIdentifier: string]: {
            address: string;
            signature: string;
        };
    };
};
export declare enum RefundAuthorizationResponseCodes {
    EXPIRED = 20010,
    REFUND_DATA = 20000,
    NOT_FOUND = 20007,
    PENDING = 20008,
    PAID = 20006
}
export declare enum PaymentAuthorizationResponseCodes {
    AUTH_DATA = 10000,
    EXPIRED = 10001,
    PAID = 10002,
    PENDING = 10003,
    ALREADY_COMMITTED = 10004
}
export type RefundAuthorizationResponse = {
    code: RefundAuthorizationResponseCodes.PAID;
    msg: string;
    data: {
        secret?: string;
        txId?: string;
    };
} | {
    code: RefundAuthorizationResponseCodes.REFUND_DATA;
    msg: string;
    data: {
        address: string;
        prefix: string;
        timeout: string;
        signature: string;
    };
} | {
    code: Exclude<RefundAuthorizationResponseCodes, RefundAuthorizationResponseCodes.PAID | RefundAuthorizationResponseCodes.REFUND_DATA>;
    msg: string;
};
export type PaymentAuthorizationResponse = {
    code: PaymentAuthorizationResponseCodes.AUTH_DATA;
    msg: string;
    data: {
        address: string;
        data: any;
        nonce: number;
        prefix: string;
        timeout: string;
        signature: string;
    };
} | {
    code: Exclude<PaymentAuthorizationResponseCodes, PaymentAuthorizationResponseCodes.AUTH_DATA>;
    msg: string;
};
export type SwapInit = {
    token: string;
    additionalParams?: {
        [name: string]: any;
    };
};
export type BaseFromBTCSwapInit = SwapInit & {
    claimer: string;
    amount: BN;
    exactOut: boolean;
    feeRate: Promise<string>;
};
export type BaseToBTCSwapInit = SwapInit & {
    offerer: string;
};
declare const ToBTCResponseSchema: {
    readonly data: FieldTypeEnum.Any;
    readonly prefix: FieldTypeEnum.String;
    readonly timeout: FieldTypeEnum.String;
    readonly signature: FieldTypeEnum.String;
    readonly amount: FieldTypeEnum.BN;
    readonly address: FieldTypeEnum.String;
    readonly satsPervByte: FieldTypeEnum.BN;
    readonly networkFee: FieldTypeEnum.BN;
    readonly swapFee: FieldTypeEnum.BN;
    readonly totalFee: FieldTypeEnum.BN;
    readonly total: FieldTypeEnum.BN;
    readonly minRequiredExpiry: FieldTypeEnum.BN;
};
export type ToBTCResponseType = RequestSchemaResult<typeof ToBTCResponseSchema>;
export type ToBTCInit = BaseToBTCSwapInit & {
    btcAddress: string;
    exactIn: boolean;
    amount: BN;
    confirmationTarget: number;
    confirmations: number;
    nonce: BN;
    feeRate: Promise<string>;
};
declare const ToBTCLNResponseSchema: {
    readonly data: FieldTypeEnum.Any;
    readonly prefix: FieldTypeEnum.String;
    readonly timeout: FieldTypeEnum.String;
    readonly signature: FieldTypeEnum.String;
    readonly maxFee: FieldTypeEnum.BN;
    readonly swapFee: FieldTypeEnum.BN;
    readonly total: FieldTypeEnum.BN;
    readonly confidence: FieldTypeEnum.Number;
    readonly address: FieldTypeEnum.String;
    readonly routingFeeSats: FieldTypeEnum.BN;
};
export type ToBTCLNResponseType = RequestSchemaResult<typeof ToBTCLNResponseSchema>;
export type ToBTCLNInit = BaseToBTCSwapInit & {
    pr: string;
    maxFee: BN;
    expiryTimestamp: BN;
    feeRate: Promise<any>;
};
declare const ToBTCLNPrepareExactInSchema: {
    readonly amount: FieldTypeEnum.BN;
    readonly reqId: FieldTypeEnum.String;
};
export type ToBTCLNPrepareExactInResponseType = RequestSchemaResult<typeof ToBTCLNPrepareExactInSchema>;
export type ToBTCLNPrepareExactIn = BaseToBTCSwapInit & {
    pr: string;
    amount: BN;
    maxFee: BN;
    expiryTimestamp: BN;
};
export type ToBTCLNInitExactIn = {
    pr: string;
    reqId: string;
    feeRate: Promise<any>;
    additionalParams?: {
        [name: string]: any;
    };
};
declare const FromBTCResponseSchema: {
    readonly data: FieldTypeEnum.Any;
    readonly prefix: FieldTypeEnum.String;
    readonly timeout: FieldTypeEnum.String;
    readonly signature: FieldTypeEnum.String;
    readonly amount: FieldTypeEnum.BN;
    readonly btcAddress: FieldTypeEnum.String;
    readonly address: FieldTypeEnum.String;
    readonly swapFee: FieldTypeEnum.BN;
    readonly total: FieldTypeEnum.BN;
    readonly confirmations: FieldTypeEnum.NumberOptional;
};
export type FromBTCResponseType = RequestSchemaResult<typeof FromBTCResponseSchema>;
export type FromBTCInit = BaseFromBTCSwapInit & {
    sequence: BN;
    claimerBounty: Promise<{
        feePerBlock: BN;
        safetyFactor: number;
        startTimestamp: BN;
        addBlock: number;
        addFee: BN;
    }>;
};
declare const FromBTCLNResponseSchema: {
    pr: FieldTypeEnum;
    swapFee: FieldTypeEnum;
    total: FieldTypeEnum;
    intermediaryKey: FieldTypeEnum;
    securityDeposit: FieldTypeEnum;
};
export type FromBTCLNResponseType = RequestSchemaResult<typeof FromBTCLNResponseSchema>;
export type FromBTCLNInit = BaseFromBTCSwapInit & {
    paymentHash: Buffer;
    descriptionHash?: Buffer;
};
export declare class IntermediaryAPI {
    /**
     * Returns the information about a specific intermediary
     *
     * @param baseUrl Base URL of the intermediary
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     *
     * @throws {RequestError} If non-200 http response code is returned
     * @throws {Error} If the supplied nonce doesn't match the response
     */
    static getIntermediaryInfo(baseUrl: string, timeout?: number, abortSignal?: AbortSignal): Promise<InfoHandlerResponse>;
    /**
     * Returns the information about an outcome of the To BTC swap
     *
     * @param url URL of the intermediary
     * @param paymentHash Payment hash of the swap
     * @param sequence Swap's sequence number
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static getRefundAuthorization(url: string, paymentHash: string, sequence: BN, timeout?: number, abortSignal?: AbortSignal): Promise<RefundAuthorizationResponse>;
    /**
     * Returns the information about the payment of the From BTCLN swaps
     *
     * @param url URL of the intermediary
     * @param paymentHash Payment hash of the swap
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static getPaymentAuthorization(url: string, paymentHash: string, timeout?: number, abortSignal?: AbortSignal): Promise<PaymentAuthorizationResponse>;
    /**
     * Initiate To BTC swap with an intermediary
     *
     * @param chainIdentifier
     * @param baseUrl Base URL of the intermediary
     * @param init Swap initialization parameters
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     * @param streamRequest Whether to force streaming (or not streaming) the request, default is autodetect
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static initToBTC(chainIdentifier: string, baseUrl: string, init: ToBTCInit, timeout?: number, abortSignal?: AbortSignal, streamRequest?: boolean): {
        signDataPrefetch: Promise<any>;
        response: Promise<ToBTCResponseType>;
    };
    /**
     * Initiate From BTC swap with an intermediary
     *
     * @param chainIdentifier
     * @param baseUrl Base URL of the intermediary
     * @param init Swap initialization parameters
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     * @param streamRequest Whether to force streaming (or not streaming) the request, default is autodetect
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static initFromBTC(chainIdentifier: string, baseUrl: string, init: FromBTCInit, timeout?: number, abortSignal?: AbortSignal, streamRequest?: boolean): {
        signDataPrefetch: Promise<any>;
        response: Promise<FromBTCResponseType>;
    };
    /**
     * Initiate From BTCLN swap with an intermediary
     *
     * @param chainIdentifier
     * @param baseUrl Base URL of the intermediary
     * @param init Swap initialization parameters
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     * @param streamRequest Whether to force streaming (or not streaming) the request, default is autodetect
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static initFromBTCLN(chainIdentifier: string, baseUrl: string, init: FromBTCLNInit, timeout?: number, abortSignal?: AbortSignal, streamRequest?: boolean): {
        lnPublicKey: Promise<string>;
        response: Promise<FromBTCLNResponseType>;
    };
    /**
     * Initiate To BTCLN swap with an intermediary
     *
     * @param chainIdentifier
     * @param baseUrl Base URL of the intermediary
     * @param init Swap initialization parameters
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     * @param streamRequest Whether to force streaming (or not streaming) the request, default is autodetect
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static initToBTCLN(chainIdentifier: string, baseUrl: string, init: ToBTCLNInit, timeout?: number, abortSignal?: AbortSignal, streamRequest?: boolean): {
        signDataPrefetch: Promise<any>;
        response: Promise<ToBTCLNResponseType>;
    };
    /**
     * Initiate To BTCLN exact in swap with an intermediary
     *
     * @param baseUrl Base URL of the intermediary
     * @param init Swap initialization parameters
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     * @param streamRequest Whether to force streaming (or not streaming) the request, default is autodetect
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static initToBTCLNExactIn(baseUrl: string, init: ToBTCLNInitExactIn, timeout?: number, abortSignal?: AbortSignal, streamRequest?: boolean): Promise<ToBTCLNResponseType>;
    /**
     * Prepare To BTCLN exact in swap with an intermediary
     *
     * @param chainIdentifier
     * @param baseUrl Base URL of the intermediary
     * @param init Swap initialization parameters
     * @param timeout Timeout in milliseconds for the HTTP request
     * @param abortSignal
     * @param streamRequest Whether to force streaming (or not streaming) the request, default is autodetect
     *
     * @throws {RequestError} If non-200 http response code is returned
     */
    static prepareToBTCLNExactIn(chainIdentifier: string, baseUrl: string, init: ToBTCLNPrepareExactIn, timeout?: number, abortSignal?: AbortSignal, streamRequest?: boolean): {
        signDataPrefetch: Promise<any>;
        response: Promise<ToBTCLNPrepareExactInResponseType>;
    };
}
export {};
