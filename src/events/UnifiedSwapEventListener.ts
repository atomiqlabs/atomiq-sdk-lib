import {ISwapStorage} from "../swap-storage/ISwapStorage";
import {ChainType, SwapEvent} from "@atomiqlabs/base";
import {ISwap} from "../swaps/ISwap";
import {EventListener} from "@atomiqlabs/base/src/events/ChainEvents";
import {SwapType} from "../swaps/SwapType";

export type SwapEventListener<
    T extends ChainType,
    S extends ISwap<T>
> = (event: SwapEvent<T["Data"]>, swap: S) => Promise<void>;

export class UnifiedSwapEventListener<
    T extends ChainType
> {

    readonly storage: ISwapStorage<ISwap<T>>;
    readonly events: T["Events"];
    readonly listeners: {
        [key in SwapType]?: {
            listener: SwapEventListener<T, any>,
            reviver: new (obj: any) => ISwap<T>
        }
    } = {};

    constructor(unifiedStorage: ISwapStorage<ISwap<T>>, events: T["Events"]) {
        this.storage = unifiedStorage;
        this.events = events;
    }

    async processEvents(events: SwapEvent<T["Data"]>[]) {
        const escrowHashes = events.map(event => [{key: "escrowHash", value: event.escrowHash}]);
        const swaps = await this.storage.query<ISwap<T>>(escrowHashes, (val: any) => {
            const obj = this.listeners[val.type];
            if(obj==null) return null;
            return new obj.reviver(val);
        });
        const swapsObj: {[key: string]: ISwap<T>} = {};
        swaps.forEach(swap => swapsObj[swap.getEscrowHash()] = swap);

        for(let event of events) {
            const swap = swapsObj[event.escrowHash];
            if(swap==null) continue;
            const obj = this.listeners[swap.getType()];
            if(obj==null) continue;
            await obj.listener(event, swap);
        }
    }

    listener: EventListener<T["Data"]>;
    async start() {
        if(this.listener!=null) return;
        await this.storage.init();
        this.events.registerListener(this.listener = async (events) => {
            await this.processEvents(events);
            return true;
        });
    }

    stop() {
        this.events.unregisterListener(this.listener);
    }

    registerListener<S extends ISwap<T>>(type: SwapType, listener: SwapEventListener<T, S>, reviver: new (val: any) => S): void {
        this.listeners[type] = {
            listener,
            reviver
        };
    }

    unregisterListener(type: SwapType): boolean {
        if(this.listeners[type]) return false;
        delete this.listeners[type];
        return true;
    }

}
