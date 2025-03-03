import { ISwapStorage } from "../swap-storage/ISwapStorage";
import { ChainType, SwapEvent } from "@atomiqlabs/base";
import { ISwap } from "../swaps/ISwap";
import { EventListener } from "@atomiqlabs/base/src/events/ChainEvents";
import { SwapType } from "../swaps/SwapType";
export type SwapEventListener<T extends ChainType, S extends ISwap<T>> = (event: SwapEvent<T["Data"]>, swap: S) => Promise<void>;
export declare class UnifiedSwapEventListener<T extends ChainType> {
    readonly storage: ISwapStorage<ISwap<T>>;
    readonly events: T["Events"];
    readonly listeners: {
        [key in SwapType]?: {
            listener: SwapEventListener<T, any>;
            reviver: new (obj: any) => ISwap<T>;
        };
    };
    constructor(unifiedStorage: ISwapStorage<ISwap<T>>, events: T["Events"]);
    processEvents(events: SwapEvent<T["Data"]>[]): Promise<void>;
    listener: EventListener<T["Data"]>;
    start(): Promise<void>;
    stop(): void;
    registerListener<S extends ISwap<T>>(type: SwapType, listener: SwapEventListener<T, S>, reviver: new (val: any) => S): void;
    unregisterListener(type: SwapType): boolean;
}
