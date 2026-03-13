import path from "node:path";

import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { InitService } from "./services/InitService";
import { BrowserService } from "./services/BrowserService";
import { MistralService } from "./services/agents/MistralService";
import { PiperService } from "./services/agents/PiperService";
import { ExtensionsService } from "./services/extensions/ExtensionsService";
import { DialogsService } from "./services/chat/DialogsService";
import { ProjectsService } from "./services/chat/ProjectsService";
import { ScenariosService } from "./services/chat/ScenariosService";
import { ChatSessionService } from "./services/chat/ChatSessionService";
import { JobsStorage } from "./services/jobs/JobsStorage";
import { JobService } from "./services/jobs/JobService";
import { DatabaseService } from "./services/storage/DatabaseService";
import { MetaService } from "./services/storage/MetaService";
import { FileStorageService } from "./services/storage/FileStorageService";
import { ThemesService } from "./services/userData/ThemesService";
import { UserProfileService } from "./services/userData/UserProfileService";
import { FSystemService } from "./services/FSystemService";
import { TelegramService } from "./services/communications/TelegramService";
import { createElectronPaths } from "./paths";
import { registerIpcCorePack } from "./ipc/ipcCorePack";
import { registerIpcDialogsPack } from "./ipc/ipcDialogsPack";
import { registerIpcProjectsPack } from "./ipc/ipcProjectsPack";
import { registerIpcScenariosPack } from "./ipc/ipcScenariosPack";
import { registerIpcStoragePack } from "./ipc/ipcStoragePack";
import { registerIpcJobsPack } from "./ipc/ipcJobsPack";
import { registerIpcAgentsPack } from "./ipc/ipcAgentsPack";
import { registerIpcCommunicationsPack } from "./ipc/ipcCommunicationsPack";
import { registerIpcSystemPack } from "./ipc/ipcSystemPack";
import { getNativeCoreAddon } from "./services/core/nativeCoreAddon";

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
let browserService: BrowserService;
let mistralService: MistralService;
let piperService: PiperService;
let jobService: JobService;
let extensionsService: ExtensionsService;
let chatSessionService: ChatSessionService;

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
        Promise.all([
            mistralService?.stopAll() ?? Promise.resolve(),
            jobService?.shutdown() ?? Promise.resolve(),
        ])
            .catch((error) => {
                console.error("[main] Error during shutdown:", error);
            })
            .finally(() => {
                app.quit();
                win = null;
            });
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
        const fSystemService = new FSystemService();
        const telegramService = new TelegramService();

        initDirectoriesService.initialize();
        extensionsService = new ExtensionsService(appPaths.extensionsPath);
        const databaseService = new DatabaseService(appPaths.databasePath);
        const metaService = new MetaService(appPaths.metaPath);
        const userProfileService = new UserProfileService(
            databaseService,
            metaService,
        );
        const themesService = new ThemesService(appPaths.themesPath);
        const currentUserId = userProfileService.getCurrentUserId();
        const dialogsService = new DialogsService(
            databaseService,
            ({ activeDialogId, activeProjectId }) => {
                userProfileService.updateUserProfile({
                    activeDialogId,
                    activeProjectId,
                    activeScenarioId: null,
                    lastActiveTab: activeProjectId ? "projects" : "dialogs",
                });
            },
            currentUserId,
        );
        const projectsService = new ProjectsService(
            databaseService,
            currentUserId,
        );
        const scenariosService = new ScenariosService(
            databaseService,
            currentUserId,
        );
        const fileStorageService = new FileStorageService(
            appPaths.filesPath,
            databaseService,
            fSystemService,
            currentUserId,
        );

        for (const project of projectsService.getProjectsList()) {
            dialogsService.linkDialogToProject(project.dialogId, project.id);
        }

        const getBootData = () => {
            const userProfile = userProfileService.getUserProfile();
            const preferredThemeData = themesService.resolveThemePalette(
                userProfile.themePreference,
            );

            return {
                userProfile,
                preferredThemeData,
            };
        };

        browserService = new BrowserService();
        const jobsStorage = new JobsStorage(
            databaseService,
            userProfileService,
        );
        jobService = new JobService(
            jobsStorage,
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
                    userProfileService.getUserProfile().piperModelPath;

                return Promise.resolve(configuredPath?.trim() || "");
            },
        });
        chatSessionService = new ChatSessionService({
            browserService,
            userProfileService,
        });

        registerIpcCorePack({
            getBootData,
            extensionsService,
            getBuiltinToolPackages: () =>
                getNativeCoreAddon().getBuiltinToolPackages(),
            themesService,
            userProfileService,
        });
        registerIpcDialogsPack({
            dialogsService,
            userProfileService,
        });
        registerIpcProjectsPack({
            projectsService,
            dialogsService,
            fileStorageService,
            userProfileService,
            defaultProjectsDirectory: appPaths.defaultProjectsDirectory,
        });
        registerIpcScenariosPack({
            scenariosService,
            userProfileService,
        });
        registerIpcStoragePack({
            databaseService,
            fileStorageService,
            fSystemService,
        });
        registerIpcJobsPack({
            jobService,
        });
        registerIpcAgentsPack({
            chatSessionService,
            mistralService,
            piperService,
        });
        registerIpcCommunicationsPack({
            telegramService,
        });
        registerIpcSystemPack({
            fileStorageService,
            fSystemService,
        });

        createWindow();
    })
    .catch((error) => {
        console.error("Failed to initialize Electron app", error);
        app.quit();
    });
