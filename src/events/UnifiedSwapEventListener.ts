import {
    ChainEvent,
    ChainType,
    SpvVaultClaimEvent, SpvVaultCloseEvent,
    SpvVaultEvent,
    SpvVaultFrontEvent,
    SwapEvent
} from "@atomiqlabs/base";
import {ISwap} from "../swaps/ISwap";
import {EventListener} from "@atomiqlabs/base/src/events/ChainEvents";
import {SwapType} from "../swaps/enums/SwapType";
import {UnifiedSwapStorage} from "../storage/UnifiedSwapStorage";

function chainEventToEscrowHash(event: ChainEvent<any>) {
    if(event instanceof SwapEvent) return event.escrowHash;
    if(
        event instanceof SpvVaultFrontEvent ||
        event instanceof SpvVaultClaimEvent ||
        event instanceof SpvVaultCloseEvent
    ) return event.btcTxId;
}

export type SwapEventListener<
    T extends ChainType,
    S extends ISwap<T>
> = (event: ChainEvent<T["Data"]>, swap: S) => Promise<void>;

export class UnifiedSwapEventListener<
    T extends ChainType
> {

    readonly storage: UnifiedSwapStorage<T>;
    readonly events: T["Events"];
    readonly listeners: {
        [key in SwapType]?: {
            listener: SwapEventListener<T, any>,
            reviver: new (obj: any) => ISwap<T>
        }
    } = {};

    constructor(unifiedStorage: UnifiedSwapStorage<T>, events: T["Events"]) {
        this.storage = unifiedStorage;
        this.events = events;
    }

    async processEvents(events: ChainEvent<T["Data"]>[]) {
        const swapsByEscrowHash: {[key: string]: ISwap<T>} = {};
        events.forEach(event => {
            swapsByEscrowHash[chainEventToEscrowHash(event)] = null;
        });

        const swaps = await this.storage.query<ISwap<T>>(
            [
                [{key: "escrowHash", value: Object.keys(swapsByEscrowHash)}]
            ],
            (val: any) => {
                const obj = this.listeners[val.type];
                if(obj==null) return null;
                return new obj.reviver(val);
            }
        );
        swaps.forEach(swap => swapsByEscrowHash[swap._getEscrowHash()] = swap);

        for(let event of events) {
            const swap = swapsByEscrowHash[chainEventToEscrowHash(event)];
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
        await this.events.init();
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
