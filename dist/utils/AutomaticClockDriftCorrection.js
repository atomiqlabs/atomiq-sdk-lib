"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctClock = void 0;
const Utils_1 = require("./Utils");
const headerUrls = ["https://api.atomiq.exchange/"];
async function getHeaderTimestamp(url) {
    const timeStart = performance.now();
    const resp = await fetch(url, { method: "HEAD", signal: (0, Utils_1.timeoutSignal)(3000) });
    const timeDelta = performance.now() - timeStart;
    const dateHeaderValue = resp.headers.get("Date");
    if (dateHeaderValue == null)
        throw new Error("Date header not returned!");
    return { delta: timeDelta, timestamp: new Date(dateHeaderValue).getTime() };
}
async function getAisenseApiTimestamp() {
    const timeStart = performance.now();
    const resp = await fetch("https://aisenseapi.com/services/v1/timestamp", { signal: (0, Utils_1.timeoutSignal)(3000) });
    const timeDelta = performance.now() - timeStart;
    const obj = await resp.json();
    if (obj == null || obj.timestamp == null)
        throw new Error("Timestamp not returned!");
    return { delta: timeDelta, timestamp: Math.floor(obj.timestamp * 1000) };
}
async function correctClock() {
    const dateNow = Date._now ?? Date.now;
    const dateStart = performance.now();
    let result = await Promise.all([
        ...headerUrls.map(url => getHeaderTimestamp(url).catch(e => {
            console.error(`AutomaticClockDriftCorrection: correctClock(header): Failed to get time from ${url}`, e);
            return null;
        })),
        getAisenseApiTimestamp().catch(e => {
            console.error(`AutomaticClockDriftCorrection: correctClock(aisenseApi): Failed to get time from aisenseapi.com`, e);
            return null;
        })
    ]);
    result = result.filter(val => val != null);
    if (result.length == 0)
        throw new Error("Cannot sync time! All servers responded negatively!");
    result.sort((a, b) => a.delta - b.delta);
    const desiredTime = result[0].timestamp - (result[0].delta / 2);
    if (Math.abs(Date.now() - desiredTime) < 2000) {
        console.log("AutomaticClockDriftCorrection: correctClock(): Time drift too small, not adjusting!");
        return;
    }
    const timeDrift = dateStart - desiredTime;
    console.log(`AutomaticClockDriftCorrection: correctClock(): Time correction perf.now: ${dateStart}, server: ${desiredTime}, time diff: ${timeDrift}`);
    Date._now = dateNow;
    Date.now = () => {
        return Math.floor(performance.now() - timeDrift);
    };
}
exports.correctClock = correctClock;
