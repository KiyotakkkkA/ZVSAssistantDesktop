import path from "node:path";
import fs from "node:fs/promises";
import { readFile } from "node:fs/promises";

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { fileURLToPath } from "node:url";
import { InitService } from "./services/InitService";
import { UserDataService } from "./services/UserDataService";
import { CommandExecService } from "./services/CommandExecService";
import { BrowserService } from "./services/BrowserService";
import { OllamaService } from "./services/agents/OllamaService";
import { MistralService } from "./services/agents/MistralService";
import { PiperService } from "./services/agents/PiperService";
import { ExtensionsService } from "./services/extensions/ExtensionsService";
import { LanceDbService } from "./services/storage/LanceDbService";
import { VectorizationService } from "./services/storage/VectorizationService";
import { JobsStorage } from "./services/jobs/JobsStorage";
import { JobService } from "./services/jobs/JobService";
import { createElectronPaths } from "./paths";
import type { UserProfile } from "../src/types/App";
import type { ChatDialog } from "../src/types/Chat";
import type {
    AppCacheEntry,
    CreateJobPayload,
    ProxyHttpRequestPayload,
    SaveImageFromSourcePayload,
    StartMistralRealtimeTranscriptionPayload,
    StreamOllamaChatPayload,
    UpdateVectorStoragePayload,
    UploadedFileData,
} from "../src/types/ElectronApi";
import type { CreateProjectPayload } from "../src/types/Project";
import type {
    CreateScenarioPayload,
    UpdateScenarioPayload,
} from "../src/types/Scenario";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

const APP_ID = "com.zvs.assistant";

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, "public")
    : RENDERER_DIST;

let win: BrowserWindow | null;
let userDataService: UserDataService;
let commandExecService: CommandExecService;
let browserService: BrowserService;
let ollamaService: OllamaService;
let mistralService: MistralService;
let piperService: PiperService;
let jobService: JobService;
let extensionsService: ExtensionsService;

app.setAppUserModelId(APP_ID);

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
    app.quit();
}

process.on("uncaughtException", (error) => {
    console.error("[main] uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
    console.error("[main] unhandledRejection", reason);
});

const mimeByExtension: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".avif": "image/avif",
};

const imageExtensions = [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "bmp",
    "svg",
    "avif",
];

const extensionByMime: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/bmp": ".bmp",
    "image/svg+xml": ".svg",
    "image/avif": ".avif",
};

const getMimeTypeByExtension = (filePath: string): string => {
    const extension = path.extname(filePath).toLowerCase();

    return mimeByExtension[extension] || "application/octet-stream";
};

const isRemoteUrl = (value: string) => /^https?:\/\//i.test(value);
const isDataUrl = (value: string) => /^data:/i.test(value);
const isFileUrl = (value: string) => /^file:\/\//i.test(value);

const ensureImageExt = (fileName: string, mimeType: string) => {
    const ext = path.extname(fileName).toLowerCase();

    if (ext) {
        return fileName;
    }

    return `${fileName}${extensionByMime[mimeType] || ".png"}`;
};

const parseDataUrl = (src: string) => {
    const marker = ";base64,";
    const markerIndex = src.indexOf(marker);

    if (markerIndex === -1) {
        throw new Error("Invalid data URL");
    }

    const header = src.slice(0, markerIndex);
    const mimeType = header.slice(5) || "application/octet-stream";
    const base64 = src.slice(markerIndex + marker.length);

    return {
        mimeType,
        buffer: Buffer.from(base64, "base64"),
    };
};

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
        webPreferences: {
            preload: path.join(__dirname, "preload.mjs"),
        },
    });

    win.webContents.on("did-finish-load", () => {
        win?.webContents.send(
            "main-process-message",
            new Date().toLocaleString(),
        );
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(RENDERER_DIST, "index.html"));
    }

    win.maximize();
}

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        void mistralService?.stopAll();
        void jobService?.shutdown();
        app.quit();
        win = null;
    }
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on("second-instance", () => {
    if (!win) {
        createWindow();
        return;
    }

    if (win.isMinimized()) {
        win.restore();
    }

    win.focus();
});

app.whenReady()
    .then(() => {
        const appPaths = createElectronPaths(app.getPath("userData"));
        const initDirectoriesService = new InitService(appPaths);

        initDirectoriesService.initialize();
        extensionsService = new ExtensionsService(appPaths.extensionsPath);
        userDataService = new UserDataService(appPaths);
        commandExecService = new CommandExecService();
        browserService = new BrowserService();
        ollamaService = new OllamaService();
        const lanceDbService = new LanceDbService(appPaths.vectorIndexPath);
        const vectorizationService = new VectorizationService(
            userDataService,
            ollamaService,
            lanceDbService,
        );
        const jobsStorage = new JobsStorage(
            userDataService.getDatabaseService(),
            () => userDataService.getCurrentUserId(),
        );
        jobService = new JobService(
            jobsStorage,
            vectorizationService,
            extensionsService,
            (jobEvent) => {
                win?.webContents.send("app:jobs-event", jobEvent);
            },
        );
        mistralService = new MistralService((eventPayload) => {
            win?.webContents.send(
                "app:voice-transcription-event",
                eventPayload,
            );
        });
        piperService = new PiperService({
            tempDir: app.getPath("temp"),
            resolvePiperExecutablePath: () =>
                extensionsService.resolvePiperExecutablePath(),
            resolveConfiguredModelPath: () => {
                const configuredPath =
                    userDataService.getBootData().userProfile.piperModelPath;

                return Promise.resolve(configuredPath?.trim() || "");
            },
        });

        ipcMain.handle("app:get-boot-data", async () => {
            const bootData = userDataService.getBootData();
            const extensions = await extensionsService.getExtensionsState();

            return {
                ...bootData,
                extensions,
            };
        });
        ipcMain.handle("app:get-extensions-state", () =>
            extensionsService.getExtensionsState(),
        );
        ipcMain.handle("app:get-themes-list", () =>
            userDataService.getThemesList(),
        );
        ipcMain.handle("app:get-theme-data", (_event, themeId: string) =>
            userDataService.getThemeData(themeId),
        );
        ipcMain.handle(
            "app:update-user-profile",
            (_event, nextProfile: Partial<UserProfile>) =>
                userDataService.updateUserProfile(nextProfile),
        );
        ipcMain.handle("app:get-active-dialog", () =>
            userDataService.getActiveDialog(),
        );
        ipcMain.handle("app:get-dialogs-list", () =>
            userDataService.getDialogsList(),
        );
        ipcMain.handle("app:get-dialog-by-id", (_event, dialogId: string) =>
            userDataService.getDialogById(dialogId),
        );
        ipcMain.handle("app:create-dialog", () =>
            userDataService.createDialog(),
        );
        ipcMain.handle(
            "app:rename-dialog",
            (_event, dialogId: string, title: string) =>
                userDataService.renameDialog(dialogId, title),
        );
        ipcMain.handle("app:delete-dialog", (_event, dialogId: string) =>
            userDataService.deleteDialog(dialogId),
        );
        ipcMain.handle(
            "app:delete-message-from-dialog",
            (_event, dialogId: string, messageId: string) =>
                userDataService.deleteMessageFromDialog(dialogId, messageId),
        );
        ipcMain.handle(
            "app:truncate-dialog-from-message",
            (_event, dialogId: string, messageId: string) =>
                userDataService.truncateDialogFromMessage(dialogId, messageId),
        );
        ipcMain.handle(
            "app:save-dialog-snapshot",
            (_event, dialog: ChatDialog) =>
                userDataService.saveDialogSnapshot(dialog),
        );
        ipcMain.handle("app:get-projects-list", () =>
            userDataService.getProjectsList(),
        );
        ipcMain.handle("app:get-default-projects-directory", () =>
            userDataService.getDefaultProjectsDirectory(),
        );
        ipcMain.handle("app:get-project-by-id", (_event, projectId: string) =>
            userDataService.getProjectById(projectId),
        );
        ipcMain.handle(
            "app:create-project",
            (_event, payload: CreateProjectPayload) =>
                userDataService.createProject(payload),
        );
        ipcMain.handle("app:delete-project", (_event, projectId: string) =>
            userDataService.deleteProject(projectId),
        );
        ipcMain.handle("app:get-scenarios-list", () =>
            userDataService.getScenariosList(),
        );
        ipcMain.handle("app:get-scenario-by-id", (_event, scenarioId: string) =>
            userDataService.getScenarioById(scenarioId),
        );
        ipcMain.handle(
            "app:create-scenario",
            (_event, payload: CreateScenarioPayload) =>
                userDataService.createScenario(payload),
        );
        ipcMain.handle(
            "app:update-scenario",
            (_event, scenarioId: string, payload: UpdateScenarioPayload) =>
                userDataService.updateScenario(scenarioId, payload),
        );
        ipcMain.handle("app:delete-scenario", (_event, scenarioId: string) =>
            userDataService.deleteScenario(scenarioId),
        );
        ipcMain.handle("app:save-files", (_event, files: UploadedFileData[]) =>
            userDataService.saveFiles(files),
        );
        ipcMain.handle("app:get-files-by-ids", (_event, fileIds: string[]) =>
            userDataService.getFilesByIds(fileIds),
        );
        ipcMain.handle("app:get-all-files", () =>
            userDataService.getAllFiles(),
        );
        ipcMain.handle("app:delete-file", (_event, fileId: string) =>
            userDataService.deleteFileById(fileId),
        );
        ipcMain.handle("app:get-vector-storages", () =>
            userDataService.getVectorStorages(),
        );
        ipcMain.handle("app:create-vector-storage", () =>
            userDataService.createVectorStorage(),
        );
        ipcMain.handle("app:get-vector-tags", () =>
            userDataService.getVectorTags(),
        );
        ipcMain.handle("app:create-vector-tag", (_event, name: string) =>
            userDataService.createVectorTag(name),
        );
        ipcMain.handle(
            "app:delete-vector-storage",
            (_event, vectorStorageId: string) =>
                userDataService.deleteVectorStorage(vectorStorageId),
        );
        ipcMain.handle("app:get-cache-entry", (_event, key: string) =>
            userDataService.getCacheEntry(key),
        );
        ipcMain.handle("app:get-jobs", () => jobService.getJobs());
        ipcMain.handle("app:get-job-by-id", (_event, jobId: string) =>
            jobService.getJobById(jobId),
        );
        ipcMain.handle("app:get-job-events", (_event, jobId: string) =>
            jobService.getJobEvents(jobId),
        );
        ipcMain.handle("app:create-job", (_event, payload: CreateJobPayload) =>
            jobService.createJob(payload),
        );
        ipcMain.handle("app:cancel-job", (_event, jobId: string) =>
            jobService.cancelJob(jobId),
        );
        ipcMain.handle(
            "app:update-vector-storage",
            async (
                _event,
                vectorStorageId: string,
                payload: UpdateVectorStoragePayload,
            ) => {
                const normalizedDataPath =
                    typeof payload.dataPath === "string"
                        ? payload.dataPath.trim()
                        : undefined;

                if (normalizedDataPath !== undefined) {
                    const resolvedDataPathReference = normalizedDataPath
                        ? await lanceDbService.resolveDataPathReference(
                              normalizedDataPath,
                          )
                        : null;

                    if (normalizedDataPath && !resolvedDataPathReference) {
                        throw new Error(
                            "Путь должен указывать на папку таблицы .lance или директорию с единственной таблицей .lance",
                        );
                    }

                    const effectiveDataPath = normalizedDataPath
                        ? resolvedDataPathReference!.dataPath
                        : "";

                    const sizeFromDataPath = effectiveDataPath
                        ? await lanceDbService.getDataPathSizeBytes(
                              effectiveDataPath,
                          )
                        : 0;

                    return userDataService.updateVectorStorage(
                        vectorStorageId,
                        {
                            ...payload,
                            dataPath: effectiveDataPath,
                            size: sizeFromDataPath,
                            lastActiveAt: new Date().toISOString(),
                        },
                    );
                }

                return userDataService.updateVectorStorage(
                    vectorStorageId,
                    payload,
                );
            },
        );
        ipcMain.handle(
            "app:search-vector-storage",
            async (
                _event,
                vectorStorageId: string,
                query: string,
                limit?: number,
            ) => {
                const normalizedStorageId =
                    typeof vectorStorageId === "string"
                        ? vectorStorageId.trim()
                        : "";
                const normalizedQuery =
                    typeof query === "string" ? query.trim() : "";

                if (!normalizedStorageId) {
                    throw new Error("Не передан идентификатор vector storage");
                }

                if (!normalizedQuery) {
                    throw new Error("Поисковый запрос пуст");
                }

                const storage =
                    userDataService.getVectorStorageById(normalizedStorageId);

                if (!storage) {
                    throw new Error("Vector storage не найден");
                }

                const dataPath = storage.dataPath.trim();

                if (!dataPath) {
                    throw new Error(
                        "Для векторного хранилища не задан путь к индексу",
                    );
                }

                const profile = userDataService.getBootData().userProfile;
                const model =
                    profile.ollamaEmbeddingModel.trim() ||
                    profile.ollamaModel.trim();

                if (!model) {
                    throw new Error("Не задана embedding model");
                }

                const embedResult = await ollamaService.getEmbed(
                    {
                        model,
                        input: [normalizedQuery],
                    },
                    profile.ollamaToken,
                );

                const queryEmbedding =
                    embedResult.embeddings[0] &&
                    Array.isArray(embedResult.embeddings[0])
                        ? embedResult.embeddings[0]
                        : [];

                if (!queryEmbedding.length) {
                    throw new Error("Не удалось получить embedding запроса");
                }

                const rows = await lanceDbService.search(
                    dataPath,
                    queryEmbedding,
                    typeof limit === "number" ? limit : 5,
                );

                return rows.map((row) => ({
                    id: row.id,
                    text: row.text,
                    fileId: row.fileId,
                    fileName: row.fileName,
                    chunkIndex: row.chunkIndex,
                    score:
                        typeof row._distance === "number"
                            ? row._distance
                            : typeof row._score === "number"
                              ? row._score
                              : 0,
                }));
            },
        );
        ipcMain.handle(
            "app:set-cache-entry",
            (_event, key: string, entry: AppCacheEntry) => {
                userDataService.setCacheEntry(key, entry);
            },
        );
        ipcMain.handle(
            "app:ollama-stream-chat",
            async (_event, payload: StreamOllamaChatPayload) => {
                const token =
                    userDataService.getBootData().userProfile.ollamaToken;

                return ollamaService.streamChat(payload, token);
            },
        );

        ipcMain.handle(
            "app:proxy-http-request",
            async (_event, payload: ProxyHttpRequestPayload) => {
                const url =
                    typeof payload?.url === "string" ? payload.url.trim() : "";
                const method =
                    typeof payload?.method === "string"
                        ? payload.method.trim().toUpperCase()
                        : "GET";
                const headers =
                    payload && typeof payload.headers === "object"
                        ? payload.headers
                        : undefined;
                const requestBodyText =
                    typeof payload?.bodyText === "string"
                        ? payload.bodyText
                        : undefined;

                if (!url) {
                    return {
                        ok: false,
                        status: 0,
                        statusText: "URL is required",
                        bodyText: "",
                    };
                }

                try {
                    const response = await fetch(url, {
                        method,
                        headers: {
                            Accept: "application/json, text/plain, */*",
                            ...(headers || {}),
                        },
                        ...(requestBodyText &&
                        method !== "GET" &&
                        method !== "HEAD"
                            ? { body: requestBodyText }
                            : {}),
                    });
                    const responseBodyText = await response.text();

                    return {
                        ok: response.ok,
                        status: response.status,
                        statusText: response.statusText,
                        bodyText: responseBodyText,
                    };
                } catch (error) {
                    return {
                        ok: false,
                        status: 0,
                        statusText:
                            error instanceof Error
                                ? error.message
                                : "Network request failed",
                        bodyText: "",
                    };
                }
            },
        );
        ipcMain.handle(
            "app:voice-transcription-start",
            async (
                _event,
                payload: StartMistralRealtimeTranscriptionPayload,
            ) => {
                return mistralService.startSession(payload);
            },
        );
        ipcMain.handle(
            "app:voice-transcription-push-chunk",
            async (_event, sessionId: string, chunk: Uint8Array) => {
                await mistralService.pushChunk(sessionId, chunk);
            },
        );
        ipcMain.handle(
            "app:voice-transcription-stop",
            async (_event, sessionId: string) => {
                await mistralService.stopSession(sessionId);
            },
        );
        ipcMain.handle(
            "app:voice-synthesize-with-piper",
            async (_event, text: string) => {
                return piperService.synthesize(text);
            },
        );
        ipcMain.handle(
            "app:open-saved-file",
            async (_event, fileId: string) => {
                const file = userDataService.getFileById(fileId);

                if (!file) {
                    return false;
                }

                const openResult = await shell.openPath(file.path);
                return openResult === "";
            },
        );
        ipcMain.handle("app:open-path", async (_event, targetPath: string) => {
            if (!targetPath || typeof targetPath !== "string") {
                return false;
            }

            const openResult = await shell.openPath(targetPath);
            return openResult === "";
        });
        ipcMain.handle("app:open-external-url", async (_event, url: string) => {
            if (!url || typeof url !== "string") {
                return false;
            }

            try {
                await shell.openExternal(url);
                return true;
            } catch {
                return false;
            }
        });
        ipcMain.handle(
            "app:save-image-from-source",
            async (event, payload: SaveImageFromSourcePayload) => {
                const source =
                    typeof payload?.src === "string" ? payload.src.trim() : "";

                if (!source) {
                    return null;
                }

                const preferredFileName =
                    typeof payload.preferredFileName === "string"
                        ? payload.preferredFileName.trim()
                        : "";

                let sourceKind: "remote" | "local" | "data-url" = "local";
                let buffer: Buffer;
                let mimeType = "application/octet-stream";
                let fileName = preferredFileName || "image";

                if (isDataUrl(source)) {
                    sourceKind = "data-url";
                    const parsed = parseDataUrl(source);
                    buffer = parsed.buffer;
                    mimeType = parsed.mimeType;
                    fileName = ensureImageExt(fileName, mimeType);
                } else if (isRemoteUrl(source)) {
                    sourceKind = "remote";
                    const response = await fetch(source);

                    if (!response.ok) {
                        throw new Error(
                            `Failed to fetch image (${response.status})`,
                        );
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    buffer = Buffer.from(arrayBuffer);
                    mimeType = response.headers.get("content-type") || mimeType;

                    const remoteName = path.basename(
                        new URL(source).pathname || "image",
                    );
                    fileName = preferredFileName || remoteName || "image";
                    fileName = ensureImageExt(fileName, mimeType);
                } else {
                    sourceKind = "local";
                    const localPath = isFileUrl(source)
                        ? fileURLToPath(source)
                        : source;

                    buffer = await fs.readFile(localPath);
                    mimeType = getMimeTypeByExtension(localPath);
                    fileName = preferredFileName || path.basename(localPath);
                    fileName = ensureImageExt(fileName, mimeType);
                }

                const currentWindow = BrowserWindow.fromWebContents(
                    event.sender,
                );
                const defaultPath = app.getPath("downloads");
                const targetPathByDialog = currentWindow
                    ? await dialog.showSaveDialog(currentWindow, {
                          title: "Сохранить изображение",
                          defaultPath: path.join(defaultPath, fileName),
                          filters: [
                              {
                                  name: "Images",
                                  extensions: imageExtensions,
                              },
                          ],
                      })
                    : await dialog.showSaveDialog({
                          title: "Сохранить изображение",
                          defaultPath: path.join(defaultPath, fileName),
                          filters: [
                              {
                                  name: "Images",
                                  extensions: imageExtensions,
                              },
                          ],
                      });

                if (
                    targetPathByDialog.canceled ||
                    !targetPathByDialog.filePath
                ) {
                    return null;
                }

                await fs.writeFile(targetPathByDialog.filePath, buffer);

                return {
                    savedPath: targetPathByDialog.filePath,
                    fileName: path.basename(targetPathByDialog.filePath),
                    mimeType,
                    size: buffer.byteLength,
                    sourceKind,
                };
            },
        );
        ipcMain.handle(
            "app:exec-shell-command",
            (_event, command: string, cwd?: string) =>
                commandExecService.execute(command, cwd),
        );
        ipcMain.handle(
            "app:browser-open-url",
            (_event, url: string, timeoutMs?: number) =>
                browserService.openUrl(url, timeoutMs),
        );
        ipcMain.handle(
            "app:browser-get-page-snapshot",
            (_event, maxElements?: number) =>
                browserService.getPageSnapshot(maxElements),
        );
        ipcMain.handle(
            "app:browser-interact-with",
            (
                _event,
                params: {
                    action: "click" | "type";
                    selector: string;
                    text?: string;
                    submit?: boolean;
                    waitForNavigationMs?: number;
                },
            ) => browserService.interactWith(params),
        );
        ipcMain.handle("app:browser-close-session", () =>
            browserService.closeSession(),
        );
        ipcMain.handle(
            "app:pick-files",
            async (
                event,
                options?: { accept?: string[]; multiple?: boolean },
            ) => {
                const currentWindow = BrowserWindow.fromWebContents(
                    event.sender,
                );

                const accept = options?.accept ?? [];
                const filters =
                    accept.length > 0
                        ? [
                              {
                                  name: "Allowed files",
                                  extensions: accept
                                      .flatMap((item) =>
                                          item
                                              .split(",")
                                              .map((part) =>
                                                  part.trim().toLowerCase(),
                                              ),
                                      )
                                      .flatMap((item) =>
                                          item === "image/*"
                                              ? imageExtensions
                                              : [item],
                                      )
                                      .map((item) =>
                                          item.startsWith(".")
                                              ? item.slice(1)
                                              : item
                                                    .replace(/^[*]/, "")
                                                    .replace(/^[.]/, ""),
                                      )
                                      .filter((item) => item && item !== "*"),
                              },
                          ]
                        : [];

                const dialogProperties: Array<"openFile" | "multiSelections"> =
                    ["openFile"];

                if (options?.multiple) {
                    dialogProperties.push("multiSelections");
                }

                const openDialogOptions = {
                    properties: dialogProperties,
                    filters,
                };

                const selection = currentWindow
                    ? await dialog.showOpenDialog(
                          currentWindow,
                          openDialogOptions,
                      )
                    : await dialog.showOpenDialog(openDialogOptions);

                if (selection.canceled || selection.filePaths.length === 0) {
                    return [] satisfies UploadedFileData[];
                }

                const files = await Promise.all(
                    selection.filePaths.map(
                        async (filePath): Promise<UploadedFileData> => {
                            const buffer = await readFile(filePath);
                            const mimeType = getMimeTypeByExtension(filePath);

                            return {
                                name: path.basename(filePath),
                                mimeType,
                                size: buffer.byteLength,
                                dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
                            };
                        },
                    ),
                );

                return files;
            },
        );

        ipcMain.handle(
            "app:pick-path",
            async (event, options?: { forFolders?: boolean }) => {
                const currentWindow = BrowserWindow.fromWebContents(
                    event.sender,
                );
                const dialogProperties: Array<"openFile" | "openDirectory"> = [
                    options?.forFolders ? "openDirectory" : "openFile",
                ];

                const openDialogOptions = {
                    properties: dialogProperties,
                };

                const selection = currentWindow
                    ? await dialog.showOpenDialog(
                          currentWindow,
                          openDialogOptions,
                      )
                    : await dialog.showOpenDialog(openDialogOptions);

                if (selection.canceled || selection.filePaths.length === 0) {
                    return null;
                }

                return selection.filePaths[0] ?? null;
            },
        );

        ipcMain.handle("app:fs-list-directory", async (_event, cwd: string) => {
            const entries = await fs.readdir(cwd, { withFileTypes: true });
            const result = await Promise.all(
                entries.map(async (entry) => {
                    const entryPath = path.join(cwd, entry.name);
                    const stat = await fs.stat(entryPath);
                    return {
                        name: entry.name,
                        type: entry.isDirectory() ? "directory" : "file",
                        size: stat.size,
                        modifiedAt: stat.mtime.toISOString(),
                    };
                }),
            );
            return { path: cwd, entries: result };
        });

        ipcMain.handle(
            "app:fs-create-file",
            async (_event, cwd: string, filename: string, content = "") => {
                const filePath = path.join(cwd, filename);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, content, "utf-8");
                return { success: true, path: filePath };
            },
        );

        ipcMain.handle(
            "app:fs-create-dir",
            async (_event, cwd: string, dirname: string) => {
                const dirPath = path.join(cwd, dirname);
                await fs.mkdir(dirPath, { recursive: true });
                return { success: true, path: dirPath };
            },
        );

        ipcMain.handle(
            "app:fs-read-file",
            async (
                _event,
                filePath: string,
                readAll: boolean,
                fromLine?: number,
                toLine?: number,
            ) => {
                const raw = await fs.readFile(filePath, "utf-8");
                const lines = raw.split("\n");
                const totalLines = lines.length;

                if (readAll) {
                    return {
                        path: filePath,
                        content: raw,
                        totalLines,
                        fromLine: 1,
                        toLine: totalLines,
                    };
                }

                const from = Math.max(1, fromLine ?? 1);
                const to = Math.min(totalLines, toLine ?? totalLines);
                const content = lines.slice(from - 1, to).join("\n");

                return {
                    path: filePath,
                    content,
                    totalLines,
                    fromLine: from,
                    toLine: to,
                };
            },
        );

        createWindow();
    })
    .catch((error) => {
        console.error("Failed to initialize Electron app", error);
        app.quit();
    });
