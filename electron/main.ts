import path from "node:path";
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";

import { ChatGenService } from "./services/ChatGenService";
import { InitService } from "./services/InitService";
import { DatabaseService } from "./services/DatabaseService";
import { ThemesService } from "./services/ThemesService";

import {
    registerIpcChatPack,
    registerIpcProfilePack,
    registerIpcWorkspacePack,
    registerIpcCorePack,
} from "./ipc";

import { createElectronPaths } from "./paths";
import { UserRepository } from "./repositories/UserRepository";
import { DialogRepository } from "./repositories/DialogRepository";
import { defaultUser } from "./static/data/baseProfile";

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

    // Инициализируем функциональные сервисы
    chatGenService = new ChatGenService({ userRepository });
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
}
