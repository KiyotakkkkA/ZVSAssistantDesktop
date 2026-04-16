import path from "node:path";
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";

import { ChatGenService } from "./services/ChatGenService";
import { InitService } from "./services/InitService";
import { DatabaseService } from "./services/DatabaseService";
import { ThemesService } from "./services/ThemesService";
import { ToolsRuntimeService } from "./services/ToolsRuntimeService";
import { AppStorageService } from "./services/AppStorageService";
import { LanceStoreService } from "./services/LanceStoreService";

import {
    registerIpcChatPack,
    registerIpcProfilePack,
    registerIpcSecretsPack,
    registerIpcStoragePack,
    registerIpcWorkspacePack,
    registerIpcCorePack,
    registerIpcJobsPack,
    broadcastJobsRealtimeEvent,
} from "./ipc";

import { createElectronPaths } from "./paths";
import { UserRepository } from "./repositories/UserRepository";
import { DialogRepository } from "./repositories/DialogRepository";
import { JobRepository } from "./repositories/JobRepository";
import { StorageRepository } from "./repositories/StorageRepository";
import { SecretsRepository } from "./repositories/SecretsRepository";
import { defaultUser } from "./static/data/baseProfile";
import { JobsStorage } from "./services/jobs/JobsStorage";
import { JobService } from "./services/jobs/JobService";
import { StorageVecstoresRepository } from "./repositories/storage/StorageVecstoresRepository";
import { StorageFilesRepository } from "./repositories/storage/StorageFilesRepository";
import { StorageFoldersRepository } from "./repositories/storage/StorageFoldersRepository";

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

let chatGenService: ChatGenService;
let themesService: ThemesService;
let jobService: JobService | null = null;
let jobsStorage: JobsStorage;
let toolsRuntimeService: ToolsRuntimeService;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, "public")
    : RENDERER_DIST;

let win: BrowserWindow | null;
let isShuttingDown = false;

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

function createWindow() {
    win = new BrowserWindow({
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
        void shutdownApplication().finally(() => {
            app.quit();
            win = null;
        });
    }
});

app.on("before-quit", (event) => {
    if (isShuttingDown) {
        return;
    }

    event.preventDefault();

    void shutdownApplication().finally(() => {
        app.quit();
    });
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

app.whenReady().then(() => {
    const appPaths = createElectronPaths(app.getPath("userData"));

    // Инициализируем сервисы поддержки
    const initService = new InitService(appPaths);
    initService.initialize();
    const databaseService = new DatabaseService(appPaths.databasePath);

    // Инициализируем репозитории
    const userRepository = new UserRepository(databaseService);
    const dialogRepository = new DialogRepository(databaseService);
    const jobRepository = new JobRepository(databaseService);
    const storageVecstoresRepository = new StorageVecstoresRepository(
        databaseService,
    );

    // Инициализируем функциональные сервисы
    toolsRuntimeService = new ToolsRuntimeService();
    chatGenService = new ChatGenService({
        userRepository,
        toolsRuntimeService,
        storageVecstoresRepository,
    });

    const storageRepository = new StorageRepository(
        appPaths.storagePath,
        new StorageFoldersRepository(databaseService),
        new StorageFilesRepository(databaseService),
        storageVecstoresRepository,
        new LanceStoreService(chatGenService),
    );
    const secretsRepository = new SecretsRepository(databaseService);

    jobsStorage = new JobsStorage(jobRepository, userRepository);
    const appStorageService = new AppStorageService(storageRepository);
    jobService = new JobService(
        jobsStorage,
        broadcastJobsRealtimeEvent,
        appStorageService,
    );

    themesService = new ThemesService(appPaths.themesPath);

    // Инициализируем данные
    ensureUserExists(userRepository);

    // Регистрируем IPC
    registerIpcChatPack({
        chatGenService,
    });

    registerIpcProfilePack({
        themesService,
        userRepository,
    });

    registerIpcWorkspacePack({
        dialogRepository,
    });

    registerIpcStoragePack({
        storageRepository,
    });

    registerIpcSecretsPack({
        secretsRepository,
    });

    registerIpcJobsPack({
        jobService,
    });

    registerIpcCorePack();

    createWindow();
});

function ensureUserExists(userRepository: UserRepository) {
    const currentUser = userRepository.findCurrentUser();
    if (!currentUser) {
        return userRepository.createUser(defaultUser);
    }
    return currentUser;
}

async function shutdownApplication(): Promise<void> {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    if (jobService) {
        await jobService.shutdown();
    }
}
