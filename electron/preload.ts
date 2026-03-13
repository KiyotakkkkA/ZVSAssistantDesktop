import { ipcRenderer, contextBridge } from "electron";
import type {
    BootData,
    ThemeData,
    ThemeListItem,
    UserProfile,
} from "../src/types/App";
import type { ChatDialog } from "../src/types/Chat";
import type {
    AppApi,
    AppCacheEntry,
    GetUnreadTelegramMessagesPayload,
    GetUnreadTelegramMessagesResult,
    SendTelegramMessagePayload,
    SendTelegramMessageResult,
} from "../src/types/ElectronApi";
import type { CreateProjectPayload } from "../src/types/Project";
import type {
    CreateScenarioPayload,
    UpdateScenarioPayload,
} from "../src/types/Scenario";

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

const appApi: AppApi = {
    boot: {
        getBootData: (): Promise<BootData> =>
            ipcRenderer.invoke("app:get-boot-data"),
    },
    themes: {
        getThemesList: (): Promise<ThemeListItem[]> =>
            ipcRenderer.invoke("app:get-themes-list"),
        getThemeData: (themeId: string): Promise<ThemeData> =>
            ipcRenderer.invoke("app:get-theme-data", themeId),
    },
    profile: {
        updateUserProfile: (
            nextProfile: Partial<UserProfile>,
        ): Promise<UserProfile> =>
            ipcRenderer.invoke("app:update-user-profile", nextProfile),
    },
    dialogs: {
        getActiveDialog: (): Promise<ChatDialog> =>
            ipcRenderer.invoke("app:get-active-dialog"),
        getDialogsList: () => ipcRenderer.invoke("app:get-dialogs-list"),
        getDialogById: (dialogId: string) =>
            ipcRenderer.invoke("app:get-dialog-by-id", dialogId),
        getDialogContextById: (dialogId: string) =>
            ipcRenderer.invoke("app:get-dialog-context-by-id", dialogId),
        createDialog: () => ipcRenderer.invoke("app:create-dialog"),
        renameDialog: (dialogId: string, title: string) =>
            ipcRenderer.invoke("app:rename-dialog", dialogId, title),
        deleteDialog: (dialogId: string) =>
            ipcRenderer.invoke("app:delete-dialog", dialogId),
        deleteMessageFromDialog: (dialogId: string, messageId: string) =>
            ipcRenderer.invoke(
                "app:delete-message-from-dialog",
                dialogId,
                messageId,
            ),
        truncateDialogFromMessage: (dialogId: string, messageId: string) =>
            ipcRenderer.invoke(
                "app:truncate-dialog-from-message",
                dialogId,
                messageId,
            ),
        saveDialogSnapshot: (dialog: ChatDialog): Promise<ChatDialog> =>
            ipcRenderer.invoke("app:save-dialog-snapshot", dialog),
    },
    upload: {
        pickFiles: (options?: { accept?: string[]; multiple?: boolean }) =>
            ipcRenderer.invoke("app:pick-files", options),
        pickPath: (options?: { forFolders?: boolean }) =>
            ipcRenderer.invoke("app:pick-path", options),
    },
    files: {
        saveFiles: (files) => ipcRenderer.invoke("app:save-files", files),
        saveImageFromSource: (payload) =>
            ipcRenderer.invoke("app:save-image-from-source", payload),
        getAllFiles: () => ipcRenderer.invoke("app:get-all-files"),
        getFilesByIds: (fileIds) =>
            ipcRenderer.invoke("app:get-files-by-ids", fileIds),
        deleteFile: (fileId: string) =>
            ipcRenderer.invoke("app:delete-file", fileId),
        openFile: (fileId) => ipcRenderer.invoke("app:open-saved-file", fileId),
        openPath: (targetPath: string) =>
            ipcRenderer.invoke("app:open-path", targetPath),
        openExternalUrl: (url: string) =>
            ipcRenderer.invoke("app:open-external-url", url),
    },
    projects: {
        getProjectsList: () => ipcRenderer.invoke("app:get-projects-list"),
        getDefaultProjectsDirectory: () =>
            ipcRenderer.invoke("app:get-default-projects-directory"),
        getProjectById: (projectId: string) =>
            ipcRenderer.invoke("app:get-project-by-id", projectId),
        createProject: (payload: CreateProjectPayload) =>
            ipcRenderer.invoke("app:create-project", payload),
        deleteProject: (projectId: string) =>
            ipcRenderer.invoke("app:delete-project", projectId),
        updateProjectVectorStorage: (
            projectId: string,
            vecStorId: string | null,
        ) =>
            ipcRenderer.invoke(
                "app:update-project-vector-storage",
                projectId,
                vecStorId,
            ),
    },
    scenarios: {
        getScenariosList: () => ipcRenderer.invoke("app:get-scenarios-list"),
        getScenarioById: (scenarioId: string) =>
            ipcRenderer.invoke("app:get-scenario-by-id", scenarioId),
        createScenario: (payload: CreateScenarioPayload) =>
            ipcRenderer.invoke("app:create-scenario", payload),
        updateScenario: (scenarioId: string, payload: UpdateScenarioPayload) =>
            ipcRenderer.invoke("app:update-scenario", scenarioId, payload),
        deleteScenario: (scenarioId: string) =>
            ipcRenderer.invoke("app:delete-scenario", scenarioId),
    },
    vectorStorages: {
        getVectorStorages: () => ipcRenderer.invoke("app:get-vector-storages"),
        updateVectorStorage: (vectorStorageId: string, payload) =>
            ipcRenderer.invoke(
                "app:update-vector-storage",
                vectorStorageId,
                payload,
            ),
        searchVectorStorage: (
            vectorStorageId: string,
            query: string,
            limit?: number,
        ) =>
            ipcRenderer.invoke(
                "app:search-vector-storage",
                vectorStorageId,
                query,
                limit,
            ),
    },
    cache: {
        getCacheEntry: (key: string) =>
            ipcRenderer.invoke("app:get-cache-entry", key),
        setCacheEntry: (key: string, entry: AppCacheEntry) =>
            ipcRenderer.invoke("app:set-cache-entry", key, entry),
    },
    jobs: {
        getJobs: () => ipcRenderer.invoke("app:get-jobs"),
        getJobById: (jobId: string) =>
            ipcRenderer.invoke("app:get-job-by-id", jobId),
        getJobEvents: (jobId: string) =>
            ipcRenderer.invoke("app:get-job-events", jobId),
        createJob: (payload) => ipcRenderer.invoke("app:create-job", payload),
        cancelJob: (jobId: string) =>
            ipcRenderer.invoke("app:cancel-job", jobId),
        onJobEvent: (listener) => {
            const handler = (_event: unknown, payload: unknown) => {
                listener(payload as Parameters<typeof listener>[0]);
            };

            ipcRenderer.on("app:jobs-event", handler);

            return () => {
                ipcRenderer.off("app:jobs-event", handler);
            };
        },
    },
    network: {
        proxyHttpRequest: (payload) =>
            ipcRenderer.invoke("app:proxy-http-request", payload),
    },
    communications: {
        sendTelegramMessage: (
            payload: SendTelegramMessagePayload,
        ): Promise<SendTelegramMessageResult> =>
            ipcRenderer.invoke(
                "app:communications-send-telegram-message",
                payload,
            ),
        getUnreadTelegramMessages: (
            payload: GetUnreadTelegramMessagesPayload,
        ): Promise<GetUnreadTelegramMessagesResult> =>
            ipcRenderer.invoke(
                "app:communications-get-unread-telegram-messages",
                payload,
            ),
    },
    extensions: {
        getExtensionsState: () =>
            ipcRenderer.invoke("app:get-extensions-state"),
    },
    tools: {
        getBuiltinToolPackages: () =>
            ipcRenderer.invoke("app:get-builtin-tool-packages"),
    },
    llm: {
        runChatSession: (payload) =>
            ipcRenderer.invoke("app:chat-run-session", JSON.stringify(payload)),
        cancelChatSession: (sessionId) =>
            ipcRenderer.invoke("app:chat-cancel-session", sessionId),
        resolveCommandApproval: (payload) =>
            ipcRenderer.invoke(
                "app:chat-resolve-command-approval",
                JSON.stringify(payload),
            ),
        onChatEvent: (listener) => {
            const handler = (_event: unknown, payload: unknown) => {
                if (typeof payload !== "string") {
                    return;
                }

                try {
                    listener(
                        JSON.parse(payload) as Parameters<typeof listener>[0],
                    );
                } catch {
                    return;
                }
            };

            ipcRenderer.on("app:chat-session-event", handler);

            return () => {
                ipcRenderer.off("app:chat-session-event", handler);
            };
        },
    },
    voice: {
        startMistralRealtimeTranscription: (payload) =>
            ipcRenderer.invoke("app:voice-transcription-start", payload),
        pushRealtimeTranscriptionChunk: (sessionId, chunk) =>
            ipcRenderer.invoke(
                "app:voice-transcription-push-chunk",
                sessionId,
                chunk,
            ),
        stopRealtimeTranscription: (sessionId) =>
            ipcRenderer.invoke("app:voice-transcription-stop", sessionId),
        synthesizeSpeechWithPiper: (text: string) =>
            ipcRenderer.invoke("app:voice-synthesize-with-piper", text),
        onRealtimeTranscriptionEvent: (listener) => {
            const handler = (_event: unknown, payload: unknown) => {
                listener(payload as Parameters<typeof listener>[0]);
            };

            ipcRenderer.on("app:voice-transcription-event", handler);

            return () => {
                ipcRenderer.off("app:voice-transcription-event", handler);
            };
        },
    },
};

contextBridge.exposeInMainWorld("appApi", appApi);
