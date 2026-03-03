import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";

export type IpcArgsHandler<Args extends unknown[] = never[]> = (
    ...args: Args
) => unknown | Promise<unknown>;

export type IpcEventArgsHandler<Args extends unknown[] = never[]> = (
    event: IpcMainInvokeEvent,
    ...args: Args
) => unknown | Promise<unknown>;

export const handleIpc = <Args extends unknown[]>(
    channel: string,
    handler: IpcArgsHandler<Args>,
) => {
    ipcMain.handle(channel, (_event, ...args) => handler(...(args as Args)));
};

export const handleIpcWithEvent = <Args extends unknown[]>(
    channel: string,
    handler: IpcEventArgsHandler<Args>,
) => {
    ipcMain.handle(channel, (event, ...args) =>
        handler(event, ...(args as Args)),
    );
};

export const handleManyIpc = (
    handlers: Array<readonly [channel: string, handler: IpcArgsHandler]>,
) => {
    for (const [channel, handler] of handlers) {
        handleIpc(channel, handler);
    }
};
