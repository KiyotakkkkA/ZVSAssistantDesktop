import { ipcRenderer, contextBridge } from "electron";
import type { ResponseGenParams } from "./models/chat";
import type {
    DialogContextMessage,
    DialogEntity,
    DialogId,
} from "./models/dialog";
import type { UpdateUserDto } from "./models/user";

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
    on(...args: Parameters<typeof ipcRenderer.on>) {
        const [channel, listener] = args;
        return ipcRenderer.on(channel, (event, ...nextArgs) =>
            listener(event, ...nextArgs),
        );
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
        const [channel, ...nextArgs] = args;
        return ipcRenderer.off(channel, ...nextArgs);
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
        const [channel, ...nextArgs] = args;
        return ipcRenderer.send(channel, ...nextArgs);
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
        const [channel, ...nextArgs] = args;
        return ipcRenderer.invoke(channel, ...nextArgs);
    },
});

contextBridge.exposeInMainWorld("chat", {
    generateResponse(params: ResponseGenParams) {
        return ipcRenderer.invoke("chat:generate", params);
    },
    streamResponseGeneration(
        params: ResponseGenParams & {
            requestId: string;
        },
    ) {
        ipcRenderer.send("chat:stream:start", params);
    },
    onStreamEvent(
        listener: (payload: {
            requestId: string;
            part: { type: string; text?: string; error?: string };
        }) => void,
    ) {
        const wrappedListener = (_event: unknown, payload: unknown) => {
            listener(
                payload as {
                    requestId: string;
                    part: { type: string; text?: string; error?: string };
                },
            );
        };

        ipcRenderer.on("chat:stream:event", wrappedListener);

        return () => {
            ipcRenderer.off("chat:stream:event", wrappedListener);
        };
    },
});

contextBridge.exposeInMainWorld("profile", {
    boot() {
        return ipcRenderer.invoke("profile:boot");
    },
    update(id: string, data: UpdateUserDto) {
        return ipcRenderer.invoke("profile:update", id, data);
    },
    getThemeData(themeName: string) {
        return ipcRenderer.invoke("theme:get-data", themeName);
    },
});

contextBridge.exposeInMainWorld("workspace", {
    getDialogs() {
        return ipcRenderer.invoke("workspace:get-dialogs");
    },
    createDialog(id: DialogId, name: string, isForProject: boolean) {
        return ipcRenderer.invoke(
            "workspace:create-dialog",
            id,
            name,
            isForProject,
        );
    },
    renameDialog(id: DialogId, name: string) {
        return ipcRenderer.invoke("workspace:rename-dialog", id, name);
    },
    deleteDialog(id: DialogId) {
        return ipcRenderer.invoke("workspace:delete-dialog", id);
    },
    updateDialogMessages(
        id: DialogId,
        uiMessages: DialogEntity["ui_messages"],
        contextMessages: DialogContextMessage[],
        tokenUsage: DialogEntity["token_usage"],
    ) {
        return ipcRenderer.invoke(
            "workspace:update-dialog-state",
            id,
            uiMessages,
            contextMessages,
            tokenUsage,
        );
    },
});
