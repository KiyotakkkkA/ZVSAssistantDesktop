import { ipcRenderer, contextBridge } from "electron";
import type {
    ChatStreamEventPayload,
    IpcChatNamespace,
    IpcCoreNamespace,
    IpcJobsNamespace,
    IpcProfileNamespace,
    IpcSecretsNamespace,
    IpcStorageNamespace,
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
    showOsNotification(params) {
        return ipcRenderer.invoke("core:show-os-notification", params);
    },
    openExternal(url) {
        return ipcRenderer.invoke("core:open-external", url);
    },
    openPath(path) {
        return ipcRenderer.invoke("core:open-path", path);
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

const jobsNamespace: IpcJobsNamespace = {
    getJobs() {
        return ipcRenderer.invoke("jobs:get");
    },
    getJobById(jobId) {
        return ipcRenderer.invoke("jobs:get-by-id", jobId);
    },
    getJobEvents(jobId) {
        return ipcRenderer.invoke("jobs:get-events", jobId);
    },
    createJob(payload) {
        return ipcRenderer.invoke("jobs:create", payload);
    },
    cancelJob(jobId) {
        return ipcRenderer.invoke("jobs:cancel", jobId);
    },
    onRealtimeEvent(listener) {
        const wrappedListener = (_event: unknown, payload: unknown) => {
            listener(payload as Parameters<typeof listener>[0]);
        };

        ipcRenderer.on("jobs:realtime:event", wrappedListener);

        return () => {
            ipcRenderer.off("jobs:realtime:event", wrappedListener);
        };
    },
};

contextBridge.exposeInMainWorld("jobs", jobsNamespace);

const storageNamespace: IpcStorageNamespace = {
    getStorageFolders() {
        return ipcRenderer.invoke("storage:get-folders");
    },
    getStorageFiles() {
        return ipcRenderer.invoke("storage:get-files");
    },
    getVectorizedFilesByFolder(folderId) {
        return ipcRenderer.invoke(
            "storage:get-vectorized-files-by-folder",
            folderId,
        );
    },
    getNonVectorizedFilesByFolder(folderId) {
        return ipcRenderer.invoke(
            "storage:get-non-vectorized-files-by-folder",
            folderId,
        );
    },
    getStorageVecstores() {
        return ipcRenderer.invoke("storage:get-vecstores");
    },
    refreshStorageVecstores() {
        return ipcRenderer.invoke("storage:refresh-vecstores");
    },
    refreshStorageVecstoreById(id) {
        return ipcRenderer.invoke("storage:refresh-vecstore-by-id", id);
    },
    createStorageFolder(payload) {
        return ipcRenderer.invoke("storage:create-folder", payload);
    },
    createStorageVecstore(payload) {
        return ipcRenderer.invoke("storage:create-vecstore", payload);
    },
    renameStorageVecstore(id, name) {
        return ipcRenderer.invoke("storage:rename-vecstore", id, name);
    },
    deleteStorageVecstore(id) {
        return ipcRenderer.invoke("storage:delete-vecstore", id);
    },
    renameStorageFolder(id, name) {
        return ipcRenderer.invoke("storage:rename-folder", id, name);
    },
    deleteStorageFolder(id) {
        return ipcRenderer.invoke("storage:delete-folder", id);
    },
    addFilesToFolder(folderId, files) {
        return ipcRenderer.invoke(
            "storage:add-files-to-folder",
            folderId,
            files,
        );
    },
    removeFilesFromFolder(folderId, fileIds) {
        return ipcRenderer.invoke(
            "storage:remove-files-from-folder",
            folderId,
            fileIds,
        );
    },
    refreshFolderContent(folderId) {
        return ipcRenderer.invoke("storage:refresh-folder-content", folderId);
    },
};

contextBridge.exposeInMainWorld("storage", storageNamespace);

const secretsNamespace: IpcSecretsNamespace = {
    getSecrets() {
        return ipcRenderer.invoke("secrets:get");
    },
    getSecretsByType(type) {
        return ipcRenderer.invoke("secrets:get-by-type", type);
    },
    createSecret(payload) {
        return ipcRenderer.invoke("secrets:create", payload);
    },
    deleteSecret(id) {
        return ipcRenderer.invoke("secrets:delete", id);
    },
};

contextBridge.exposeInMainWorld("secrets", secretsNamespace);
