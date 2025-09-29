"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctClock = void 0;
const Utils_1 = require("./Utils");
const urls = ["https://api.atomiq.exchange/"];
async function correctClock() {
    const dateNow = Date._now ?? Date.now;
    const dateStart = dateNow();
    let result = await Promise.all(urls.map(async (url) => {
        try {
            const timeStart = performance.now();
            const resp = await fetch(url, { method: "HEAD", signal: (0, Utils_1.timeoutSignal)(3000) });
            const timeDelta = performance.now() - timeStart;
            const dateHeaderValue = resp.headers.get("Date");
            if (dateHeaderValue == null)
                throw new Error("Date header not returned!");
            return { delta: timeDelta, date: new Date(dateHeaderValue).getTime() };
        }
        catch (e) {
            console.error(`AutomaticClockDriftCorrection: correctClock(): Failed to get time from ${url}`, e);
            return null;
        }
    }));
    result = result.filter(val => val != null);
    if (result.length == 0)
        throw new Error("Cannot sync time! All servers responded negatively!");
    result.sort((a, b) => a.delta - b.delta);
    const desiredTime = Math.floor(result[0].date - (result[0].delta / 2));
    const timeDrift = dateStart - desiredTime;
    console.log(`AutomaticClockDriftCorrection: correctClock(): Time correction current: ${dateStart}, server: ${desiredTime}, timeDrift: ${timeDrift}`);
    if (Math.abs(timeDrift) < 2000) {
        console.log("AutomaticClockDriftCorrection: correctClock(): Time drift too small, not adjusting!");
        return;
    }
    Date._now = dateNow;
    Date.now = () => {
        return dateNow() - timeDrift;
    };
}
exports.correctClock = correctClock;
