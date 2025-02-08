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
exports.IntermediaryAPI = exports.PaymentAuthorizationResponseCodes = exports.RefundAuthorizationResponseCodes = void 0;
const RequestError_1 = require("../errors/RequestError");
const SchemaVerifier_1 = require("../utils/paramcoders/SchemaVerifier");
const StreamingFetchPromise_1 = require("../utils/paramcoders/client/StreamingFetchPromise");
const Utils_1 = require("../utils/Utils");
const randomBytes = require("randombytes");
var RefundAuthorizationResponseCodes;
(function (RefundAuthorizationResponseCodes) {
    RefundAuthorizationResponseCodes[RefundAuthorizationResponseCodes["EXPIRED"] = 20010] = "EXPIRED";
    RefundAuthorizationResponseCodes[RefundAuthorizationResponseCodes["REFUND_DATA"] = 20000] = "REFUND_DATA";
    RefundAuthorizationResponseCodes[RefundAuthorizationResponseCodes["NOT_FOUND"] = 20007] = "NOT_FOUND";
    RefundAuthorizationResponseCodes[RefundAuthorizationResponseCodes["PENDING"] = 20008] = "PENDING";
    RefundAuthorizationResponseCodes[RefundAuthorizationResponseCodes["PAID"] = 20006] = "PAID";
})(RefundAuthorizationResponseCodes = exports.RefundAuthorizationResponseCodes || (exports.RefundAuthorizationResponseCodes = {}));
var PaymentAuthorizationResponseCodes;
(function (PaymentAuthorizationResponseCodes) {
    PaymentAuthorizationResponseCodes[PaymentAuthorizationResponseCodes["AUTH_DATA"] = 10000] = "AUTH_DATA";
    PaymentAuthorizationResponseCodes[PaymentAuthorizationResponseCodes["EXPIRED"] = 10001] = "EXPIRED";
    PaymentAuthorizationResponseCodes[PaymentAuthorizationResponseCodes["PAID"] = 10002] = "PAID";
    PaymentAuthorizationResponseCodes[PaymentAuthorizationResponseCodes["PENDING"] = 10003] = "PENDING";
    PaymentAuthorizationResponseCodes[PaymentAuthorizationResponseCodes["ALREADY_COMMITTED"] = 10004] = "ALREADY_COMMITTED";
})(PaymentAuthorizationResponseCodes = exports.PaymentAuthorizationResponseCodes || (exports.PaymentAuthorizationResponseCodes = {}));
const SwapResponseSchema = {
    data: SchemaVerifier_1.FieldTypeEnum.Any,
    prefix: SchemaVerifier_1.FieldTypeEnum.String,
    timeout: SchemaVerifier_1.FieldTypeEnum.String,
    signature: SchemaVerifier_1.FieldTypeEnum.String
};
/////////////////////////
///// To BTC
const ToBTCResponseSchema = Object.assign({ amount: SchemaVerifier_1.FieldTypeEnum.BN, address: SchemaVerifier_1.FieldTypeEnum.String, satsPervByte: SchemaVerifier_1.FieldTypeEnum.BN, networkFee: SchemaVerifier_1.FieldTypeEnum.BN, swapFee: SchemaVerifier_1.FieldTypeEnum.BN, totalFee: SchemaVerifier_1.FieldTypeEnum.BN, total: SchemaVerifier_1.FieldTypeEnum.BN, minRequiredExpiry: SchemaVerifier_1.FieldTypeEnum.BN }, SwapResponseSchema);
/////////////////////////
///// To BTCLN
const ToBTCLNResponseSchema = Object.assign({ maxFee: SchemaVerifier_1.FieldTypeEnum.BN, swapFee: SchemaVerifier_1.FieldTypeEnum.BN, total: SchemaVerifier_1.FieldTypeEnum.BN, confidence: SchemaVerifier_1.FieldTypeEnum.Number, address: SchemaVerifier_1.FieldTypeEnum.String, routingFeeSats: SchemaVerifier_1.FieldTypeEnum.BN }, SwapResponseSchema);
const ToBTCLNPrepareExactInSchema = {
    amount: SchemaVerifier_1.FieldTypeEnum.BN,
    reqId: SchemaVerifier_1.FieldTypeEnum.String
};
/////////////////////////
///// From BTC
const FromBTCResponseSchema = Object.assign({ amount: SchemaVerifier_1.FieldTypeEnum.BN, btcAddress: SchemaVerifier_1.FieldTypeEnum.String, address: SchemaVerifier_1.FieldTypeEnum.String, swapFee: SchemaVerifier_1.FieldTypeEnum.BN, total: SchemaVerifier_1.FieldTypeEnum.BN, confirmations: SchemaVerifier_1.FieldTypeEnum.NumberOptional }, SwapResponseSchema);
/////////////////////////
///// From BTCLN
const FromBTCLNResponseSchema = {
    pr: SchemaVerifier_1.FieldTypeEnum.String,
    swapFee: SchemaVerifier_1.FieldTypeEnum.BN,
    total: SchemaVerifier_1.FieldTypeEnum.BN,
    intermediaryKey: SchemaVerifier_1.FieldTypeEnum.String,
    securityDeposit: SchemaVerifier_1.FieldTypeEnum.BN
};
class IntermediaryAPI {
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
    static getIntermediaryInfo(baseUrl, timeout, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            const nonce = randomBytes(32).toString("hex");
            const response = yield (0, Utils_1.httpPost)(baseUrl + "/info", {
                nonce,
            }, timeout, abortSignal);
            const info = JSON.parse(response.envelope);
            if (nonce !== info.nonce)
                throw new Error("Invalid response - nonce");
            return response;
        });
    }
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
    static getRefundAuthorization(url, paymentHash, sequence, timeout, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, Utils_1.tryWithRetries)(() => (0, Utils_1.httpGet)(url + "/getRefundAuthorization" +
                "?paymentHash=" + encodeURIComponent(paymentHash) +
                "&sequence=" + encodeURIComponent(sequence.toString(10)), timeout, abortSignal), null, RequestError_1.RequestError, abortSignal);
        });
    }
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
    static getPaymentAuthorization(url, paymentHash, timeout, abortSignal) {
        return __awaiter(this, void 0, void 0, function* () {
            return (0, Utils_1.tryWithRetries)(() => (0, Utils_1.httpGet)(url + "/getInvoicePaymentAuth" +
                "?paymentHash=" + encodeURIComponent(paymentHash), timeout, abortSignal), null, RequestError_1.RequestError, abortSignal);
        });
    }
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
    static initToBTC(chainIdentifier, baseUrl, init, timeout, abortSignal, streamRequest) {
        const responseBodyPromise = (0, StreamingFetchPromise_1.streamingFetchPromise)(baseUrl + "/tobtc/payInvoice?chain=" + encodeURIComponent(chainIdentifier), Object.assign(Object.assign({}, init.additionalParams), { address: init.btcAddress, amount: init.amount.toString(10), exactIn: init.exactIn, confirmationTarget: init.confirmationTarget, confirmations: init.confirmations, nonce: init.nonce.toString(10), token: init.token, offerer: init.offerer, feeRate: init.feeRate }), {
            code: SchemaVerifier_1.FieldTypeEnum.Number,
            msg: SchemaVerifier_1.FieldTypeEnum.String,
            data: SchemaVerifier_1.FieldTypeEnum.AnyOptional,
            signDataPrefetch: SchemaVerifier_1.FieldTypeEnum.AnyOptional
        }, timeout, abortSignal, streamRequest);
        return {
            signDataPrefetch: responseBodyPromise.then(responseBody => responseBody.signDataPrefetch),
            response: responseBodyPromise.then((responseBody) => Promise.all([
                responseBody.code,
                responseBody.msg,
                responseBody.data,
            ])).then(([code, msg, data]) => {
                if (code !== 20000) {
                    throw RequestError_1.RequestError.parse(JSON.stringify({ code, msg, data }), 400);
                }
                return (0, SchemaVerifier_1.verifySchema)(data, ToBTCResponseSchema);
            })
        };
    }
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
    static initFromBTC(chainIdentifier, baseUrl, init, timeout, abortSignal, streamRequest) {
        const responseBodyPromise = (0, StreamingFetchPromise_1.streamingFetchPromise)(baseUrl + "/frombtc/getAddress?chain=" + encodeURIComponent(chainIdentifier), Object.assign(Object.assign({}, init.additionalParams), { address: init.claimer, amount: init.amount.toString(10), token: init.token, exactOut: init.exactOut, sequence: init.sequence.toString(10), claimerBounty: init.claimerBounty.then(claimerBounty => {
                return {
                    feePerBlock: claimerBounty.feePerBlock.toString(10),
                    safetyFactor: claimerBounty.safetyFactor,
                    startTimestamp: claimerBounty.startTimestamp.toString(10),
                    addBlock: claimerBounty.addBlock,
                    addFee: claimerBounty.addFee.toString(10)
                };
            }), feeRate: init.feeRate }), {
            code: SchemaVerifier_1.FieldTypeEnum.Number,
            msg: SchemaVerifier_1.FieldTypeEnum.String,
            data: SchemaVerifier_1.FieldTypeEnum.AnyOptional,
            signDataPrefetch: SchemaVerifier_1.FieldTypeEnum.AnyOptional
        }, timeout, abortSignal, streamRequest);
        return {
            signDataPrefetch: responseBodyPromise.then(responseBody => responseBody.signDataPrefetch),
            response: responseBodyPromise.then((responseBody) => Promise.all([
                responseBody.code,
                responseBody.msg,
                responseBody.data,
            ])).then(([code, msg, data]) => {
                if (code !== 20000) {
                    throw RequestError_1.RequestError.parse(JSON.stringify({ code, msg, data }), 400);
                }
                return (0, SchemaVerifier_1.verifySchema)(data, FromBTCResponseSchema);
            })
        };
    }
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
    static initFromBTCLN(chainIdentifier, baseUrl, init, timeout, abortSignal, streamRequest) {
        const responseBodyPromise = (0, StreamingFetchPromise_1.streamingFetchPromise)(baseUrl + "/frombtcln/createInvoice?chain=" + encodeURIComponent(chainIdentifier), Object.assign(Object.assign({}, init.additionalParams), { paymentHash: init.paymentHash.toString("hex"), amount: init.amount.toString(), address: init.claimer, token: init.token, descriptionHash: init.descriptionHash == null ? null : init.descriptionHash.toString("hex"), exactOut: init.exactOut, feeRate: init.feeRate }), {
            code: SchemaVerifier_1.FieldTypeEnum.Number,
            msg: SchemaVerifier_1.FieldTypeEnum.String,
            data: SchemaVerifier_1.FieldTypeEnum.AnyOptional,
            lnPublicKey: SchemaVerifier_1.FieldTypeEnum.StringOptional
        }, timeout, abortSignal, streamRequest);
        return {
            lnPublicKey: responseBodyPromise.then(responseBody => responseBody.lnPublicKey),
            response: responseBodyPromise.then((responseBody) => Promise.all([
                responseBody.code,
                responseBody.msg,
                responseBody.data,
            ])).then(([code, msg, data]) => {
                if (code !== 20000) {
                    throw RequestError_1.RequestError.parse(JSON.stringify({ code, msg, data }), 400);
                }
                return (0, SchemaVerifier_1.verifySchema)(data, FromBTCLNResponseSchema);
            })
        };
    }
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
    static initToBTCLN(chainIdentifier, baseUrl, init, timeout, abortSignal, streamRequest) {
        const responseBodyPromise = (0, StreamingFetchPromise_1.streamingFetchPromise)(baseUrl + "/tobtcln/payInvoice?chain=" + encodeURIComponent(chainIdentifier), Object.assign(Object.assign({ exactIn: false }, init.additionalParams), { pr: init.pr, maxFee: init.maxFee.toString(10), expiryTimestamp: init.expiryTimestamp.toString(10), token: init.token, offerer: init.offerer, feeRate: init.feeRate, amount: null }), {
            code: SchemaVerifier_1.FieldTypeEnum.Number,
            msg: SchemaVerifier_1.FieldTypeEnum.String,
            data: SchemaVerifier_1.FieldTypeEnum.AnyOptional,
            signDataPrefetch: SchemaVerifier_1.FieldTypeEnum.AnyOptional
        }, timeout, abortSignal, streamRequest);
        return {
            signDataPrefetch: responseBodyPromise.then(responseBody => responseBody.signDataPrefetch),
            response: responseBodyPromise.then((responseBody) => Promise.all([
                responseBody.code,
                responseBody.msg,
                responseBody.data,
            ])).then(([code, msg, data]) => {
                if (code !== 20000) {
                    throw RequestError_1.RequestError.parse(JSON.stringify({ code, msg, data }), 400);
                }
                return (0, SchemaVerifier_1.verifySchema)(data, ToBTCLNResponseSchema);
            })
        };
    }
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
    static initToBTCLNExactIn(baseUrl, init, timeout, abortSignal, streamRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            const responseBody = yield (0, StreamingFetchPromise_1.streamingFetchPromise)(baseUrl + "/tobtcln/payInvoiceExactIn", Object.assign(Object.assign({}, init.additionalParams), { pr: init.pr, reqId: init.reqId, feeRate: init.feeRate }), {
                code: SchemaVerifier_1.FieldTypeEnum.Number,
                msg: SchemaVerifier_1.FieldTypeEnum.String,
                data: SchemaVerifier_1.FieldTypeEnum.AnyOptional
            }, timeout, abortSignal, streamRequest);
            const [code, msg, data] = yield Promise.all([
                responseBody.code,
                responseBody.msg,
                responseBody.data,
            ]);
            if (code !== 20000)
                throw RequestError_1.RequestError.parse(JSON.stringify({ code, msg, data }), 400);
            return (0, SchemaVerifier_1.verifySchema)(data, ToBTCLNResponseSchema);
        });
    }
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
    static prepareToBTCLNExactIn(chainIdentifier, baseUrl, init, timeout, abortSignal, streamRequest) {
        const responseBodyPromise = (0, StreamingFetchPromise_1.streamingFetchPromise)(baseUrl + "/tobtcln/payInvoice?chain=" + encodeURIComponent(chainIdentifier), Object.assign(Object.assign({ exactIn: true }, init.additionalParams), { pr: init.pr, maxFee: init.maxFee.toString(10), expiryTimestamp: init.expiryTimestamp.toString(10), token: init.token, offerer: init.offerer, amount: init.amount.toString(10) }), {
            code: SchemaVerifier_1.FieldTypeEnum.Number,
            msg: SchemaVerifier_1.FieldTypeEnum.String,
            data: SchemaVerifier_1.FieldTypeEnum.AnyOptional,
            signDataPrefetch: SchemaVerifier_1.FieldTypeEnum.AnyOptional
        }, timeout, abortSignal, streamRequest);
        return {
            signDataPrefetch: responseBodyPromise.then(responseBody => responseBody.signDataPrefetch),
            response: responseBodyPromise.then((responseBody) => Promise.all([
                responseBody.code,
                responseBody.msg,
                responseBody.data,
            ])).then(([code, msg, data]) => {
                if (code !== 20000) {
                    throw RequestError_1.RequestError.parse(JSON.stringify({ code, msg, data }), 400);
                }
                return (0, SchemaVerifier_1.verifySchema)(data, ToBTCLNPrepareExactInSchema);
            })
        };
    }
}
exports.IntermediaryAPI = IntermediaryAPI;
