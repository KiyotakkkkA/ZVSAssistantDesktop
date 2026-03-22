import { ipcRenderer, contextBridge } from "electron";
import type {
    ChatStreamEventPayload,
    IpcChatNamespace,
    IpcCoreNamespace,
    IpcProfileNamespace,
    IpcWorkspaceNamespace,
} from "./namespaces";

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

const coreNamespace: IpcCoreNamespace = {
    httpRequest(url: string, options?: RequestInit) {
        return ipcRenderer.invoke("core:http-request", url, options);
    },
};

contextBridge.exposeInMainWorld("core", coreNamespace);

const chatNamespace: IpcChatNamespace = {
    generateResponse(params) {
        return ipcRenderer.invoke("chat:generate", params);
    },
    streamResponseGeneration(params) {
        ipcRenderer.send("chat:stream:start", params);
    },
    onStreamEvent(listener) {
        const wrappedListener = (_event: unknown, payload: unknown) => {
            listener(payload as ChatStreamEventPayload);
        };

        ipcRenderer.on("chat:stream:event", wrappedListener);

        return () => {
            ipcRenderer.off("chat:stream:event", wrappedListener);
        };
    },
};

contextBridge.exposeInMainWorld("chat", chatNamespace);

const profileNamespace: IpcProfileNamespace = {
    boot() {
        return ipcRenderer.invoke("profile:boot");
    },
    update(id, data) {
        return ipcRenderer.invoke("profile:update", id, data);
    },
    getThemeData(themeName) {
        return ipcRenderer.invoke("theme:get-data", themeName);
    },
};

contextBridge.exposeInMainWorld("profile", profileNamespace);

const workspaceNamespace: IpcWorkspaceNamespace = {
    getDialogs() {
        return ipcRenderer.invoke("workspace:get-dialogs");
    },
    createDialog(dialog) {
        return ipcRenderer.invoke("workspace:create-dialog", dialog);
    },
    renameDialog(id, name) {
        return ipcRenderer.invoke("workspace:rename-dialog", id, name);
    },
    deleteDialog(id) {
        return ipcRenderer.invoke("workspace:delete-dialog", id);
    },
    updateDialogState(payload) {
        return ipcRenderer.invoke("workspace:update-dialog-state", payload);
    },
};

contextBridge.exposeInMainWorld("workspace", workspaceNamespace);
