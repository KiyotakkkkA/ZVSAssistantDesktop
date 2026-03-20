import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import { fileURLToPath } from "node:url";
import { ChatGenService } from "./services/ChatGenService";

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
const DEFAULT_MODEL = "gpt-oss:120b";

const chatGenService = new ChatGenService(
    process.env.VITE_OLLAMA_API_KEY ?? "",
);

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
    registerChatIpcHandlers();
    createWindow();
});

function registerChatIpcHandlers() {
    ipcMain.handle("chat:generate", async (_event, payload: unknown) => {
        const prompt =
            typeof (payload as { prompt?: unknown })?.prompt === "string"
                ? (payload as { prompt: string }).prompt.trim()
                : "";
        const model =
            typeof (payload as { model?: unknown })?.model === "string"
                ? (payload as { model: string }).model
                : DEFAULT_MODEL;

        if (!prompt) {
            throw new Error("Prompt is required");
        }

        return chatGenService.generateResponse({
            prompt,
            model,
        });
    });

    ipcMain.on("chat:stream:start", (event, payload: unknown) => {
        const prompt =
            typeof (payload as { prompt?: unknown })?.prompt === "string"
                ? (payload as { prompt: string }).prompt.trim()
                : "";
        const requestId =
            typeof (payload as { requestId?: unknown })?.requestId === "string"
                ? (payload as { requestId: string }).requestId
                : "";
        const model =
            typeof (payload as { model?: unknown })?.model === "string"
                ? (payload as { model: string }).model
                : DEFAULT_MODEL;

        if (!prompt || !requestId) {
            event.sender.send("chat:stream:event", {
                requestId,
                part: {
                    type: "error",
                    error: "Prompt and requestId are required",
                },
            });
            return;
        }

        void (async () => {
            try {
                const result = chatGenService.streamResponseGeneration({
                    prompt,
                    model,
                });

                for await (const part of result.fullStream) {
                    event.sender.send("chat:stream:event", {
                        requestId,
                        part,
                    });
                }

                const usage = await result.getTotalUsage();
                event.sender.send("chat:stream:event", {
                    requestId,
                    part: {
                        type: "usage",
                        usage,
                    },
                });
            } catch (error) {
                event.sender.send("chat:stream:event", {
                    requestId,
                    part: {
                        type: "error",
                        error:
                            error instanceof Error
                                ? error.message
                                : "Unknown stream error",
                    },
                });
            }
        })();
    });
}

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
