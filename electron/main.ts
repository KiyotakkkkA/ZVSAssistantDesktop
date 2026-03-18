import path from "node:path";
import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";

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
    createWindow();
});

async function shutdownApplication(): Promise<void> {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    try {
        console.log("[main] Starting shutdown...");
    } catch (error) {
        console.error("[main] Error during shutdown:", error);
    }
}
