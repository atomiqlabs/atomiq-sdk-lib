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
exports.ResponseParamDecoder = void 0;
const ParamDecoder_1 = require("../ParamDecoder");
const buffer_1 = require("buffer");
class ResponseParamDecoder extends ParamDecoder_1.ParamDecoder {
    constructor(resp, abortSignal) {
        super();
        this.abortSignal = abortSignal;
        try {
            //Read from stream
            this.reader = resp.body.getReader();
            this.readResponse();
        }
        catch (e) {
            //Read in one piece
            resp.arrayBuffer().then(respBuffer => {
                super.onData(buffer_1.Buffer.from(respBuffer));
                super.onEnd();
            }).catch(e => {
                super.onError(e);
            });
        }
        if (abortSignal != null)
            abortSignal.addEventListener("abort", () => {
                super.onError(abortSignal.reason);
                if (!this.reader.closed)
                    this.reader.cancel(abortSignal.reason);
            });
    }
    /**
     * Keeps reading the response until the reader closes
     * @private
     */
    readResponse() {
        const _super = Object.create(null, {
            onEnd: { get: () => super.onEnd },
            onData: { get: () => super.onData }
        });
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                const readResp = yield this.reader.read().catch(e => {
                    console.error(e);
                    return null;
                });
                if (this.abortSignal != null && this.abortSignal.aborted)
                    return;
                if (readResp == null || readResp.done) {
                    _super.onEnd.call(this);
                    return;
                }
                _super.onData.call(this, buffer_1.Buffer.from(readResp.value));
            }
        });
    }
}
exports.ResponseParamDecoder = ResponseParamDecoder;
